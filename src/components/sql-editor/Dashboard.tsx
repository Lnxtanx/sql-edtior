import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight,
    Clock,
    Cloud,
    Database,
    FileCode2,
    FileText,
    Folder,
    FolderOpen,
    HardDrive,
    Layers3,
    Plus,
    Share2,
    Trash2,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Project, SqlFile } from '@/lib/file-management';
import { getFiles, getProject, getProjectConnection, getProjectMembers } from '@/lib/file-management';
import { useFilesList } from '@/lib/file-management/hooks/useFiles';
import { queryKeys } from '@/lib/queryClient';
import type { RecentFile } from '@/lib/cookies';
import { useAuth } from '@/components/auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { DeleteConfirmDialog } from './file-tree/DeleteConfirmDialog';

export interface DashboardProps {
    files: SqlFile[];
    recentFiles: RecentFile[];
    apiProjects?: Project[];
    onOpenProject: (rootId: string | null, projectId?: string | null) => void;
    onOpenFile: (fileId: string) => void;
    onCreateProject: () => void;
    onCreateFile: () => void;
    isGuest?: boolean;
    activeProjectId?: string | null;
    activeRootId?: string | null;
    onSelectProject?: (projectId: string | null) => void;
    onDeleteProject?: (projectId: string) => void;
    onViewProject?: (projectId: string) => void;
}

type DashboardProject = {
    id: string;
    title: string;
    description?: string | null;
    updated_at?: string;
    created_at?: string;
    team_id?: string | null;
    role?: string;
    is_owner?: boolean;
    default_connection_id?: string | null;
    is_api_project: boolean;
};

type FileTreeEntry = SqlFile & {
    children?: FileTreeEntry[];
};

function getFileIcon(file: SqlFile) {
    if (file.is_folder) return Folder;
    const ext = file.file_extension || file.title.split('.').pop() || '';
    if (['sql', 'pgsql'].includes(ext)) return FileCode2;
    return FileText;
}

function collectLocalProjectFiles(files: SqlFile[], rootId: string): SqlFile[] {
    const descendants = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        for (const file of files) {
            if (file.parent_id === currentId && !descendants.has(file.id)) {
                descendants.add(file.id);
                queue.push(file.id);
            }
        }
    }

    return files.filter(file => file.id === rootId || descendants.has(file.id));
}

function buildFileTree(files: SqlFile[], parentId: string | null = null, depth = 0, maxDepth = 2): FileTreeEntry[] {
    if (depth > maxDepth) return [];

    return files
        .filter(file => file.parent_id === parentId)
        .sort((a, b) => {
            if (a.is_folder && !b.is_folder) return -1;
            if (!a.is_folder && b.is_folder) return 1;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title);
        })
        .map(file => ({
            ...file,
            children: file.is_folder ? buildFileTree(files, file.id, depth + 1, maxDepth) : undefined
        }));
}

function summarizeProjectFiles(files: SqlFile[], rootId?: string | null) {
    const scopedFiles = rootId ? collectLocalProjectFiles(files, rootId) : files;
    const fileCount = scopedFiles.filter(file => !file.is_folder).length;
    const folderCount = scopedFiles.filter(file => file.is_folder).length;
    
    // Build tree starting from rootId (or null for cloud projects)
    const tree = buildFileTree(scopedFiles, rootId ?? null);

    return {
        scopedFiles,
        fileCount,
        folderCount: rootId ? Math.max(folderCount - 1, 0) : folderCount,
        tree,
    };
}

function TreeEntry({ entry, depth = 0 }: { entry: FileTreeEntry; depth?: number }) {
    const Icon = getFileIcon(entry);
    return (
        <div className="space-y-1">
            <div 
                className="flex items-center gap-2 text-[10px] py-0.5"
                style={{ paddingLeft: `${depth * 12}px` }}
            >
                <Icon className={cn('w-3 h-3 flex-shrink-0', entry.is_folder ? 'text-primary' : 'text-emerald-500')} />
                <span className="truncate text-muted-foreground/90">{entry.title}</span>
            </div>
            {entry.children?.map(child => (
                <TreeEntry key={child.id} entry={child} depth={depth + 1} />
            ))}
        </div>
    );
}

