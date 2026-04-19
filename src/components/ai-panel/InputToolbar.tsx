/**
 * Input Toolbar
 * Bottom toolbar: add context, enhance prompt, mic, model selector, send.
 * No preset buttons — presets removed.
 */

import { Button }                    from '@/components/ui/button';
import { Sparkles, Mic, Send, Square } from 'lucide-react';
import { cn }                   from '@/lib/utils';
import { AddContextPopover }    from './AddContextPopover';
import { ModelSelector }        from './ModelSelector';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InputToolbarProps {
  hasSchema:     boolean;
  aiLoading:     boolean;
  aiPrompt:      string;
  attachmentsCount: number;
  isListening:   boolean;
  compact:       boolean;
  isEnhancing?:  boolean;
  quotaExhausted?: boolean;
  selectedModel?: string;
  allowedModels?: string[];

  /** Context window usage 0-100 — shown as thin bar above toolbar */
  contextPct?:   number;
  contextTokens?: number;
  contextLimit?:  number;
  onMediaClick:       () => void;
  onStartListening:   () => void;
  onEnhancePrompt:    () => void;
  onSend:             () => void;
  onStop?:            () => void;
  onModelChange?:     (model: string) => void;
}

export function InputToolbar({
  hasSchema,
  aiLoading,
  aiPrompt,
  attachmentsCount,
  isListening,
  isEnhancing = false,
  quotaExhausted = false,
  selectedModel = 'gpt-4o-mini',
  allowedModels,
  contextPct = 0,
  contextTokens = 0,
  contextLimit = 128_000,
  onMediaClick,
  onStartListening,
  onEnhancePrompt,
  onSend,
  onStop,
  onModelChange,
}: InputToolbarProps) {
  const canSend = !aiLoading && !quotaExhausted && (aiPrompt.trim().length > 0 || attachmentsCount > 0);

  return (
    <div className="flex flex-col">
    <div className="flex items-center justify-between px-2 pb-1.5">
      {/* Left: context + enhance + mic */}
      <div className="flex items-center gap-0.5">
        <AddContextPopover
          onMediaClick={onMediaClick}
          onMentionClick={() => {}}
          onWorkspaceClick={() => {}}
          disabled={aiLoading}
        />

        <TooltipProvider delayDuration={0}>
          {/* Enhance prompt */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 text-muted-foreground hover:text-foreground mr-1 transition-colors',
                  isEnhancing && 'text-violet-500 animate-pulse'
                )}
                onClick={onEnhancePrompt}
                disabled={aiLoading || isEnhancing || !aiPrompt.trim()}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-bold">Enhance prompt</TooltipContent>
          </Tooltip>

          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 text-muted-foreground hover:text-foreground mr-1 transition-colors',
                  isListening && 'text-red-500 hover:text-red-600 bg-red-50'
                )}
                onClick={onStartListening}
                disabled={aiLoading || isListening}
              >
                <Mic className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-bold">Dictate</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right: model selector + send */}
      <div className="flex items-center gap-1">
        {/* Quota removed from input area as requested */}
        <ModelSelector
          selectedModel={selectedModel}
          allowedModels={allowedModels}
          onModelChange={onModelChange ?? (() => {})}
          disabled={aiLoading}
        />

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {aiLoading ? (
                <Button
                  size="icon"
                  className="h-6 w-6 rounded-lg ml-0.5 bg-red-500 hover:bg-red-600 text-white border-0"
                  onClick={onStop}
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-6 w-6 rounded-lg ml-0.5"
                  disabled={!canSend}
                  onClick={onSend}
                >
                  <Send className="w-3 h-3" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-bold">
              {aiLoading ? 'Stop' : 'Send message'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
    </div>
  );
}
