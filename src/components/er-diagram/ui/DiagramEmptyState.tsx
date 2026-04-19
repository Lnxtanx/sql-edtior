import React from 'react';
import { Search, LayoutGrid, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConnectionDialog } from '@/components/connection';

interface DiagramEmptyStateProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    user: any;
    signInWithGoogle?: () => void;
    isLoggingIn?: boolean;
}

export function DiagramEmptyState({
    searchQuery,
    setSearchQuery,
    user,
    signInWithGoogle,
    isLoggingIn = false,
}: DiagramEmptyStateProps) {
    return (
        <div className="flex-1 flex flex-col bg-background">
            {/* Toolbar - same as normal state */}
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-card">
                <div className="relative flex-1 max-w-[200px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 h-7 text-xs"
                        disabled
                    />
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    {/* Connect DB Button */}
                    <ConnectionDialog />

                    {/* Auth Button */}
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
                </div>
            </div>

            {/* Empty State Content */}
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No tables to display</p>
                    <p className="text-sm">Enter SQL and click "Generate Diagram"</p>
                </div>
            </div>
        </div>
    );
}
