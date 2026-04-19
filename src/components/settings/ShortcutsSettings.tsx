/**
 * Shortcuts Settings
 * 
 * Keyboard shortcuts reference section.
 */

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEYBOARD_SHORTCUTS = [
    {
        category: 'File',
        shortcuts: [
            { action: 'New File', keys: ['Ctrl', 'N'] },
            { action: 'Open Local File', keys: ['Ctrl', 'O'] },
            { action: 'Save', keys: ['Ctrl', 'S'] },
            { action: 'Rename File', keys: ['F2'] },
            { action: 'Delete File', keys: ['Ctrl', 'Shift', 'D'] },
        ]
    },
    {
        category: 'Editor',
        shortcuts: [
            { action: 'Run/Parse SQL', keys: ['Ctrl', 'Enter'] },
            { action: 'Format SQL', keys: ['Ctrl', 'Shift', 'F'] },
            { action: 'Copy SQL', keys: ['Ctrl', 'C'] },
            { action: 'Paste SQL', keys: ['Ctrl', 'V'] },
            { action: 'Undo', keys: ['Ctrl', 'Z'] },
            { action: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
        ]
    },
    {
        category: 'Navigation',
        shortcuts: [
            { action: 'Toggle Fullscreen', keys: ['Ctrl', 'Shift', 'Enter'] },
            { action: 'Focus Table', keys: ['Ctrl', 'Click'] },
            { action: 'Open AI Assistant', keys: ['Ctrl', 'K'] },
            { action: 'Open Settings', keys: ['Ctrl', ','] },
        ]
    },
];

export function ShortcutsSettings() {
    return (
        <div className="p-6">
            <h3 className="text-lg font-semibold mb-6">Keyboard Shortcuts</h3>
            <p className="text-sm text-muted-foreground mb-6">
                Quick reference for keyboard shortcuts available in Schema Weaver.
            </p>

            <div className="space-y-6">
                {KEYBOARD_SHORTCUTS.map((category) => (
                    <div key={category.category}>
                        <div className="flex items-center gap-1.5 mb-3">
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {category.category}
                            </span>
                        </div>

                        <div className="space-y-2 pl-5">
                            {category.shortcuts.map((shortcut) => (
                                <div
                                    key={shortcut.action}
                                    className="flex items-center justify-between py-1.5"
                                >
                                    <span className="text-sm text-foreground">
                                        {shortcut.action}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {shortcut.keys.map((key, i) => (
                                            <kbd
                                                key={i}
                                                className={cn(
                                                    "px-2 py-1 rounded border bg-muted text-muted-foreground text-xs font-mono",
                                                    "shadow-sm min-w-[24px] text-center"
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
    );
}