export function Dashboard({
    files,
    recentFiles,
    apiProjects = [],
    onOpenProject,
    onOpenFile,
    onCreateProject,
    onCreateFile,
    isGuest,
    activeProjectId,
    activeRootId,
    onSelectProject,
    onDeleteProject,
    onViewProject,
}: DashboardProps) {
    const projects = useMemo<DashboardProject[]>(() => {
        // In guest mode, 'files' is the source of local projects.
        // In auth mode, 'files' is only for the current project, so we should rely on apiProjects.
        // HOWEVER, if we want to show guest files that haven't been migrated yet, 
        // we'd need them here. For now, assume apiProjects is primary in auth mode.
        const localFolders = files
            .filter(file => file.is_folder && !file.parent_id)
            .map(file => ({
                id: file.id,
                title: file.title,
                description: 'Local workspace project',
                updated_at: file.updated_at,
                created_at: file.created_at,
                is_api_project: false,
            }));

        const cloudProjects = apiProjects.map(project => ({
            id: project.id,
            title: project.name,
            description: project.description,
            updated_at: project.updated_at,
            created_at: project.created_at,
            team_id: project.team_id,
            role: project.role,
            is_owner: project.is_owner,
            default_connection_id: project.default_connection_id,
            is_api_project: true,
        }));

        // Avoid duplicates if a project is both in apiProjects and localFolders (e.g. during migration)
        const cloudIds = new Set(cloudProjects.map(p => p.id));
        const uniqueLocal = localFolders.filter(l => !cloudIds.has(l.id));

        return [...cloudProjects, ...uniqueLocal];
    }, [files, apiProjects, isGuest]);

    const { user } = useAuth();
    const userId = user?.id;
    const qc = useQueryClient();

    const initialProjectId = activeProjectId || activeRootId || projects[0]?.id || null;
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Initial selection when projects load
    useEffect(() => {
        if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects]);

    const selectedProject = projects.find(project => project.id === selectedProjectId) ?? null;

    const cloudProjectDetails = useQuery({
        queryKey: ['files', 'dashboard', selectedProjectId, 'project'],
        queryFn: () => getProject(selectedProjectId!).then(result => result.project),
        enabled: !!selectedProject?.is_api_project && !!selectedProjectId,
        staleTime: 60000,
    });

    // Reuse the same query key as the left sidebar so both panels share one cache entry
    const cloudProjectFiles = useFilesList(userId, selectedProject?.is_api_project ? selectedProjectId : null);

    const cloudProjectMembers = useQuery({
        queryKey: ['files', 'dashboard', selectedProjectId, 'members'],
        queryFn: () => getProjectMembers(selectedProjectId!).then(result => result.members || []),
        enabled: !!selectedProject?.is_api_project && !!selectedProjectId,
        staleTime: 30000,
    });

    const cloudProjectConnection = useQuery({
        queryKey: ['files', 'dashboard', selectedProjectId, 'connection'],
        queryFn: () => getProjectConnection(selectedProjectId!),
        enabled: !!selectedProject?.is_api_project && !!selectedProjectId,
        staleTime: 30000,
    });

    const localSummary = useMemo(() => {
        if (!selectedProject || selectedProject.is_api_project) {
            return null;
        }
        return summarizeProjectFiles(files, selectedProject.id);
    }, [files, selectedProject]);

    const cloudSummary = useMemo(() => {
        if (!selectedProject?.is_api_project) {
            return null;
        }
        return summarizeProjectFiles((cloudProjectFiles.data ?? []) as SqlFile[]);
    }, [cloudProjectFiles.data, selectedProject]);

    const projectSummary = selectedProject?.is_api_project ? cloudSummary : localSummary;
    const totalProjects = projects.length;
    const collaborativeProjects = apiProjects.filter(project => project.team_id || (project.role && project.role !== 'owner')).length;
    const validRecentFiles = recentFiles.slice(0, 8);
    const projectDescription = cloudProjectDetails.data?.description ?? selectedProject?.description;
    const linkedConnectionName = cloudProjectConnection.data?.connection?.name ?? null;
    const memberCount = selectedProject?.is_api_project ? (cloudProjectMembers.data?.length ?? 0) : 1;
    const isProjectLoading = !!selectedProject?.is_api_project && (
        cloudProjectDetails.isLoading ||
        cloudProjectFiles.isLoading ||
        cloudProjectMembers.isLoading ||
        cloudProjectConnection.isLoading
    );

    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setProjectToDelete(project);
            setIsDeleteDialogOpen(true);
        }
    };

    const handleConfirmDelete = () => {
        if (projectToDelete) {
            onDeleteProject?.(projectToDelete.id);
            setIsDeleteDialogOpen(false);
            setProjectToDelete(null);
        }
    };

    const handleOpenSelectedProject = () => {
        if (!selectedProject) return;
        if (selectedProject.is_api_project) {
            onOpenProject(null, selectedProject.id);
            return;
        }
        onOpenProject(selectedProject.id, null);
    };

    return (
        <div className="w-full h-full max-h-[85vh] overflow-y-auto px-6 py-6 scrollbar-thin">
            <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b pb-4">
                    <div className="space-y-1">
                        <h1 className="text-lg font-medium">Projects</h1>
                        <p className="text-xs text-muted-foreground">Manage your workspace</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={onCreateProject}>
                            <Plus className="w-3 h-3" />
                            New
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2" onClick={onCreateFile}>
                            <Plus className="w-3 h-3" />
                            File
                        </Button>
                    </div>
                </div>

                {/* Stats Row - More Compact */}
                <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border bg-card/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Projects</div>
                        <div className="mt-1 text-lg font-medium">{totalProjects}</div>
                    </div>
                    <div className="rounded-lg border bg-card/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Shared</div>
                        <div className="mt-1 text-lg font-medium">{collaborativeProjects}</div>
                    </div>
                    <div className="rounded-lg border bg-card/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recent</div>
                        <div className="mt-1 text-lg font-medium">{recentFiles.length}</div>
                    </div>
                </div>
                {projects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                            <FolderOpen className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-sm font-medium">Create your first project</h2>
                        <p className="mx-auto mt-1 max-w-xs text-[10px] text-muted-foreground">
                            Keep one SQL file per domain—users, payments, subscriptions—so the parser stays aligned.
                        </p>
                        <div className="mt-4 flex justify-center gap-2">
                            <Button size="sm" className="gap-1" onClick={onCreateProject}>
                                <Plus className="w-3 h-3" />
                                Project
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1" onClick={onCreateFile}>
                                <Plus className="w-3 h-3" />
                                File
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <section className="rounded-lg border bg-card/50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Workspace</div>
                                    <div className="mt-0.5 text-xs font-medium">Projects</div>
                                </div>
                                <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                    {projects.length}
                                </Badge>
                            </div>

                            <div className="space-y-1">
                                {projects.map(project => {
                                    const isSelected = project.id === selectedProjectId;
                                    const isActive = project.id === (activeProjectId || activeRootId);
                                    const summary = project.is_api_project
                                        ? null
                                        : summarizeProjectFiles(files, project.id);

                                    return (
                                        <div
                                            key={project.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedProjectId(project.id)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProjectId(project.id); }}
                                            onMouseEnter={() => {
                                                if (project.is_api_project && userId) {
                                                    void qc.prefetchQuery({
                                                        queryKey: queryKeys.files.projectFiles(project.id),
                                                        queryFn: () => getFiles(project.id).then(r => r.files || []),
                                                        staleTime: 30_000,
                                                    });
                                                }
                                            }}
                                            className={cn(
                                                'w-full rounded-lg border px-3 py-3 text-left transition-all duration-200 group/item relative overflow-hidden cursor-pointer',
                                                isSelected
                                                    ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                                                    : 'border-transparent bg-muted/30 hover:border-border/80 hover:bg-muted/50'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <FolderOpen className={cn('mt-0.5 w-3 h-3 flex-shrink-0 transition-colors', isSelected ? 'text-primary' : 'text-primary/60')} />
                                                        <span className={cn('truncate text-xs font-medium', isSelected ? 'text-foreground' : 'text-foreground/90')}>
                                                            {project.title}
                                                        </span>
                                                        {isActive && (
                                                            <Badge className="h-4 px-1 text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase tracking-tighter shrink-0">
                                                                OPENED
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                        <Badge variant={project.is_api_project ? 'secondary' : 'outline'} className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                                            {project.is_api_project ? 'Cloud' : 'Local'}
                                                        </Badge>
                                                        {project.team_id && (
                                                            <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                                                Team
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {project.is_api_project && project.is_owner && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteProject(e, project.id)}
                                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-all"
                                                            title="Delete Project"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    <ArrowRight className={cn('w-3 h-3 transition-transform', isSelected && 'translate-x-0.5 text-primary')} />
                                                </div>
                                            </div>
                                            {!project.is_api_project && summary && (
                                                <div className="mt-2 text-[10px] text-muted-foreground">
                                                    {summary.fileCount}F · {summary.folderCount}D
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {validRecentFiles.length > 0 && (
                                <div className="mt-3 border-t border-border/50 pt-3">
                                    <div className="mb-2 flex items-center gap-2 px-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        Recent
                                    </div>
                                    <div className="space-y-1">
                                        {validRecentFiles.map(file => (
                                            <button
                                                key={file.id}
                                                type="button"
                                                onClick={() => onOpenFile(file.id)}
                                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-muted/40"
                                            >
                                                <FileCode2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                                <span className="min-w-0 flex-1 truncate">{file.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border bg-card/50 p-3">
                            {!selectedProject ? (
                                <div className="flex h-full min-h-[300px] items-center justify-center text-center">
                                    <div className="max-w-sm space-y-2">
                                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                            <Layers3 className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <h2 className="text-sm font-medium">Select a project</h2>
                                        <p className="text-[10px] text-muted-foreground">
                                            Preview files, folders, and settings
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-1">
                                            <Badge variant={selectedProject.is_api_project ? 'secondary' : 'outline'} className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                                {selectedProject.is_api_project ? 'Cloud' : 'Local'}
                                            </Badge>
                                            {selectedProject.team_id && (
                                                <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                                    Team
                                                </Badge>
                                            )}
                                            {linkedConnectionName && (
                                                <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px] uppercase tracking-wider">
                                                    DB
                                                </Badge>
                                            )}
                                        </div>
                                        <h2 className="mt-1 text-sm font-medium tracking-tight">{selectedProject.title}</h2>
                                    </div>

                                    <div className="flex gap-1.5 border-t border-border/50 pt-2">
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="flex-1 gap-1 text-xs h-8 hover:bg-primary/5 hover:text-primary transition-all duration-200" 
                                            onClick={handleOpenSelectedProject}
                                        >
                                            Open in Editor
                                            <ArrowRight className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={onCreateFile}>
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                        {selectedProject.is_api_project && selectedProject.is_owner && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="gap-1 text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                onClick={(e) => handleDeleteProject(e, selectedProject.id)}
                                                title="Delete Project"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                        {onViewProject && (
                                            <Button 
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 text-xs h-8 ml-auto bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-all"
                                                onClick={() => onViewProject(selectedProject.id)}
                                            >
                                                <Layers3 className="w-3 h-3" />
                                                View Dashboard
                                            </Button>
                                        )}
                                    </div>

                                    {!isProjectLoading && (
                                        <div className="grid gap-2 sm:grid-cols-2 border-t border-border/50 pt-2">
                                            <div className="rounded-lg border bg-muted/20 px-2 py-2">
                                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Files</div>
                                                <div className="mt-0.5 text-sm font-medium">{projectSummary?.fileCount ?? 0}</div>
                                            </div>
                                            <div className="rounded-lg border bg-muted/20 px-2 py-2">
                                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Folders</div>
                                                <div className="mt-0.5 text-sm font-medium">{projectSummary?.folderCount ?? 0}</div>
                                            </div>
                                            <div className="rounded-lg border bg-muted/20 px-2 py-2">
                                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Members</div>
                                                <div className="mt-0.5 text-sm font-medium">{memberCount}</div>
                                            </div>
                                            <div className="rounded-lg border bg-muted/20 px-2 py-2">
                                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Database</div>
                                                <div className="mt-0.5 truncate text-[10px] font-medium">{linkedConnectionName ? linkedConnectionName.slice(0, 12) : 'None'}</div>
                                            </div>
                                        </div>
                                    )}

                                    {!isProjectLoading && projectSummary?.tree.length && (
                                        <div className="border-t border-border/50 pt-3">
                                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                                                <span>Structure</span>
                                                <span className="text-[8px] opacity-50">Auto-generated</span>
                                            </div>
                                            <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                                {projectSummary.tree.slice(0, 8).map(entry => (
                                                    <TreeEntry key={entry.id} entry={entry} />
                                                ))}
                                                {projectSummary.tree.length > 8 && (
                                                    <div className="text-[9px] text-muted-foreground mt-1 pl-4">
                                                        +{(projectSummary.tree.length) - 8} more items
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>

            <DeleteConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                file={projectToDelete ? { id: projectToDelete.id, title: projectToDelete.title, is_folder: true } as SqlFile : null}
                files={[]}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
