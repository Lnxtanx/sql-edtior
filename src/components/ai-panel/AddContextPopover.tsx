import React from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Plus, Image, AtSign, Briefcase, FileCode, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

interface AddContextPopoverProps {
    onMediaClick: () => void;
    onMentionClick: () => void;
    onWorkspaceClick: () => void;
    disabled?: boolean;
}

export function AddContextPopover({
    onMediaClick,
    onMentionClick,
    onWorkspaceClick,
    disabled = false
}: AddContextPopoverProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Add context"
                    disabled={disabled}
                >
                    <Plus className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                className="w-36 p-1.5 bg-popover border shadow-md rounded-xl"
                sideOffset={8}
            >
                <div className="flex flex-col gap-0.5">
                    <p className="px-1.5 py-1 text-[10px] font-semibold text-foreground/70">
                        Add context
                    </p>

                    <button
                        onClick={onMediaClick}
                        className="flex items-center gap-2 w-full px-1.5 py-1.5 text-[11px] text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors text-left"
                    >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/40 group-hover:bg-muted">
                            <Image className="w-3 h-3" />
                        </div>
                        <span className="font-medium">Media</span>
                    </button>

                    <button
                        onClick={onMentionClick}
                        className="flex items-center gap-2 w-full px-1.5 py-1.5 text-[11px] text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors text-left"
                    >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/40 group-hover:bg-muted">
                            <AtSign className="w-3 h-3" />
                        </div>
                        <span className="font-medium">Mentions</span>
                    </button>

                    <button
                        onClick={onWorkspaceClick}
                        className="flex items-center gap-2 w-full px-1.5 py-1.5 text-[11px] text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors text-left"
                    >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/40 group-hover:bg-muted">
                            <Briefcase className="w-3 h-3" />
                        </div>
                        <span className="font-medium">Workspace</span>
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
