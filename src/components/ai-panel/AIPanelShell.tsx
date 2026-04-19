/**
 * AI Panel Shell
 * Content component for the Resona AI assistant panel.
 * Accepts the UseAIAnalysisReturn object and schema for @mention support.
 */

import { Button }   from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileIcon, ImageIcon, Plus, X, AlertTriangle, Database, FolderOpen, FileText } from 'lucide-react';
import { ParsedSchema } from '@/lib/sql-parser';
import type { UseAIAgentReturn } from './hooks/useAIAgent';
import { enhancePrompt } from '@/lib/ai-client';
import { AIChatMessages } from './AIChatMessages';
import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { useAIUsage, getProactiveQuotaError, getQuotaWarning } from '@/hooks/useAIUsage';
import { useSpeechToText } from './hooks/useSpeechToText';
import { useSQLChatHistory } from './hooks/useSQLChatHistory';
import { DictationOverlay } from './DictationOverlay';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { InputToolbar } from './InputToolbar';
import { cn } from '@/lib/utils';
import { MentionAutocomplete, MentionItem } from './MentionAutocomplete';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getProjectFiles } from '@/lib/file-management/api/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Attachment {
  file:     File;
  id:       string;
  preview?: string;
  content?: string;
}

export interface AIPanelShellProps {
  schema:              ParsedSchema | null;
  ai:                  UseAIAgentReturn;
  onClose?:            () => void;
  compact?:            boolean;
  onNavigateToTable?:  (tableName: string) => void;
  allowedModels?:      string[];
  projectId?:          string | null;  // for fetching project files in @mention
}

