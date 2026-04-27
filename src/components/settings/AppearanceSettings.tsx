/**
 * Appearance Settings
 * 
 * Theme and visual customization options.
 */

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useEditorSettings } from './EditorSettingsContext';

const THEMES = [
    { id: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-slate-200' },
    { id: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#1e1e1e] border-[#404040]' },
    { id: 'dark-black', label: 'Dark Black', icon: Moon, preview: 'bg-[#09090b] border-[#262626]' },
    { id: 'blue-gray', label: 'Blue Gray', icon: Monitor, preview: 'bg-[#0f172a] border-[#1e293b]' },
    { id: 'system', label: 'System', icon: Monitor, preview: 'bg-gradient-to-r from-white to-[#1e1e1e] border-slate-400' },
];

export function AppearanceSettings() {
    const { theme, setTheme } = useTheme();
    const { 
        showMinimap, setShowMinimap,
        showLineNumbers, setShowLineNumbers,
        wordWrap, setWordWrap,
        bracketMatching, setBracketMatching,
        autoCloseBrackets, setAutoCloseBrackets,
        foldGutter, setFoldGutter,
        highlightActiveLine, setHighlightActiveLine
    } = useEditorSettings();

    return (
        <div className="p-6">
            <h3 className="text-lg font-semibold mb-6">Appearance</h3>

            {/* Theme Selection */}
            <div className="space-y-3">
                <h4 className="text-sm font-medium">Theme</h4>
                <p className="text-sm text-muted-foreground">
                    Choose how Schema Weaver looks on your device.
                </p>

                <div className="grid grid-cols-3 gap-3 mt-4">
                    {THEMES.map((themeOption) => {
                        const Icon = themeOption.icon;
                        const isActive = theme === themeOption.id;

                        return (
                            <button
                                key={themeOption.id}
                                onClick={() => setTheme(themeOption.id)}
                                className={cn(
                                    "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                                    isActive
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-muted-foreground bg-card"
                                )}
                            >
                                {/* Preview */}
                                <div className={cn(
                                    "w-full h-16 rounded-md border mb-3",
                                    themeOption.preview
                                )} />

                                {/* Icon & Label */}
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-medium">{themeOption.label}</span>
                                </div>

                                {/* Active Checkmark */}
                                {isActive && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="w-3 h-3 text-primary-foreground" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <Separator className="my-6" />

            {/* Additional Preferences */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">Editor Preferences</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {/* Basic Settings */}
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Line Numbers</p>
                            <p className="text-xs text-muted-foreground">Show line numbers in the editor</p>
                        </div>
                        <Switch checked={showLineNumbers} onCheckedChange={setShowLineNumbers} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Minimap</p>
                            <p className="text-xs text-muted-foreground">Show code minimap on the right</p>
                        </div>
                        <Switch checked={showMinimap} onCheckedChange={setShowMinimap} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Word Wrap</p>
                            <p className="text-xs text-muted-foreground">Wrap long lines in the editor</p>
                        </div>
                        <Switch checked={wordWrap} onCheckedChange={setWordWrap} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Bracket Matching</p>
                            <p className="text-xs text-muted-foreground">Highlight matching pairs</p>
                        </div>
                        <Switch checked={bracketMatching} onCheckedChange={setBracketMatching} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Auto-close Brackets</p>
                            <p className="text-xs text-muted-foreground">Automatically close brackets/quotes</p>
                        </div>
                        <Switch checked={autoCloseBrackets} onCheckedChange={setAutoCloseBrackets} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Code Folding</p>
                            <p className="text-xs text-muted-foreground">Allow collapsing code blocks</p>
                        </div>
                        <Switch checked={foldGutter} onCheckedChange={setFoldGutter} />
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium">Highlight Active Line</p>
                            <p className="text-xs text-muted-foreground">Highlight the current row</p>
                        </div>
                        <Switch checked={highlightActiveLine} onCheckedChange={setHighlightActiveLine} />
                    </div>
                </div>
            </div>
        </div>
    );
}
