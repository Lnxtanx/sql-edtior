import { Settings, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";


interface SidebarFooterProps {
    onOpenSettings?: () => void;
    onOpenAI?: () => void;
    isAiMode?: boolean;
}

export function SidebarFooter({ onOpenSettings, onOpenAI, isAiMode }: SidebarFooterProps) {


    return (
        <div className="flex items-center justify-between py-1 border-t border-border mt-auto">
            {/* Left side: Resona AI */}
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all shrink-0"
                onClick={onOpenAI}
            >
                {isAiMode ? (
                    <>
                        <Database className="w-4 h-4" />
                        Data Explorer
                    </>
                ) : (
                    <>
                        <img src="/resona.png" alt="Resona" className="w-4 h-4" />
                        Resona AI
                    </>
                )}
            </Button>

            {/* Right side actions */}
            <div className="flex items-center gap-1">
                {/* Settings */}
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
                            onClick={onOpenSettings}
                        >
                            <Settings className="h-4 w-4" strokeWidth={1.5} />
                            <span className="sr-only">Settings</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-medium text-xs">
                        Settings
                    </TooltipContent>
                </Tooltip>

            </div>
        </div>
    );
}
