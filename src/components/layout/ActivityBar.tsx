import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Database, Network, Plug, Settings, Sparkles, User, Cpu, SidebarOpen, GitCompareArrows, Table2 } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarView } from "./types";
import { Link } from "react-router-dom";
import { useCapabilities } from "@/hooks/useCapabilities";

interface ActivityBarProps {
    activeView: SidebarView;
    onViewChange: (view: SidebarView) => void;

    onOpenSettings?: () => void;
    onToggleCollapse?: () => void;
}

interface ActivityItem {
    id: SidebarView;
    icon: React.ElementType;
    label: string;
    bottom?: boolean;
    requiredFeature?: string;
}

export function ActivityBar({
    activeView,
    onViewChange,
    onOpenSettings,
    onToggleCollapse
}: ActivityBarProps) {
    const { canAccessSQL, canAccessExplorer, canAccessSchema } = useCapabilities();

    const allItems: ActivityItem[] = [
        { id: 'editor', icon: Database, label: 'SQL Editor', requiredFeature: 'sql_editor' },
        { id: 'ai', icon: Sparkles, label: 'Resona AI' },
        { id: 'connect', icon: Plug, label: 'Connections', requiredFeature: 'sql_editor' },
        { id: 'graph', icon: Network, label: 'Schema Graph', requiredFeature: 'sql_editor' },
        { id: 'compiler', icon: Cpu, label: 'Schema Compiler', requiredFeature: 'sql_editor' },
        { id: 'diff', icon: GitCompareArrows, label: 'Schema Diff', requiredFeature: 'sql_editor' },
    ];

    // Filter items based on capabilities
    const items = allItems.filter(item => {
        if (!item.requiredFeature) return true;
        if (item.requiredFeature === 'sql_editor') return canAccessSQL;
        return true;
    });

    const handleItemClick = (id: SidebarView) => {
        onViewChange(activeView === id ? null : id);
    };

    return (
        <div className="w-12 flex flex-col items-center py-2 border-r bg-muted/20 z-20">
            {/* Expand Button (Only visible when collapsed) */}
            {onToggleCollapse && (
                <div className="mb-2">
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 mb-2"
                                onClick={onToggleCollapse}
                            >
                                <SidebarOpen className="h-5 w-5" />
                                <span className="sr-only">Expand Sidebar</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Expand Sidebar</TooltipContent>
                    </Tooltip>
                </div>
            )}

            {items.map((item) => (
                <ActivityBarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeView === item.id}
                    onClick={() => handleItemClick(item.id)}
                />
            ))}

            {/* Data Explorer - External Page Link (only if user has explorer access) */}
            {canAccessExplorer && (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <Link to="/data">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
                        >
                            <Table2 className="h-5 w-5" strokeWidth={1.5} />
                            <span className="sr-only">Data Explorer</span>
                        </Button>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium text-xs">
                    Data Explorer
                </TooltipContent>
            </Tooltip>
            )}

            <div className="flex-1" />

            {/* Version Footer */}
            <div className="w-full flex flex-col items-center gap-4 pb-4">
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div className="flex items-center cursor-default py-1 whitespace-nowrap">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/60">
                                SQL Editor <span className="text-[8px] font-medium opacity-70 ml-1">v1.0.0</span>
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium text-xs">
                        Schema Weaver SQL Editor v1.0.0
                    </TooltipContent>
                </Tooltip>

                {/* Settings */}
                <ActivityBarItem
                    icon={Settings}
                    label="Settings"
                    isActive={activeView === 'settings'}
                    onClick={onOpenSettings || (() => { })}
                />
            </div>

        </div>
    );
}

function ActivityBarItem({
    icon: Icon,
    label,
    isActive,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
                <div className="relative flex justify-center w-full mb-1">
                    {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-10 w-10 rounded-lg transition-all",
                            isActive
                                ? "text-foreground bg-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
                        )}
                        onClick={onClick}
                    >
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                        <span className="sr-only">{label}</span>
                    </Button>
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium text-xs">
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
