/**
 * ChatPreviewOverlay
 * A premium hover preview showing a snapshot of the conversation content.
 */

import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { SQLChatHistoryMessage } from './hooks/useSQLChatHistory';

interface ChatPreviewOverlayProps {
  isLoading?: boolean;
  messages: SQLChatHistoryMessage[];
  title: string;
}

export function ChatPreviewOverlay({ isLoading, messages, title }: ChatPreviewOverlayProps) {
  return (
    <div className="w-[320px] max-h-[400px] flex flex-col bg-popover/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100]">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <h4 className="text-xs font-bold text-foreground truncate">{title}</h4>
        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest opacity-60 font-medium">Session Snapshot</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            <div className="h-9 w-full rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-muted/20 animate-pulse" />
            <div className="h-9 w-3/4 rounded-xl bg-muted/40 animate-pulse" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground italic font-medium opacity-40">
            No session context available
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.slice(0, 4).map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div 
                  key={msg.id || idx} 
                  className={cn(
                    "text-[11px] leading-relaxed p-2.5 rounded-xl border border-transparent shadow-sm",
                    isAssistant 
                      ? "bg-background border-border/40 text-foreground font-medium" 
                      : "bg-muted/30 text-muted-foreground italic font-medium"
                  )}
                >
                  <pre className="whitespace-pre-wrap font-sans line-clamp-3">
                    {msg.content}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && messages.length > 4 && (
          <div className="pt-2 text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest opacity-30">
            + {messages.length - 4} more steps
          </div>
        )}
      </div>
    </div>
  );
}
