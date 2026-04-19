/**
 * AIChangeReviewPanel
 *
 * Floating panel that appears when the AI proposes file changes.
 * Shows each proposed change as a diff with Accept / Reject controls.
 * Similar to Cursor's inline change review.
 */

import { useState, memo } from 'react';
import { Check, X, ChevronDown, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SqlDiffViewer } from '@/components/sql-diff/SqlDiffViewer';

export interface ProposedChange {
    /** File identifier (node_id or path) */
    nodeId: string;
    fileName: string;
    /** Original content before the AI's proposed change */
    originalContent: string;
    /** The AI's proposed new content */
    proposedContent: string;
    /** Human-readable summary of what changed */
    summary: string;
}

interface AIChangeReviewPanelProps {
    changes: ProposedChange[];
    onAccept: (nodeId: string, mergedContent: string) => void;
    onReject: (nodeId: string) => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    onClose: () => void;
}

export const AIChangeReviewPanel = memo(function AIChangeReviewPanel({
    changes,
    onAccept,
    onReject,
    onAcceptAll,
    onRejectAll,
    onClose,
}: AIChangeReviewPanelProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['0']));
    const [acceptedFiles, setAcceptedFiles] = useState<Set<string>>(new Set());

    const totalChanges = changes.length;
    const acceptedCount = acceptedFiles.size;

    const toggleFile = (idx: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const handleAcceptFile = (idx: number, mergedContent: string) => {
        const change = changes[idx];
        onAccept(change.nodeId, mergedContent);
        setAcceptedFiles(prev => new Set([...prev, String(idx)]));
    };

    const handleRejectFile = (idx: number) => {
        const change = changes[idx];
        onReject(change.nodeId);
        setExpandedFiles(prev => {
            const next = new Set(prev);
            next.delete(String(idx));
            return next;
        });
    };

    const isAllAccepted = acceptedCount === totalChanges;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-semibold text-foreground">
                        {isAllAccepted ? 'All changes accepted' : `${totalChanges} proposed change${totalChanges !== 1 ? 's' : ''}`}
                    </span>
                    {acceptedCount > 0 && (
                        <span className="text-[9px] text-muted-foreground/60">
                            ({acceptedCount}/{totalChanges} accepted)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {!isAllAccepted && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[9px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-1.5"
                                onClick={onRejectAll}
                            >
                                <X className="w-3 h-3 mr-1" />
                                Reject All
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[9px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 px-1.5"
                                onClick={onAcceptAll}
                            >
                                <Check className="w-3 h-3 mr-1" />
                                Accept All
                            </Button>
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        onClick={onClose}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Change list */}
            <div className="flex-1 overflow-y-auto">
                {changes.map((change, idx) => {
                    const isExpanded = expandedFiles.has(String(idx));
                    const isAccepted = acceptedFiles.has(String(idx));

                    return (
                        <div key={idx} className={cn(
                            "border-b border-border/30 transition-colors",
                            isAccepted && "bg-green-500/5",
                        )}>
                            {/* File header */}
                            <button
                                onClick={() => toggleFile(String(idx))}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                            >
                                <span className="text-muted-foreground/40">
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </span>
                                <FileText className={cn(
                                    "w-3 h-3 shrink-0",
                                    isAccepted ? "text-green-500" : "text-muted-foreground/50"
                                )} />
                                <div className="min-w-0 flex-1">
                                    <p className={cn(
                                        "text-[10px] font-medium truncate",
                                        isAccepted ? "text-green-600" : "text-foreground/80"
                                    )}>
                                        {change.fileName}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground/40 truncate">
                                        {change.summary}
                                    </p>
                                </div>
                                {isAccepted && (
                                    <span className="text-[8px] text-green-500 font-medium uppercase tracking-wider shrink-0">
                                        Accepted
                                    </span>
                                )}
                            </button>

                            {/* Diff viewer */}
                            {isExpanded && !isAccepted && (
                                <div className="border-t border-border/20">
                                    <div className="h-[300px]">
                                        <SqlDiffViewer
                                            original={change.originalContent}
                                            modified={change.proposedContent}
                                            layout="unified"
                                            enableMergeControls
                                            onAcceptAll={(merged) => handleAcceptFile(idx, merged)}
                                        />
                                    </div>
                                    {/* Per-file actions */}
                                    <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 bg-muted/20 border-t border-border/20">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[9px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-1.5"
                                            onClick={() => handleRejectFile(idx)}
                                        >
                                            <X className="w-3 h-3 mr-1" />
                                            Reject
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[9px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 px-1.5"
                                            onClick={() => handleAcceptFile(idx, change.proposedContent)}
                                        >
                                            <Check className="w-3 h-3 mr-1" />
                                            Accept
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
