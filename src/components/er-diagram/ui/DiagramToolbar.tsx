import React, { useState, useEffect, useRef } from 'react';
import { Download, Image, FileCode, Search, Maximize2, Database, Code, FileJson, Braces, FileText, Footprints, Loader2, Layers, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ConnectionDialog } from '@/components/connection';
import { cn } from '@/lib/utils';
import { LayoutDirection } from '../layout/useLayoutEngine';
import { ParsedSchema } from '@/lib/sql-parser';
import { useDebounce } from '@/hooks/useDebounce';

interface DiagramToolbarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    user: any;
    layoutDirection: LayoutDirection;
    updateLayout: (direction: LayoutDirection) => void;
    signInWithGoogle?: () => void;
    isLoggingIn?: boolean;
    onOpenGlobalAI?: () => void;
    schema?: ParsedSchema | null;
    pathMode: boolean;
    setPathMode: (mode: boolean) => void;
    toggleFullscreen: () => void;
    exportImage: (format: 'png' | 'svg') => void;
    exportSchema: (format: 'prisma' | 'drizzle' | 'dbml' | 'markdown' | 'typescript') => void;
    containerRef?: React.RefObject<HTMLDivElement>;
}

export function DiagramToolbar({
    searchQuery,
    setSearchQuery,
    user,
    layoutDirection,
    updateLayout,
    signInWithGoogle,
    isLoggingIn = false,
    onOpenGlobalAI,
    schema,
    pathMode,
    setPathMode,
    toggleFullscreen,
    exportImage,
    exportSchema,
    containerRef,
}: DiagramToolbarProps) {
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debouncedSearch = useDebounce(localSearch, 300);

    // Sync from parent if changed externally
    useEffect(() => {
        setLocalSearch(searchQuery);
    }, [searchQuery]);

    // Send to parent only when debounced value changes
    useEffect(() => {
        if (debouncedSearch !== searchQuery) {
            setSearchQuery(debouncedSearch);
        }
    }, [debouncedSearch, searchQuery, setSearchQuery]);

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-card">
            <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                />
            </div>

            <Select value={layoutDirection} onValueChange={(v) => updateLayout(v as LayoutDirection)}>
                <SelectTrigger className="w-[110px] h-7 text-xs">
                    <SelectValue placeholder="Layout" />
                </SelectTrigger>
                <SelectContent container={containerRef?.current}>
                    <SelectItem value="LR">Left → Right</SelectItem>
                    <SelectItem value="TB">Top → Bottom</SelectItem>
                    <SelectItem value="RL">Right → Left</SelectItem>
                    <SelectItem value="BT">Bottom → Top</SelectItem>
                </SelectContent>
            </Select>

            <div className="flex items-center gap-1 ml-auto">
                {/* Auth Button - Only show Sign In when not logged in */}
                {!user && signInWithGoogle && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 bg-card hover:bg-muted gap-1"
                        onClick={signInWithGoogle}
                        disabled={isLoggingIn}
                    >
                        {isLoggingIn ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                        )}
                        {isLoggingIn ? 'Signing in...' : 'Sign in'}
                    </Button>
                )}

                {/* Connect DB Button */}
                <ConnectionDialog />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Export
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48" container={containerRef?.current}>
                        <DropdownMenuItem onClick={() => exportImage('png')}>
                            <Image className="w-4 h-4 mr-2" />
                            Export as PNG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportImage('svg')}>
                            <FileCode className="w-4 h-4 mr-2" />
                            Export as SVG
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => exportSchema('prisma')} disabled={!schema}>
                            <Database className="w-4 h-4 mr-2" />
                            Prisma Schema
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSchema('drizzle')} disabled={!schema}>
                            <Code className="w-4 h-4 mr-2" />
                            Drizzle ORM
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSchema('dbml')} disabled={!schema}>
                            <FileJson className="w-4 h-4 mr-2" />
                            DBML (dbdiagram.io)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => exportSchema('typescript')} disabled={!schema}>
                            <Braces className="w-4 h-4 mr-2" />
                            TypeScript Types
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSchema('markdown')} disabled={!schema}>
                            <FileText className="w-4 h-4 mr-2" />
                            Markdown Docs
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-4 bg-border mx-1" />

                <Button
                    variant={pathMode ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                        "h-7 text-xs px-2 gap-1 transition-all duration-200",
                        pathMode 
                            ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 shadow-inner" 
                            : "hover:bg-accent/50"
                    )}
                    onClick={() => setPathMode(!pathMode)}
                    title="Path Analysis: Find shortest path between tables"
                >
                    <Footprints className="w-3.5 h-3.5" />
                    {pathMode ? 'Path Mode' : 'Path'}
                </Button>

                <div className="w-px h-4 bg-border mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 ml-1 gap-2 text-xs font-semibold border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/40 transition-all shadow-sm group"
                            onClick={() => onOpenGlobalAI?.()}
                        >
                            <img 
                                src="/resona.png" 
                                alt="Resona" 
                                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 filter drop-shadow-sm" 
                            />
                            Resona AI
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Resona AI</TooltipContent>
                </Tooltip>

                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={toggleFullscreen}>
                    <Maximize2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}
