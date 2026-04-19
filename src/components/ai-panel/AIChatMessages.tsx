/**
 * AI Chat Messages
 * Displays streaming chat history + current response + artifacts.
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button }     from '@/components/ui/button';
import { AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Terminal, Copy, Play } from 'lucide-react';
import { cn }         from '@/lib/utils';
import { useRef, useEffect, useCallback, useState } from 'react';
import type { ChatMessage, ArtifactItem, PlanStep, TodoUpdateEvent, ClarificationEvent } from '@/lib/ai-client';
import type { AgentStep } from './hooks/useAIAgent';
import { AgentStepList } from './AgentStepList';
import { MarkdownText } from './MarkdownText';
import { TodoListDisplay } from './TodoListDisplay';
import { ClarificationDialog } from './ClarificationDialog';

export interface AIChatMessagesProps {
  history:       ChatMessage[];
  streamingText: string;
  artifacts:     ArtifactItem[];
  steps:         AgentStep[];
  planSteps:     PlanStep[];
  intent:        string | null;
  isLoading:     boolean;
  error:         string | null;
  onApplySQL?:   (sql: string) => void;

  // New agent features
  todoList?:     TodoUpdateEvent | null;
  streamingSQL?: string;
  clarification?: ClarificationEvent | null;
  warnings?:     { message: string; code?: string }[];
  stopped?:      { message: string; partialResults?: string } | null;
  onAnswerClarification?: (answer: string) => void;
  onDismissClarification?: () => void;
  onClearStreamingSQL?: () => void;

  /** Live thinking text streaming in real-time (Gap 4) */
  liveThinking?: string;
}

