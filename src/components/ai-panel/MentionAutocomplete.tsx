/**
 * Mention Autocomplete
 * 
 * Unified dropdown for @mentions of database tables, files, and folders.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MentionItem {
    name: string;
    type: 'file' | 'folder' | 'table';
    icon: React.ComponentType<{ className?: string }>;
    meta?: string;
}

interface MentionAutocompleteProps {
    items: MentionItem[];
    mentionSearch: string | null;
    mentionIndex: number;
    onSelect: (item: MentionItem) => void;
}

export function MentionAutocomplete({
    items,
    mentionSearch,
    mentionIndex,
    onSelect
}: MentionAutocompleteProps) {
    if (mentionSearch === null) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute bottom-full left-0 right-0 mb-1 z-20"
            >
                <div className="bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                    {items.map((item, idx) => {
                        const Icon = item.icon;
                        const isSelected = idx === mentionIndex;
                        
                        // Clean, unified colors based on type
                        const typeStyles = item.type === 'file'
                            ? isSelected ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400" : "text-foreground"
                            : item.type === 'folder'
                                ? isSelected ? "bg-amber-600/10 text-amber-600 dark:text-amber-400" : "text-foreground"
                                : isSelected ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" : "text-foreground";

                        const iconColor = item.type === 'file' ? "text-emerald-500"
                            : item.type === 'folder' ? "text-amber-500"
                            : "text-blue-500";

                        return (
                            <div
                                key={`${item.type}-${item.name}`}
                                className={cn(
                                    "px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 transition-colors",
                                    typeStyles,
                                    !isSelected && "hover:bg-muted"
                                )}
                                onClick={() => onSelect(item)}
                            >
                                <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? iconColor : "text-muted-foreground/60")} />
                                <span className="flex-1 truncate font-normal">{item.name}</span>
                                {item.meta && (
                                    <span className={cn("text-[10px] tabular-nums", isSelected ? "opacity-70" : "text-muted-foreground/50")}>
                                        {item.meta}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {items.length === 0 && (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground italic text-center">
                            No matches found
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
