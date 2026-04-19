import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIModels } from '@/hooks/useAIUsage';

interface ModelSelectorProps {
    selectedModel: string;
    allowedModels?: string[];
    onModelChange: (model: string) => void;
    disabled?: boolean;
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    color: string;
    tier: string;
    multiplier: string;
    creditRate: number;
}

const TIER_ORDER = ['Powerful', 'Advanced', 'Smart', 'Fast', 'Free'] as const;

function shortLabel(name: string): string {
    return name
        .replace(/^Claude\s+/i, '')
        .replace(/^GPT-/i, '')
        .replace(/^Gemini\s+/i, '')
        .replace(/^DeepSeek\s+/i, 'DS ')
        .replace(/^Llama\s+/i, '')
        .replace(/\s+mini$/i, ' Mini')
        .replace(/\s+Lite$/i, ' Lite')
        .trim();
}

export function ModelSelector({
    selectedModel,
    allowedModels,
    onModelChange,
    disabled = false,
}: ModelSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { models } = useAIModels();

    const options: ModelOption[] = useMemo(() => {
        const filtered = allowedModels?.length
            ? models.filter(model => allowedModels.includes(model.id))
            : models;

        if (filtered.length > 0) return filtered;

        return (allowedModels ?? []).map(id => ({
            id,
            name: id.split('/').pop() ?? id,
            provider: 'Unknown',
            color: '#888888',
            tier: 'Available',
            multiplier: '1x',
            creditRate: 0,
        }));
    }, [allowedModels, models]);

    // Group models by tier
    const grouped = useMemo(() => {
        const map: Record<string, ModelOption[]> = {};
        for (const m of options) {
            if (!map[m.tier]) map[m.tier] = [];
            map[m.tier].push(m);
        }
        return map;
    }, [options]);

    const current = options.find(model => model.id === selectedModel) ?? options[0] ?? {
        id: selectedModel,
        name: selectedModel,
        provider: 'Unknown',
        color: '#888888',
        tier: 'Available',
        multiplier: '1x',
        creditRate: 0,
    };

    const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        if (current?.tier) {
            initial[current.tier] = true;
        }
        return initial;
    });

    const toggleTier = (tier: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedTiers(prev => ({
            ...prev,
            [tier]: !prev[tier]
        }));
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (open && current?.tier) {
            setExpandedTiers(prev => ({
                ...prev,
                [current.tier]: true
            }));
        }
    }, [open, current?.tier]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors',
                    'bg-muted/30 border border-transparent hover:border-border text-foreground',
                    disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
            >
                <span className="truncate max-w-[80px]">{shortLabel(current.name)}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{current.multiplier}</span>
                <ChevronDown className="w-3 h-3 shrink-0 ml-0.5" />
            </button>

            {open && (
                <div className="absolute bottom-full mb-1 right-0 w-64 rounded-lg border border-border bg-popover shadow-xl z-50 py-1.5 text-xs overflow-y-auto max-h-[400px]">
                    {TIER_ORDER.filter(tier => grouped[tier]?.length > 0).map(tier => {
                        const isExpanded = expandedTiers[tier];
                        return (
                            <div key={tier} className="mb-px last:mb-0">
                                <button
                                    type="button"
                                    onClick={(e) => toggleTier(tier, e)}
                                    className="w-full flex items-center justify-between px-3 py-1.5 text-muted-foreground hover:bg-muted/30 transition-colors"
                                >
                                    <span className="text-[9px] font-semibold uppercase tracking-wider">
                                        {tier}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="py-0.5">
                                        {grouped[tier].map(model => {
                                            const isSelected = model.id === selectedModel;
                                            return (
                                                <button
                                                    key={model.id}
                                                    type="button"
                                                    onClick={() => {
                                                        onModelChange(model.id);
                                                        setOpen(false);
                                                    }}
                                                    className={cn(
                                                        'w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors cursor-pointer',
                                                        'hover:bg-muted/60 text-foreground',
                                                        isSelected && 'bg-muted/40 font-medium'
                                                    )}
                                                >
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="truncate leading-snug">{model.name}</div>
                                                        <div className="text-[10px] text-muted-foreground truncate leading-tight">
                                                            {model.provider}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <span className="text-[10px] font-mono text-muted-foreground/80">
                                                            {model.multiplier}
                                                        </span>
                                                        {isSelected ? (
                                                            <Check className="w-3 h-3 text-primary" />
                                                        ) : (
                                                            <div className="w-3 h-3" />
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
