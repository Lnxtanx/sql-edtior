/**
 * AgentStepList — Claude Code-style live execution trace
 * Steps appear inline one-by-one as they stream. No container box.
 */

import { useState } from 'react';
import { Check, Loader2, AlertCircle, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AgentStep } from './hooks/useAIAgent';
import type { PlanStep } from '@/lib/ai-client';

interface AgentStepListProps {
  steps:        AgentStep[];
  planSteps?:   PlanStep[];
  isLoading?:   boolean;
  intent?:      string | null;
  /** Live thinking text streaming in real-time during the LLM call */
  liveThinking?: string;
}

export function AgentStepList({ steps, planSteps = [], isLoading, intent, liveThinking = '' }: AgentStepListProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (steps.length === 0 && planSteps.length === 0 && !liveThinking) return null;

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-0 my-1 select-none">
      {/* Plan steps — compact, shown first */}
      {planSteps.length > 0 && (
        <div className="flex flex-col gap-0 mb-1">
          {planSteps.map((ps) => (
            <PlanRow key={ps.id} step={ps} />
          ))}
        </div>
      )}

      {/* Execution steps — thinking, tool calls, validation */}
      {steps.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              isExpanded={expandedSteps.has(step.id)}
              onToggle={() => toggleStep(step.id)}
            />
          ))}
        </div>
      )}

      {/* Live thinking — streams in real-time during the LLM call */}
      {liveThinking && (
        <div className="flex items-start gap-2 py-1.5 px-3 mx-1 animate-in fade-in duration-150">
          <span className="text-[10px] text-violet-400/60 mt-0.5 flex-shrink-0 select-none">◆</span>
          <span className="text-[11px] italic text-muted-foreground/55 leading-relaxed break-words flex-1">
            {liveThinking}
            <span className="inline-block w-[5px] h-[10px] ml-0.5 bg-violet-400/40 rounded-sm animate-pulse align-middle" />
          </span>
        </div>
      )}
    </div>
  );
}

// ── Plan row ───────────────────────────────────────────────────────────────────

function PlanRow({ step }: { step: PlanStep }) {
  const isDone    = step.status === 'done';
  const isRunning = step.status === 'running';
  const isError   = step.status === 'error';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 flex items-center gap-2 py-[3px] px-3 ml-1">
      <StatusIcon running={isRunning} done={isDone} error={isError} pending />
      <span className={cn(
        "text-[11px] leading-snug",
        isRunning  && "text-foreground/80 font-medium",
        isDone     && "text-muted-foreground/40",
        isError    && "text-red-500",
        !isRunning && !isDone && !isError && "text-muted-foreground/40",
      )}>
        {step.description || step.tool}
      </span>
    </div>
  );
}

// ── Execution step row ─────────────────────────────────────────────────────────

function StepRow({ 
  step, 
  isExpanded, 
  onToggle 
}: { 
  step: AgentStep; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isRunning = step.status === 'running';
  const isDone    = step.status === 'done';
  const isError   = step.status === 'error';

  const detail    = step.detail?.trim();
  const truncated = detail && detail.length > 60 ? detail.slice(0, 60) + '…' : detail;

  // Thinking: prose italics with subtle left accent
  if (step.type === 'thinking') {
    return (
      <div className={cn(
        "group flex flex-col rounded-lg border border-transparent transition-all duration-200 overflow-hidden mx-1",
        isExpanded ? "bg-muted/10 border-muted/20 my-0.5" : "hover:bg-muted/5"
      )}>
        {/* Header */}
        <div
          onClick={onToggle}
          className="flex items-center gap-2 py-1.5 px-2.5 cursor-pointer transition-colors"
        >
          <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>

          <span className="text-[10px] text-violet-400/50 flex-shrink-0 select-none">◆</span>

          <span className="text-[11px] font-medium text-muted-foreground/60 italic">
            Thinking…
          </span>

          {!isExpanded && truncated && (
            <span className="text-[10px] italic text-muted-foreground/40 truncate min-w-0 flex-1 ml-1 font-sans">
              {truncated}
            </span>
          )}
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-8 pb-3 pt-0.5">
                <div className="text-[11px] italic text-muted-foreground/70 leading-relaxed break-words whitespace-pre-wrap border-l border-muted/20 pl-3">
                  {detail}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn(
      "group flex flex-col rounded-lg border border-transparent transition-all duration-200 overflow-hidden mx-1",
      isExpanded ? "bg-muted/20 border-muted/30 my-0.5" : "hover:bg-muted/10"
    )}>
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2 py-1.5 px-2.5 cursor-pointer transition-colors"
      >
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        <StatusIcon running={isRunning} done={isDone} error={isError} />

        {/* Tool name */}
        <span className={cn(
          "text-[12px] font-medium shrink-0 leading-snug",
          isRunning && "text-foreground",
          isDone    && "text-muted-foreground/80",
          isError   && "text-red-500",
        )}>
          {step.label}
        </span>

        {/* Inline detail (lighter, truncated, only visible when collapsed) */}
        {!isExpanded && truncated && (
          <span className={cn(
            "text-[11px] font-mono truncate min-w-0 flex-1 ml-1 leading-snug",
            isRunning && "text-primary/50",
            isDone    && "text-muted-foreground/40",
            isError   && "text-red-400/50",
          )}>
            {truncated}
          </span>
        )}

        {/* Cache-hit or latency badge */}
        {step.latencyMs != null && !isExpanded && (
          step.latencyMs === 0 ? (
            <span className="text-[9px] text-sky-500/50 font-mono shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity tracking-tight">
              cached
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/30 font-mono tabular-nums shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {step.latencyMs}ms
            </span>
          )
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-9 pb-3 pt-1 space-y-2">
              {detail && (
                <div className="text-[11px] font-mono text-muted-foreground/80 break-words whitespace-pre-wrap leading-relaxed border-l-2 border-muted/30 pl-3">
                  {detail}
                </div>
              )}
              {step.latencyMs != null && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-mono uppercase tracking-tight">
                  {step.latencyMs === 0 ? (
                    <span className="text-sky-500/60">Cache hit</span>
                  ) : (
                    <>
                      <span>Duration:</span>
                      <span className="tabular-nums">{step.latencyMs}ms</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared status icon ─────────────────────────────────────────────────────────

function StatusIcon({
  running,
  done,
  error,
  pending = false,
}: {
  running:  boolean;
  done:     boolean;
  error:    boolean;
  pending?: boolean;
}) {
  return (
    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
      {done    && !error && <Check className="w-3.5 h-3.5 text-emerald-500/90" />}
      {error   && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
      {!running && !done && !error && pending && (
        <span className="w-2 h-2 rounded-full bg-muted-foreground/20 animate-pulse" />
      )}
    </span>
  );
}
