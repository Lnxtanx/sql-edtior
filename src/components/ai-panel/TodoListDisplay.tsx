/**
 * TodoListDisplay
 *
 * Renders the live TODO list from the agent.
 * Shows status: pending [ ], in_progress [→], done [✓], skipped [—].
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { TodoUpdateEvent } from '@/lib/ai-client/types';

interface TodoListDisplayProps {
  todo: TodoUpdateEvent;
  className?: string;
}

export const TodoListDisplay = memo(function TodoListDisplay({ todo, className }: TodoListDisplayProps) {
  if (!todo?.items?.length) return null;

  const pendingCount = todo.items.filter(i => i.status === 'pending' || i.status === 'in_progress').length;
  const doneCount = todo.items.filter(i => i.status === 'done').length;
  const allDone = todo.items.length > 0 && pendingCount === 0;

  return (
    <div className={cn("flex flex-col gap-0.5 select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-0.5">
        <span className="text-[9px] font-semibold text-foreground/50 uppercase tracking-wider">
          {allDone ? 'All tasks complete' : `${pendingCount} task${pendingCount !== 1 ? 's' : ''} remaining`}
        </span>
        {doneCount > 0 && (
          <span className="text-[8px] text-muted-foreground/30">
            {doneCount}/{todo.items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-px">
        {todo.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 transition-colors",
              item.status === 'done' && "opacity-40",
              item.status === 'in_progress' && "",
              item.status === 'skipped' && "opacity-30",
            )}
          >
            {/* Status dot */}
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              item.status === 'done' && "bg-green-500/60",
              item.status === 'in_progress' && "bg-amber-500 animate-pulse",
              item.status === 'pending' && "bg-muted-foreground/20",
              item.status === 'skipped' && "bg-muted-foreground/10",
            )} />

            {/* Text */}
            <span className={cn(
              "text-[10px] leading-tight",
              item.status === 'done' && "text-muted-foreground/40 line-through",
              item.status === 'in_progress' && "text-foreground/70 font-medium",
              item.status === 'pending' && "text-muted-foreground/40",
              item.status === 'skipped' && "text-muted-foreground/20 line-through",
            )}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
