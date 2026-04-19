/**
 * ClarificationDialog
 *
 * Modal shown when the agent asks a clarifying question.
 * Shows the question, context, suggestion buttons, and a free-text input.
 */

import { useState, memo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HelpCircle, Send } from 'lucide-react';
import type { ClarificationEvent } from '@/lib/ai-client/types';

interface ClarificationDialogProps {
  clarification: ClarificationEvent;
  onAnswer: (answer: string) => void;
  onDismiss: () => void;
}

export const ClarificationDialog = memo(function ClarificationDialog({
  clarification,
  onAnswer,
  onDismiss,
}: ClarificationDialogProps) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (answer.trim()) {
      onAnswer(answer.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (s: string) => {
    onAnswer(s);
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
      {/* Header */}
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            {clarification.question}
          </p>
          {clarification.context && (
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              {clarification.context}
            </p>
          )}
        </div>
      </div>

      {/* Suggestion buttons */}
      {clarification.suggestions && clarification.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {clarification.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-1.5">
        <textarea
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          rows={1}
          className="flex-1 text-[10px] bg-transparent outline-none placeholder:text-muted-foreground/35 px-2 py-1.5 resize-none leading-relaxed border border-border/30 rounded-md focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[9px] text-muted-foreground hover:text-foreground px-2"
            onClick={onDismiss}
          >
            Skip
          </Button>
          <Button
            size="sm"
            className={cn(
              "h-6 text-[9px] px-3",
              !answer.trim() && "opacity-50 cursor-not-allowed"
            )}
            disabled={!answer.trim()}
            onClick={handleSubmit}
          >
            <Send className="w-3 h-3 mr-1" />
            Answer
          </Button>
        </div>
      </div>
    </div>
  );
});
