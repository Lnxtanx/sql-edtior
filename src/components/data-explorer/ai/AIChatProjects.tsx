import { Plus, Settings, FolderKanban, Users, Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AIChatProjects() {
    return (
        <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 shrink-0 border-b border-border/40">
                <h2 className="text-sm font-semibold text-foreground">Projects</h2>
                <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                    <Settings className="w-3.5 h-3.5" />
                    Manage
                </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <div className="max-w-5xl mx-auto flex flex-col gap-6">

                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Projects</h1>
                        <p className="text-muted-foreground text-sm">Organize your chats, schemas, and queries into distinct workspaces.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                        {/* Create New Project Card */}
                        <div className="border border-dashed border-border hover:border-primary/50 bg-muted/10 hover:bg-muted/30 rounded-2xl flex flex-col items-center justify-center min-h-[220px] transition-all cursor-pointer gap-3 text-muted-foreground hover:text-foreground">
                            <div className="w-12 h-12 rounded-full bg-background border border-border shadow-sm flex items-center justify-center">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-sm">Create New Project</span>
                        </div>

                        {/* Existing Project 1 */}
                        <div className="border border-border/80 bg-card hover:border-border hover:shadow-md rounded-2xl p-5 flex flex-col min-h-[220px] transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                    <FolderKanban className="w-5 h-5" />
                                </div>
                                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                            <h3 className="font-semibold text-foreground text-lg mb-2">E-Commerce Migration</h3>
                            <p className="text-sm text-muted-foreground mb-6 line-clamp-2">Schema refactoring for the legacy MySQL database merging into Postgres.</p>

                            <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" />
                                    <span>Updated 2h ago</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>3 members</span>
                                </div>
                            </div>
                        </div>

                        {/* Existing Project 2 */}
                        <div className="border border-border/80 bg-card hover:border-border hover:shadow-md rounded-2xl p-5 flex flex-col min-h-[220px] transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <FolderKanban className="w-5 h-5" />
                                </div>
                                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                            <h3 className="font-semibold text-foreground text-lg mb-2">Internal Analytics Tool</h3>
                            <p className="text-sm text-muted-foreground mb-6 line-clamp-2">Generating complex queries for the marketing dashboard visualization platform.</p>

                            <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" />
                                    <span>Updated 1d ago</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Just you</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