export function AIPanelShell({
  schema,
  ai,
  onClose,
  compact = false,
  onNavigateToTable,
  allowedModels,
  projectId,
}: AIPanelShellProps) {
  const hasSchema = schema && schema.tables?.length > 0;
  const {
    sessions,
    isLoading: historyLoading,
    refetch: refetchHistory,
    loadMessages,
    deleteChat,
  } = useSQLChatHistory();

  const [activeView, setActiveView] = useState<'chat' | 'history'>('chat');
  const [attachments,        setAttachments]        = useState<Attachment[]>([]);
  const [viewingAttachment,  setViewingAttachment]  = useState<Attachment | null>(null);
  const [mentionSearch,      setMentionSearch]      = useState<string | null>(null);
  const [mentionIndex,       setMentionIndex]       = useState(0);
  const [isEnhancing,        setIsEnhancing]        = useState(false);
  const [warningDismissed,   setWarningDismissed]   = useState(false);

  const { quota: activeQuota } = useAIUsage();
  const quotaError   = getProactiveQuotaError(activeQuota);
  const quotaWarning = getQuotaWarning(activeQuota);

  // Fetch project files for @mention autocomplete
  const { data: projectFilesData } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => projectId ? getProjectFiles(projectId) : Promise.resolve({ files: [] }),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Flattened project files and folders for @mention
  const projectFiles = useMemo(() => {
    if (!projectFilesData?.files) return [];
    return projectFilesData.files
      .filter((n: any) => !n.is_folder)
      .map((n: any) => ({
        name: n.title,
        type: 'file' as const,
        icon: FileText,
      }));
  }, [projectFilesData]);

  const projectFolders = useMemo(() => {
    if (!projectFilesData?.files) return [];
    return projectFilesData.files
      .filter((n: any) => n.is_folder && n.title !== 'Project Root')
      .map((n: any) => ({
        name: n.title,
        type: 'folder' as const,
        icon: FolderOpen,
      }));
  }, [projectFilesData]);

  const dbTables = useMemo(() => {
    if (!schema?.tables) return [];
    return schema.tables.map(t => ({
      name: t.name,
      type: 'table' as const,
      icon: Database,
      meta: `${t.columns.length} cols`,
    }));
  }, [schema]);

  // Auto-undismiss when the warning level changes
  const warningKey = quotaWarning ? `${quotaWarning.level}-${quotaWarning.message.slice(0, 20)}` : null;
  const [lastWarningKey, setLastWarningKey] = useState<string | null>(null);
  if (warningKey !== lastWarningKey) {
      setLastWarningKey(warningKey);
      if (warningKey) setWarningDismissed(false);
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, audioLevel, startListening, cancelListening, confirmListening } =
    useSpeechToText();

  // Auto-expand textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
    }
  }, [ai.prompt]);

  useEffect(() => {
    if (ai.state.done) {
      refetchHistory();
    }
  }, [ai.state.done, refetchHistory]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleDictationConfirm = useCallback(() => {
    const text = confirmListening();
    if (text) ai.setPrompt(ai.prompt ? `${ai.prompt} ${text}` : text);
  }, [confirmListening, ai]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAtts = files.map(file => {
      const id = Math.random().toString(36).substring(7);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { file, id, preview };
    });
    setAttachments(prev => [...prev, ...newAtts]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter(a => a.id !== id);
    });
  };

  const handleMediaClick = () => fileInputRef.current?.click();

  const handleAttachmentClick = async (att: Attachment) => {
    if (!att.preview && (att.file.type.includes('sql') || att.file.type.includes('text') || att.file.type.includes('json'))) {
      setViewingAttachment({ ...att, content: await att.file.text() });
    } else {
      setViewingAttachment(att);
    }
  };

  const handleSend = () => {
    // Block send if quota is exhausted (double-check, UI already disables button)
    if (quotaError) {
      console.warn('[AIPanelShell] Send blocked: quota exhausted');
      return;
    }
    ai.send(ai.prompt);
    ai.setPrompt('');
    attachments.forEach(a => a.preview && URL.revokeObjectURL(a.preview));
    setAttachments([]);
  };

  const handleSelectChat = useCallback(async (chatId: string) => {
    try {
      const result = await loadMessages(chatId);
      ai.loadChat(
        chatId,
        result.messages.map(message => ({
          id: message.id,
          role: message.role,
          content: message.content,
          artifacts: message.artifacts,
          modelUsed: message.modelUsed ?? null,
          executionTrace: message.executionTrace ?? null,
          usage: message.usage ?? null,
          createdAt: message.createdAt,
        }))
      );
      setActiveView('chat'); // Automatically switch to chat after selecting history item
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load chat';
      toast.error(message);
    }
  }, [ai, loadMessages]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    try {
      await deleteChat(chatId);
      if (ai.state.chatId === chatId) {
        ai.startNewChat();
      }
      toast.success('Chat deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete chat';
      toast.error(message);
    }
  }, [ai, deleteChat]);

  const handleEnhancePrompt = useCallback(async () => {
    if (!ai.prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const result = await enhancePrompt(ai.prompt);
      ai.setPrompt(result.enhanced);
    } finally {
      setIsEnhancing(false);
    }
  }, [ai, isEnhancing]);

  // Textarea change: track @mention (unified — files, folders, tables)
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value  = e.target.value;
    ai.setPrompt(value);
    const cursor = e.target.selectionStart;
    const before = value.substring(0, cursor);
    const lastAt = before.lastIndexOf('@');
    if (lastAt !== -1 && !/\s/.test(before.substring(lastAt + 1))) {
      setMentionSearch(before.substring(lastAt + 1).toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionSearch(null);
    }
  };

  // Unified mention items: files first, then tables, then folders
  const allMentionItems = useMemo(() => {
    const items: MentionItem[] = [];
    items.push(...projectFiles);
    items.push(...dbTables);
    items.push(...projectFolders);
    return items;
  }, [projectFiles, dbTables, projectFolders]);

  const filteredMentionItems = useMemo(() => {
    if (mentionSearch === null) return [];
    if (!mentionSearch) return allMentionItems.slice(0, 20);
    return allMentionItems.filter(item =>
      item.name.toLowerCase().includes(mentionSearch)
    ).slice(0, 20);
  }, [mentionSearch, allMentionItems]);

  const handleMentionSelect = (item: typeof allMentionItems[number]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const value  = ai.prompt;
    const before = value.substring(0, cursor);
    const after  = value.substring(cursor);
    const lastAt = before.lastIndexOf('@');
    const insertName = `@${item.name} `;
    const newValue = before.substring(0, lastAt) + insertName + after;
    ai.setPrompt(newValue);
    setMentionSearch(null);
    textarea.focus();
    // Place cursor after the inserted mention
    const newCursor = lastAt + insertName.length;
    setTimeout(() => {
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSearch !== null && filteredMentionItems.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setMentionIndex(i => (i + 1) % filteredMentionItems.length); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setMentionIndex(i => (i - 1 + filteredMentionItems.length) % filteredMentionItems.length); return; }
      if (e.key === 'Enter' && filteredMentionItems[mentionIndex]) { e.preventDefault(); handleMentionSelect(filteredMentionItems[mentionIndex]); return; }
      if (e.key === 'Escape')     { setMentionSearch(null); return; }
    }
    
    // Atomic deletion for @mentions
    if (e.key === 'Backspace') {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursor = textarea.selectionStart;
        const value = ai.prompt;
        const before = value.substring(0, cursor);
        // Match @name followed by space or end of string
        const match = before.match(/(@[a-zA-Z_@][a-zA-Z0-9_.\-]*\s?)$/);
        
        if (match) {
          const mentionName = match[0].trim().substring(1);
          // Only delete atomically if it's a known table, file, or folder
          const isValidMention = 
            schema?.tables.some(t => t.name === mentionName) ||
            projectFiles.some(f => f.name === mentionName) ||
            projectFolders.some(f => f.name === mentionName);

          if (isValidMention) {
            e.preventDefault();
            const start = cursor - match[0].length;
            const newValue = value.substring(0, start) + value.substring(cursor);
            ai.setPrompt(newValue);
            setTimeout(() => {
              textarea.setSelectionRange(start, start);
            }, 0);
            return;
          }
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (ai.prompt.trim() || attachments.length > 0) handleSend();
    }
  };

  // @mention highlight overlay — tables (blue), files (emerald), folders (amber)
  const renderPromptDisplay = () => {
    const parts = ai.prompt.split(/(@[a-zA-Z_@][a-zA-Z0-9_.\-]*)/);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1);
        const isTable = schema?.tables.some(t => t.name === name);
        const isFile = projectFiles.some(f => f.name === name);
        const isFolder = projectFolders.some(f => f.name === name);

        if (isTable || isFile || isFolder) {
            const bgClass = isFile
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
              : isFolder
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/50 text-amber-600 dark:text-amber-400'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50 text-blue-600 dark:text-blue-400';
            
            const Icon = isFile ? FileText : isFolder ? FolderOpen : Database;
            const clickHandler = isTable
              ? (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onNavigateToTable?.(name); }
              : undefined;

            return (
              <span key={i} className="relative inline-block">
                {/* 
                  INVISIBLE SPACER: 
                  Ensures following text stays perfectly aligned with the textarea.
                */}
                <span className="invisible select-none" aria-hidden="true">{part}</span>
                
                {/* 
                  THE PILL: 
                  Aligned LEFT-0 to match the start of the spacer.
                  Icon is in a w-0 container so it doesn't push the @ text.
                */}
                <span
                  className={cn(
                      "absolute left-0 top-1/2 -translate-y-[calc(50%+1px)] flex items-center",
                      "rounded-md border text-[13px] font-medium transition-colors outline-none whitespace-nowrap px-1",
                      bgClass,
                      clickHandler ? 'cursor-pointer hover:bg-opacity-80 pointer-events-auto' : ''
                  )}
                  onClick={clickHandler}
                  style={{ marginLeft: '-18px' }}
                >
                  <Icon className="w-3.5 h-3.5 mr-1 shrink-0" />
                  <span>{part}</span>
                </span>
              </span>
            );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderPanelHeader = (type: 'chat' | 'history') => {
    if (!compact) return null;
    
    return (
      <div className="flex items-center justify-between h-9 px-1 border-b bg-background shrink-0">
        <div className="flex items-center gap-0.5 h-full ml-1">
          <div 
            className={cn(
              "flex items-center h-full px-2 border-b text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
              type === 'chat' ? "border-primary text-foreground" : "border-transparent text-muted-foreground/60 hover:text-foreground"
            )}
            onClick={() => setActiveView('chat')}
          >
            Chat
          </div>
          <div 
            className={cn(
              "flex items-center h-full px-2 border-b text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
              type === 'history' ? "border-primary text-foreground" : "border-transparent text-muted-foreground/60 hover:text-foreground"
            )}
            onClick={() => setActiveView('history')}
          >
            History
          </div>
        </div>
        <div className="flex items-center gap-0">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-foreground" onClick={ai.startNewChat}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] font-bold">New chat</TooltipContent>
            </Tooltip>

            <div className="w-px h-3 bg-border mx-1" />
            
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-foreground" onClick={onClose}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] font-bold">Close panel</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/*
           DETERMINING LAYOUT MODE 
           Compact Mode (SQL Sidebar): Integrated Single Column (Copilot)
           Full Mode (Data Explorer): Split View (ChatGPT)
        */}
        {compact ? (
          /* INTEGRATED VIEW (Panel Mode) */
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            {renderPanelHeader(activeView)}
            <div className="flex-1 overflow-hidden relative min-w-0">
              {activeView === 'history' ? (
                <ConversationHistorySidebar
                  sessions={sessions}
                  activeChatId={ai.state.chatId}
                  isLoading={historyLoading}
                  onNewChat={ai.startNewChat}
                  onSelectChat={handleSelectChat}
                  onDeleteChat={handleDeleteChat}
                  loadMessages={loadMessages}
                  onViewChat={() => setActiveView('chat')}
                />
              ) : (
                <div className="flex flex-col h-full overflow-hidden min-w-0">
                  <AIChatMessages
                    history={ai.state.history}
                    streamingText={ai.state.text}
                    artifacts={ai.state.artifacts}
                    steps={ai.state.steps}
                    planSteps={ai.state.planSteps}
                    intent={ai.state.intent}
                    isLoading={ai.state.loading}
                    error={ai.state.error}
                    onApplySQL={ai.applySQL}
                    todoList={ai.state.todoList}
                    streamingSQL={ai.state.streamingSQL}
                    clarification={ai.state.clarification}
                    warnings={ai.state.warnings}
                    stopped={ai.state.stopped}
                    onAnswerClarification={ai.answerClarification}
                    onDismissClarification={() => ai.setState(prev => ({ ...prev, clarification: null }))}
                    onClearStreamingSQL={ai.clearStreamingSQL}
                    liveThinking={ai.state.liveThinking}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* FULL VIEW (Data Explorer Mode) */
          /* In this mode, the Sidebar is provided by the parent layout.
             So we only render the Chat Messages area here. */
          <div className="flex-1 overflow-hidden flex flex-col h-full min-w-0">
            <div className="flex-1 overflow-hidden">
              <div className="max-w-5xl mx-auto w-full h-full min-w-0 overflow-hidden">
                <AIChatMessages
                  history={ai.state.history}
                  streamingText={ai.state.text}
                  artifacts={ai.state.artifacts}
                  steps={ai.state.steps}
                  planSteps={ai.state.planSteps}
                  intent={ai.state.intent}
                  isLoading={ai.state.loading}
                  error={ai.state.error}
                  onApplySQL={ai.applySQL}
                  todoList={ai.state.todoList}
                  streamingSQL={ai.state.streamingSQL}
                  clarification={ai.state.clarification}
                  warnings={ai.state.warnings}
                  stopped={ai.state.stopped}
                  onAnswerClarification={ai.answerClarification}
                  onDismissClarification={() => ai.setState(prev => ({ ...prev, clarification: null }))}
                  onClearStreamingSQL={ai.clearStreamingSQL}
                  liveThinking={ai.state.liveThinking}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-background relative shrink-0">
        <DictationOverlay
          isRecording={isListening}
          audioLevel={audioLevel}
          onCancel={() => cancelListening()}
          onConfirm={handleDictationConfirm}
          onAddContext={handleMediaClick}
        />

        <AttachmentPreviewList
          attachments={attachments}
          onRemove={removeAttachment}
          onClick={handleAttachmentClick}
        />

        <div className={cn(
          'flex flex-col border rounded-xl bg-background shadow-sm transition-colors',
          'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
        )}>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.sql,.txt,.json"
          />

          {/* Quota Exhaustion Banner */}
          {quotaError && (
            <div className="flex items-start gap-2 mb-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200 mx-2 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span className="flex-1 leading-relaxed">{quotaError}</span>
              <button
                 onClick={() => window.open('/settings', '_self')}
                 className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-100 transition-colors whitespace-nowrap"
              >
                 View plans
              </button>
            </div>
          )}

          {/* Quota Warning Banner */}
          {!quotaError && quotaWarning && !warningDismissed && (
            <div className={`flex items-start gap-2 mb-2 rounded-xl px-3 py-2 text-xs border mx-2 mt-2 ${
                quotaWarning.level === 'critical'
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50 text-orange-800 dark:text-orange-200'
                    : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800/40 text-yellow-800 dark:text-yellow-200'
            }`}>
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    quotaWarning.level === 'critical' ? 'text-orange-500' : 'text-yellow-500'
                }`} />
                <span className="flex-1 leading-relaxed">{quotaWarning.message}</span>
                <button
                    onClick={() => window.open('/settings', '_self')}
                    className="shrink-0 font-medium underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
                >
                    Upgrade
                </button>
                <button
                    onClick={() => setWarningDismissed(true)}
                    className="shrink-0 ml-0.5 opacity-40 hover:opacity-80 transition-opacity"
                    title="Dismiss"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
          )}

          {/* Textarea with @mention overlay */}
          <div className="relative cursor-text">
            <Textarea
              ref={textareaRef}
              value={ai.prompt}
              placeholder={
                quotaError
                  ? 'Credit limit reached — upgrade to continue'
                  : hasSchema
                    ? 'Ask AI about your schema, SQL, or workspace files…'
                    : 'Ask AI to plan, create, or edit workspace files…'
              }
              disabled={ai.state.loading}
              className={cn(
                'min-h-[36px] max-h-[300px] text-sm leading-relaxed font-sans resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent px-3 py-2 overflow-y-auto scrollbar-thin z-0',
                ai.prompt ? 'text-transparent caret-foreground' : ''
              )}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
            />
            {ai.prompt && (
              <div
                className="absolute inset-0 px-3 py-2 text-sm leading-relaxed font-sans pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                aria-hidden="true"
              >
                {renderPromptDisplay()}
              </div>
            )}

            {/* Unified @mention autocomplete — files → tables → folders */}
            <MentionAutocomplete
              items={filteredMentionItems}
              mentionSearch={mentionSearch}
              mentionIndex={mentionIndex}
              onSelect={handleMentionSelect}
            />
          </div>

          <InputToolbar
            hasSchema={!!hasSchema}
            aiLoading={ai.state.loading}
            quotaExhausted={!!quotaError}
            aiPrompt={ai.prompt}
            attachmentsCount={attachments.length}
            isListening={isListening}
            isEnhancing={isEnhancing}
            compact={compact}
            selectedModel={ai.selectedModel}
            allowedModels={allowedModels}
            contextPct={ai.state.contextPct}
            contextTokens={ai.state.contextTokens}
            contextLimit={ai.state.contextLimit}
            onMediaClick={handleMediaClick}
            onStartListening={startListening}
            onEnhancePrompt={handleEnhancePrompt}
            onSend={handleSend}
            onStop={ai.abort}
            onModelChange={ai.setSelectedModel}
          />
        </div>
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={!!viewingAttachment} onOpenChange={open => !open && setViewingAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              {viewingAttachment?.preview ? <ImageIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
              {viewingAttachment?.file.name}
            </DialogTitle>
            <DialogDescription className="text-[10px]">
              {(viewingAttachment?.file.size || 0) / 1024 > 1024
                ? `${((viewingAttachment?.file.size || 0) / 1024 / 1024).toFixed(2)} MB`
                : `${((viewingAttachment?.file.size || 0) / 1024).toFixed(2)} KB`}
              {' • '}{viewingAttachment?.file.type || 'Unknown type'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/20 rounded-lg p-4 mt-2 border">
            {viewingAttachment?.preview ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <img src={viewingAttachment.preview} alt={viewingAttachment.file.name} className="max-w-full h-auto rounded shadow-lg" />
              </div>
            ) : viewingAttachment?.content ? (
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{viewingAttachment.content}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground italic">
                Preview not available for this file type.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
