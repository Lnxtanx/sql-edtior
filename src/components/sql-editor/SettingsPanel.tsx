/**
 * Settings Panel
 * 
 * A slide-up panel from the footer that shows keyboard shortcuts
 * and other settings. Contained within the parent SQL editor panel.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Keyboard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const KEYBOARD_SHORTCUTS = [
    // File operations
    {
        category: 'File', shortcuts: [
            { action: 'New File', keys: ['Ctrl', 'N'] },
            { action: 'Open Local File', keys: ['Ctrl', 'O'] },
            { action: 'Save', keys: ['Ctrl', 'S'] },
            { action: 'Rename File', keys: ['F2'] },
            { action: 'Delete File', keys: ['Ctrl', 'Shift', 'D'] },
        ]
    },
    // Editor operations
    {
        category: 'Editor', shortcuts: [
            { action: 'Run/Parse SQL', keys: ['Ctrl', 'Enter'] },
            { action: 'Format SQL', keys: ['Ctrl', 'Shift', 'F'] },
            { action: 'Copy SQL', keys: ['Ctrl', 'C'] },
            { action: 'Paste SQL', keys: ['Ctrl', 'V'] },
            { action: 'Undo', keys: ['Ctrl', 'Z'] },
            { action: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
        ]
    },
    // Navigation
    {
        category: 'Navigation', shortcuts: [
            { action: 'Toggle Fullscreen', keys: ['Ctrl', 'Shift', 'Enter'] },
            { action: 'Focus Table', keys: ['Ctrl', 'Click'] },
            { action: 'Open AI Assistant', keys: ['Ctrl', 'K'] },
        ]
    },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
            {/* Backdrop - contained within parent */}
            <div
                className="absolute inset-0 bg-black/10"
                onClick={onClose}
            />

            {/* Panel - slides up from bottom */}
            <div className="relative z-50 bg-background border-t shadow-lg max-h-[260px] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Keyboard Shortcuts</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={onClose}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-2 scrollbar-thin">
                    <div className="space-y-3">
                        {KEYBOARD_SHORTCUTS.map((category) => (
                            <div key={category.category}>
                                <div className="flex items-center gap-1 mb-1.5">
                                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {category.category}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {category.shortcuts.map((shortcut) => (
                                        <div
                                            key={shortcut.action}
                                            className="flex items-center justify-between text-[10px] px-1"
                                        >
                                            <span className="text-foreground">{shortcut.action}</span>
                                            <div className="flex items-center gap-0.5">
                                                {shortcut.keys.map((key, i) => (
                                                    <kbd
                                                        key={i}
                                                        className={cn(
                                                            "px-1 py-0.5 rounded border bg-muted/50 text-muted-foreground text-[9px] font-mono",
                                                            "shadow-sm"
                                                        )}
                                                    >
                                                        {key}
                                                    </kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer hint */}
                <div className="px-2 py-1 border-t bg-muted/20 text-[9px] text-muted-foreground text-center">
                    Press <kbd className="px-1 py-0.5 rounded border bg-muted/50 mx-0.5">Esc</kbd> to close
                </div>
            </div>
        </div>
    );
}
