/**
 * SQL Editor Toolbar
 * 
 * Actions bar with Format, Generate, Copy, and Clear buttons.
 */

import { Button } from '@/components/ui/button';
import { Play, Copy, Wand2, Eraser } from 'lucide-react';

export interface SqlEditorToolbarProps {
    /** Whether SQL content exists */
    hasSql: boolean;
    /** Whether processing is in progress */
    isProcessing: boolean;
    /** Whether in read-only mode (viewer role) */
    isReadOnly?: boolean;
    /** Format the SQL */
    onFormat: () => void;
    /** Generate/Parse schema */
    onGenerate: () => void;
    /** Copy to clipboard */
    onCopy: () => void;
    /** Clear content */
    onClear: () => void;
    /** Optional: Open AI panel */
    onOpenAI?: () => void;
}

export function SqlEditorToolbar({
    hasSql,
    isProcessing,
    isReadOnly = false,
    onFormat,
    onGenerate,
    onCopy,
    onClear,
    onOpenAI,
}: SqlEditorToolbarProps) {
    return (
        <div className="flex gap-1 items-center">
            <Button
                variant="outline"
                onClick={onFormat}
                disabled={!hasSql || isReadOnly}
                className="h-7 text-[10px] px-2"
                size="sm"
                title={isReadOnly ? "You don't have permission to format" : "Format SQL and check for issues"}
            >
                <Wand2 className="w-3 h-3 mr-1" />
                Format
            </Button>

            <Button
                variant="outline"
                onClick={onGenerate}
                disabled={isProcessing || !hasSql || isReadOnly}
                className="flex-1 h-7 text-[10px]"
                size="sm"
                title={isReadOnly ? "You don't have permission to generate" : undefined}
            >
                <Play className="w-3 h-3 mr-1" />
                {isProcessing ? 'Processing...' : 'Generate'}
            </Button>

            <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onCopy}
                disabled={!hasSql}
                title="Copy SQL"
            >
                <Copy className="w-3 h-3" />
            </Button>

            <Button
                variant="ghost"
                onClick={onClear}
                disabled={!hasSql || isReadOnly}
                size="sm"
                className="h-7 w-7 p-0 hover:text-destructive transition-colors"
                title={isReadOnly ? "You don't have permission to clear" : "Clear"}
            >
                <Eraser className="w-3 h-3" />
            </Button>

            {onOpenAI && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 ml-1 gap-2 text-xs font-semibold border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/40 transition-all shadow-sm group"
                    onClick={onOpenAI}
                    title="Resona AI"
                >
                    <img 
                        src="/resona.png" 
                        alt="Resona" 
                        className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 filter drop-shadow-sm" 
                    />
                    Resona AI
                </Button>
            )}
        </div>
    );
}
