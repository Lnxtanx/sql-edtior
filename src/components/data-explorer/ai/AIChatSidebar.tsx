import { Plus, LayoutGrid, Library, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIChatSidebarProps {
    onCloseAI: () => void;
    activeView: 'chat' | 'library' | 'projects';
    onViewChange: (view: 'chat' | 'library' | 'projects') => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export function AIChatSidebar({ activeView, onViewChange, collapsed, onToggleCollapse }: AIChatSidebarProps) {
    if (collapsed) {
        return (
            <div className="w-[68px] flex flex-col h-full bg-muted/10 items-center py-4 border-r gap-3 shrink-0">
                <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="text-muted-foreground hover:text-foreground mb-2">
                    <PanelLeftOpen className="w-5 h-5" />
                </Button>

                <div className="w-10 h-10 mb-2 rounded-xl bg-background border border-border/50 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    <img src="/resona.png" alt="Resona AI" className="w-[22px] h-[22px] object-contain" />
                </div>

                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-10 w-10 rounded-lg", activeView === 'chat' && "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300")} 
                                onClick={() => onViewChange('chat')}
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">New chat</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-10 w-10 rounded-lg", activeView === 'projects' && "bg-muted text-foreground")} 
                                onClick={() => onViewChange('projects')}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Projects</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-10 w-10 rounded-lg", activeView === 'library' && "bg-muted text-foreground")} 
                                onClick={() => onViewChange('library')}
                            >
                                <Library className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Library</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="flex-1" />
            </div>
        );
    }

    return (
        <div className="w-[260px] flex flex-col h-full bg-muted/10 relative border-r shrink-0">
            {/* Top Area: Title & Toggle */}
            <div className="p-3 flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 px-2">
                    <div className="w-7 h-7 rounded-sm bg-background border border-border/50 shadow-sm flex items-center justify-center shrink-0">
                        <img src="/resona.png" alt="Resona AI" className="w-4 h-4 object-contain" />
                    </div>
                    <span className="font-semibold text-sm">Resona AI</span>
                </div>
                {onToggleCollapse && (
                    <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <PanelLeftClose className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Top Area: New Chat */}
            <div className="p-3">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-2 h-10 text-sm font-medium px-2 rounded-lg",
                        activeView === 'chat'
                            ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                            : "text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                    )}
                    onClick={() => onViewChange('chat')}
                >
                    <Plus className="w-4 h-4" />
                    New chat
                </Button>
            </div>

            {/* Nav Menu Items */}
            <div className="px-3 py-1 flex flex-col gap-0.5">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start h-9 px-2 text-sm font-normal rounded-lg",
                        activeView === 'projects' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => onViewChange('projects')}
                >
                    <LayoutGrid className="w-4 h-4 mr-2.5 opacity-70" />
                    Projects
                </Button>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start h-9 px-2 text-sm font-normal rounded-lg",
                        activeView === 'library' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => onViewChange('library')}
                >
                    <Library className="w-4 h-4 mr-2.5 opacity-70" />
                    Library
                </Button>
            </div>

            {/* Chat History List */}
            <div className="flex-1 overflow-y-auto px-3 py-4 mt-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 mb-3">
                    Your chats
                </div>
                {/* We will leave this empty as requested, just showing standard structure */}
                <div className="text-sm text-muted-foreground italic px-2">
                    No recent chats.
                </div>
            </div>
        </div>
    );
}
