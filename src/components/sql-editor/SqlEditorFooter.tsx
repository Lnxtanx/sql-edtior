/**
 * SQL Editor Footer
 * 
 * Stats, analysis, and format issues panels at the bottom of the editor.
 * Also includes a settings button for future use.
 */

import { Button } from '@/components/ui/button';
import {
    Database, Settings, Plug,
    Network, Cpu, GitCompareArrows
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { SidebarView } from '@/components/layout/types';



export type FooterPanel = 'connect' | 'subgraph' | 'compiler' | 'diff' | null;

export interface SqlEditorFooterProps {


    expandedPanel: FooterPanel;
    onPanelChange: (panel: FooterPanel) => void;
    onOpenSettings?: () => void;
    activeView?: SidebarView;
    onViewChange?: (view: SidebarView) => void;
}

export function SqlEditorFooter({

    expandedPanel,
    onPanelChange,
    onOpenSettings,
    activeView,
    onViewChange,
}: SqlEditorFooterProps) {
    const { profile } = useUserProfile();


    return (
        <div className="border-t border-border bg-muted/30">
            {/* Tab Buttons */}
            <div className="flex items-center h-7 px-2 gap-1">
                {/* Return to SQL Editor button (only in AI panel) */}
                {activeView === 'ai' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[9px] gap-1"
                        onClick={() => onViewChange?.('editor')}
                        title="Return to SQL Editor"
                    >
                        <Database className="w-3 h-3" />
                        Editor
                    </Button>
                )}

                {/* Combined Stats/Analysis button */}
                {/* Compiler button */}
                <Button
                    variant={activeView === 'compiler' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-5 px-1.5 text-[9px] gap-1"
                    onClick={() => onViewChange?.('compiler')}
                    title="Schema Compiler"
                >
                    <Cpu className="w-3 h-3" />
                    Compiler
                </Button>

                {/* Diff button */}
                <Button
                    variant={activeView === 'diff' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-5 px-1.5 text-[9px] gap-1"
                    onClick={() => onViewChange?.('diff')}
                    title="Schema Diff"
                >
                    <GitCompareArrows className="w-3 h-3" />
                    Diff
                </Button>




                {/* Spacer */}
                <div className="flex-1" />

                {/* Navigation Tabs (Restored) */}
                <div className="flex items-center gap-1 border-l pl-2 ml-1">
                    <Button
                        variant={activeView === 'connect' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-5 px-1.5 text-[9px] gap-1"
                        onClick={() => onViewChange?.('connect')}
                        title="Connections"
                    >
                        <Plug className="w-3 h-3" />
                        <span className="hidden sm:inline">Connect</span>
                    </Button>

                    <Button
                        variant={activeView === 'graph' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-5 px-1.5 text-[9px] gap-1"
                        onClick={() => onViewChange?.('graph')}
                        title="Subgraph"
                    >
                        <Network className="w-3 h-3" />
                        <span className="hidden sm:inline">Graph</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full overflow-hidden"
                        onClick={onOpenSettings}
                        title={profile ? `Settings (${profile.email})` : "Settings"}
                    >
                        {profile?.avatar_url ? (
                            <Avatar className="h-4 w-4">
                                <AvatarImage src={profile.avatar_url} alt={profile.full_name || "User"} />
                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                    {profile.full_name?.charAt(0) || "U"}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <Settings className="w-3 h-3" />
                        )}
                    </Button>
                </div>
            </div>







        </div>
    );
}