export function AIChatMessages({
  history,
  streamingText,
  artifacts,
  steps,
  planSteps,
  intent,
  isLoading,
  error,
  onApplySQL,
  todoList,
  streamingSQL,
  clarification,
  warnings,
  stopped,
  onAnswerClarification,
  onDismissClarification,
  onClearStreamingSQL,
  liveThinking = '',
}: AIChatMessagesProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll on new content
  const scrollToBottom = useCallback(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, streamingText, artifacts, steps, planSteps, error, scrollToBottom]);

  // Attach scroll listener to Radix Viewport
  useEffect(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;

    // Force horizontal overflow-x hidden to prevent clipping issues
    viewport.style.overflowX = 'hidden';

    const handleViewportScroll = () => {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      autoScrollRef.current = isNearBottom;
    };

    viewport.addEventListener('scroll', handleViewportScroll);
    return () => viewport.removeEventListener('scroll', handleViewportScroll);
  }, []);

  const isEmpty = history.length === 0 && !streamingText && !isLoading && !error;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in duration-700">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse-subtle" />
          <img 
            src="/resona.png" 
            alt="Resona AI" 
            className="w-20 h-20 object-contain drop-shadow-2xl relative z-10" 
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground/60 max-w-[280px] leading-relaxed italic">
          How can I assist with your database today?
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col gap-2 px-3 py-3 pb-2 min-w-0 max-w-full overflow-hidden">

        {/* History messages */}
        {history.map((msg, i) => (
          <div key={i} className={cn(
            "w-full min-w-0 flex flex-col transition-opacity duration-300",
            msg.role === 'user' ? "py-2 first:pt-0" : "py-1 first:pt-0",
          )}>
             {/* Execution trace — full width, always left-aligned */}
             {msg.role === 'assistant' && msg.executionTrace && (
               <div className="w-full min-w-0">
                 <AgentStepList
                   steps={msg.executionTrace.steps}
                   planSteps={msg.executionTrace.planSteps}
                   isLoading={false}
                   intent={msg.executionTrace.intent}
                 />
               </div>
             )}

             <MessageBubble message={msg} />

             {msg.artifacts && msg.artifacts.length > 0 && (
               <div className="mt-2 flex flex-col gap-2 w-full min-w-0">
                 {msg.artifacts.map((artifact) => (
                   <ArtifactCard
                     key={artifact.id}
                     artifact={artifact}
                     onApplySQL={onApplySQL}
                   />
                 ))}
               </div>
             )}

             {msg.role === 'assistant' && msg.usage && msg.usage.creditsUsed > 0 && (
               <div className="py-1 pl-1">
                 <span className="text-[10px] text-muted-foreground/50">
                   Credits used: {formatNumber(msg.usage.creditsUsed)}
                 </span>
               </div>
             )}
          </div>
        ))}

        {/* TODO list - shown at top for visibility */}
        {todoList && todoList.items.length > 0 && (
          <div className="px-1 w-full min-w-0 sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-1">
            <TodoListDisplay todo={todoList} />
          </div>
        )}

        {/* Current streaming response and execution trace */}
        {(isLoading || steps.length > 0 || planSteps.length > 0 || liveThinking) && (
          <div className="px-1 w-full min-w-0">
            <AgentStepList
              steps={steps}
              planSteps={planSteps}
              isLoading={isLoading}
              intent={intent}
              liveThinking={liveThinking}
            />
          </div>
        )}

        {/* SQL streaming preview */}
        {streamingSQL && (
          <div className="px-1 w-full min-w-0">
            <div className="flex flex-col gap-1 p-2 bg-blue-500/5 border border-blue-500/20 rounded-md">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="text-[9px] font-semibold text-blue-500/80 uppercase tracking-wider">
                  Generating SQL...
                </span>
                {isLoading && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>
              <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto bg-muted/20 rounded p-1.5">
                {streamingSQL}
                {isLoading && (
                  <span className="inline-block w-1 h-3 bg-blue-500/60 ml-0.5 animate-pulse rounded-full align-middle" />
                )}
              </pre>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="px-1 w-full min-w-0 flex flex-col gap-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-500/20 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="text-[10px]">{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Clarification dialog */}
        {clarification && (
          <div className="px-1 w-full min-w-0">
            <ClarificationDialog
              clarification={clarification}
              onAnswer={onAnswerClarification ?? (() => {})}
              onDismiss={onDismissClarification ?? (() => {})}
            />
          </div>
        )}

        {/* Agent stopped */}
        {stopped && (
          <div className="px-1 w-full min-w-0">
            <div className="flex items-start gap-2 text-muted-foreground bg-muted/20 border border-border/30 rounded-md px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium">{stopped.message}</p>
                {stopped.partialResults && (
                  <p className="text-[9px] text-muted-foreground/40 mt-1">
                    Partial results were generated before stopping.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Minimal initial loading indicator before any steps arrive */}
        {isLoading && steps.length === 0 && planSteps.length === 0 && (
          <div className="flex items-center gap-1 px-1 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-[pulse_1.2s_ease-in-out_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-[pulse_1.2s_ease-in-out_0.2s_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/25 animate-[pulse_1.2s_ease-in-out_0.4s_infinite]" />
          </div>
        )}

        {streamingText && (
          <div className="py-2 px-1 last:border-0 flex flex-col items-start min-w-0 overflow-hidden w-full">
            <div className="w-full min-w-0 text-foreground/90 break-words">
              <MarkdownText content={streamingText} />
              {isLoading && (
                <span className="inline-block w-1.5 h-4 bg-primary/40 ml-1 animate-pulse rounded-full align-middle" />
              )}
            </div>
          </div>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {artifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onApplySQL={onApplySQL}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

const USER_COLLAPSE_THRESHOLD = 4; // number of lines before collapsing

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the full text to copy — include execution trace for assistant messages
  const getFullText = (): string => {
    if (isUser) return message.content;

    let text = '';

    // Include execution trace steps
    const trace = message.executionTrace;
    if (trace?.steps?.length) {
      for (const step of trace.steps) {
        switch (step.type) {
          case 'thinking':
            text += `${step.label}\n\n`;
            break;
          case 'tool_call':
            text += `🔧 Calling: ${step.label}`;
            if (step.detail) text += `\n${step.detail}`;
            text += '\n\n';
            break;
          case 'tool_result':
            text += `→ ${step.label}`;
            if (step.detail) text += `\n  ${step.detail}`;
            text += '\n\n';
            break;
          case 'sql_validation':
            text += `✅ SQL Validation: ${step.label}`;
            if (step.detail) text += `\n  ${step.detail}`;
            text += '\n\n';
            break;
        }
      }
    }

    // Include the final response text
    if (message.content) {
      text += message.content;
    }

    return text.trim();
  };

  const handleCopy = async () => {
    const text = getFullText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for browsers without clipboard API
    }
  };

  // Count lines for user messages to determine if collapse is needed
  const lineCount = isUser ? message.content.split('\n').length : 0;
  const shouldCollapse = isUser && lineCount > USER_COLLAPSE_THRESHOLD && !expanded;

  return (
    <div className={cn(
      "group relative w-full min-w-0 overflow-hidden transition-all duration-200 break-words",
      isUser
        ? "bg-muted/40 py-2.5 px-3 rounded-2xl text-foreground"
        : "text-foreground/90 py-1 px-1"
    )}>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          "absolute top-1.5 right-1.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10 bg-background/60 backdrop-blur-sm",
          "hover:bg-muted/80 active:scale-95",
          copied && "!opacity-100 !bg-green-500/10",
        )}
        title={copied ? "Copied!" : "Copy message"}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>

      {isUser ? (
        <div>
          <div
            className={cn(
              "whitespace-pre-wrap break-words font-sans text-sm min-w-0 leading-relaxed overflow-x-auto",
              shouldCollapse && "line-clamp-4"
            )}
          >
            {message.content}
          </div>
          {shouldCollapse && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
              Show more ({lineCount} lines)
            </button>
          )}
          {expanded && lineCount > USER_COLLAPSE_THRESHOLD && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
              Show less
            </button>
          )}
        </div>
      ) : (
        <MarkdownText content={message.content} className="text-sm min-w-0 overflow-hidden leading-relaxed max-w-full" />
      )}
    </div>
  );
}

// ── Artifact Card ──────────────────────────────────────────────────────────────

function ArtifactCard({
  artifact,
  onApplySQL,
}: {
  artifact:    ArtifactItem;
  onApplySQL?: (sql: string) => void;
}) {
  const isSQL = artifact.kind === 'sql' || artifact.kind === 'migration';

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content).catch(() => {});
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {artifact.title || artifact.kind}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy} title="Copy">
            <Copy className="w-2.5 h-2.5" />
          </Button>
          {isSQL && onApplySQL && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-green-600 hover:text-green-700"
              onClick={() => onApplySQL(artifact.content)}
              title="Apply to editor"
            >
              <Play className="w-2.5 h-2.5" />
            </Button>
          )}
        </div>
      </div>
      {/* Content */}
      <pre className="text-sm p-4 overflow-x-auto font-mono leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin">
        {artifact.content}
      </pre>
    </div>
  );
}
