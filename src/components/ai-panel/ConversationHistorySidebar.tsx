import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  RotateCcw, 
  Search, 
  Settings2, 
  PanelLeftClose, 
  MoreHorizontal,
  X,
  Plus,
  MessageSquare,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import type { SQLChatSessionSummary, SQLChatHistoryMessage } from './hooks/useSQLChatHistory';
import { ChatPreviewOverlay } from './ChatPreviewOverlay';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConversationHistorySidebarProps {
  sessions: SQLChatSessionSummary[];
  activeChatId?: string | null;
  isLoading?: boolean;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onViewChat?: () => void; // Switch back to active chat
  loadMessages?: (chatId: string) => Promise<{ messages: SQLChatHistoryMessage[] }>;
}

export function ConversationHistorySidebar({
  sessions,
  activeChatId,
  isLoading = false,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onViewChat,
  loadMessages,
}: ConversationHistorySidebarProps) {
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [previewMessages, setPreviewMessages] = useState<SQLChatHistoryMessage[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (chatId: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    hoverTimeoutRef.current = setTimeout(async () => {
      setHoveredSessionId(chatId);
      if (loadMessages) {
        setIsPreviewLoading(true);
        try {
          const result = await loadMessages(chatId);
          setPreviewMessages(result.messages);
        } catch (e) {
          console.error('Failed to load preview:', e);
        } finally {
          setIsPreviewLoading(false);
        }
      }
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredSessionId(null);
    setPreviewMessages([]);
  };

  return (
    <div className="flex h-full w-full flex-col bg-background relative select-none animate-in slide-in-from-left-1 duration-300">
      {/* Sub Header: Sessions list controller - Exact Copilot colors */}
      <div className="flex items-center justify-between px-3 h-8 bg-muted/5 border-b border-border/40 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Sessions</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0 p-1">
          {isLoading && (
            <div className="px-3 py-4 text-xs text-muted-foreground/50 animate-pulse italic">Connecting...</div>
          )}

          {!isLoading && sessions.length === 0 && (
            <div className="px-3 py-6">
              <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tight pl-1">No recent chats</p>
            </div>
          )}

          {sessions.map(session => {
            const isActive = activeChatId === session.id;
            const isHovered = hoveredSessionId === session.id;

            return (
              <div
                key={session.id}
                className="relative group"
                onMouseEnter={() => handleMouseEnter(session.id)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-md transition-all duration-150 border border-transparent flex items-start gap-2',
                    isActive 
                        ? 'bg-muted/40 border-border/40 shadow-sm' 
                        : 'hover:bg-muted/10'
                  )}
                  onClick={() => onSelectChat(session.id)}
                >
                  {/* Status Indicator Dot - Solid Bright Blue */}
                  <div className="mt-[5px] shrink-0">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isActive ? 'bg-[#007acc]' : 'bg-muted-foreground/10'
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "truncate text-xs font-medium tracking-tight h-5 flex items-center",
                      isActive ? "text-foreground" : "text-foreground/70 group-hover:text-foreground"
                    )}>
                      {session.title || 'Untitled Session'}
                    </div>
                    {/* Path/Project Context - Professional Gray */}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                        <span className="truncate">schema-weaver</span>
                        <span className="opacity-50">•</span>
                        <span className="shrink-0">{formatTimestamp(session.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Quick Action Button - Very subtle */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground/40 hover:text-destructive hover:bg-transparent"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(session.id);
                        }}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                  </div>
                </button>

                {/* Hover Preview Overlay - Use Portal to prevent clipping by ScrollArea */}
                {isHovered && createPortal(
                    <div 
                      className="fixed top-24 left-[256px] pointer-events-none animate-in slide-in-from-left-1 duration-200 z-[1000] drop-shadow-2xl"
                      style={{ 
                        // Ensure it stays within viewport height
                        maxHeight: 'calc(100vh - 120px)',
                        display: 'flex'
                      }}
                    >
                        <ChatPreviewOverlay 
                            title={session.title || 'Session Preview'}
                            isLoading={isPreviewLoading}
                            messages={previewMessages}
                        />
                    </div>,
                    document.body
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer: More Section - Exact Mock Style */}
      {sessions.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
              <span className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1">
                More <ChevronDown className="w-3 h-3" />
              </span>
              <span className="opacity-60">{sessions.length}</span>
          </div>
      )}
    </div>
  );
}

function formatTimestamp(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
