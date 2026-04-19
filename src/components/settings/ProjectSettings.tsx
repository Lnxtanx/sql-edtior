import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, FolderTree, ArrowLeft, Users, Loader2, Database, Trash2, Plus, Globe, Shield, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
    Project,
    listTeams,
    Team,
    TeamMember,
    getTeamMembers,
    updateProject,
    SqlFile,
    getProjectConnections,
    addProjectConnection,
    removeProjectConnection
} from '@/lib/file-management/api/client';
import { listConnections } from '@/lib/api/connection';
import { queryKeys } from '@/lib/queryClient';
import { useFileManager } from '@/hooks/useFileManager';
import { CreateFileDialog, DeleteConfirmDialog, FileTree } from '@/components/sql-editor/file-tree';
import { Dashboard } from '@/components/sql-editor/Dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectSettingsProps {
    projects: Project[];
    currentProjectId?: string | null;
    onCloseModal: () => void;
    onProjectsUpdate?: () => void;
}

export function ProjectSettings({ projects, currentProjectId, onCloseModal, onProjectsUpdate }: ProjectSettingsProps) {
    const fileManager = useFileManager();
    const queryClient = useQueryClient();

    // Drill-down state
    const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
    
    // Team integration
    const [teams, setTeams] = useState<Team[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);

    // Connection integration
    const [projectConnections, setProjectConnections] = useState<any[]>([]);
    const [userConnections, setUserConnections] = useState<any[]>([]);
    const [isLoadingConnections, setIsLoadingConnections] = useState(false);

    // Team members state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);

    const activeProject = useMemo(() => {
        const apiProject = projects.find(p => p.id === viewingProjectId);
        if (apiProject) return apiProject;
        
        // Fallback to local folder if no API project matches
        const localFolder = fileManager.files.find(f => (f.id === viewingProjectId || f.project_id === viewingProjectId) && f.is_folder);
        if (localFolder && !apiProject) {
            return {
                id: localFolder.id,
                name: localFolder.name || localFolder.title,
                visibility: 'private',
                created_at: localFolder.created_at,
                updated_at: localFolder.updated_at
            } as Project;
        }
        return null;
    }, [projects, viewingProjectId, fileManager.files]);

    // Dialogs
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createDialogIsFolder, setCreateDialogIsFolder] = useState(false);
    const [createDialogParentId, setCreateDialogParentId] = useState<string | null>(null);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteConfirmFile, setDeleteConfirmFile] = useState<SqlFile | null>(null);

    useEffect(() => {
        listTeams().then(res => setTeams(res.teams)).catch(console.error);
    }, []);

    const fetchConnections = useCallback(async () => {
        if (!viewingProjectId) return;
        setIsLoadingConnections(true);
        try {
            const [projRes, userRes] = await Promise.all([
                getProjectConnections(viewingProjectId),
                listConnections()
            ]);
            setProjectConnections(projRes.connections || []);
            setUserConnections(userRes.connections || []);
        } catch (error) {
            console.error('Failed to fetch connections:', error);
        } finally {
            setIsLoadingConnections(false);
        }
    }, [viewingProjectId]);

    useEffect(() => {
        if (viewingProjectId) {
            fetchConnections();
        }
    }, [viewingProjectId, fetchConnections]);

    const fetchTeamMembers = useCallback(async (teamId: string) => {
        setIsLoadingTeamMembers(true);
        try {
            const res = await getTeamMembers(teamId);
            setTeamMembers(res.members || []);
        } catch (error) {
            console.error('Failed to fetch team members:', error);
        } finally {
            setIsLoadingTeamMembers(false);
        }
    }, []);

    useEffect(() => {
        if (activeProject?.team_id) {
            fetchTeamMembers(activeProject.team_id);
        } else {
            setTeamMembers([]);
        }
    }, [activeProject?.team_id, fetchTeamMembers]);

    const handleOpenCreateDialog = (isFolder: boolean, parentId: string | null) => {
        setCreateDialogIsFolder(isFolder);
        setCreateDialogParentId(parentId);
        setCreateDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deleteConfirmFile) {
            // If it's the active project being deleted (we hacked activeProject into deleteConfirmFile)
            if (activeProject && deleteConfirmFile.id === activeProject.id) {
                await fileManager.deleteProject(activeProject.id);
                setViewingProjectId(null);
                onProjectsUpdate?.();
            } else {
                fileManager.deleteFile(deleteConfirmFile.id);
            }
        }
        setDeleteConfirmOpen(false);
        setDeleteConfirmFile(null);
    };

    const handleTeamChange = async (teamId: string) => {
        if (!activeProject) return;
        setIsUpdating(true);
        try {
            await updateProject(activeProject.id, { teamId: teamId === 'none' ? null : teamId });
            toast.success('Project team updated');
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
            onProjectsUpdate?.();
        } catch (error) {
            console.error('Failed to update project team:', error);
            toast.error('Failed to attach team to project');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleLinkConnection = async (connectionId: string) => {
        if (!viewingProjectId) return;
        setIsUpdating(true);
        try {
            await addProjectConnection(viewingProjectId, connectionId);
            toast.success('Connection linked to project');
            fetchConnections();
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
        } catch (error) {
            console.error('Failed to link connection:', error);
            toast.error('Failed to link connection');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUnlinkConnection = async (connectionId: string) => {
        if (!viewingProjectId) return;
        setIsUpdating(true);
        try {
            await removeProjectConnection(viewingProjectId, connectionId);
            toast.success('Connection unlinked from project');
            fetchConnections();
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
        } catch (error) {
            console.error('Failed to unlink connection:', error);
            toast.error('Failed to unlink connection');
        } finally {
            setIsUpdating(false);
        }
    };

    // Fetch files for the project being viewed (separate from active project files)
    const [viewingProjectFiles, setViewingProjectFiles] = useState<SqlFile[]>([]);

    useEffect(() => {
        if (!viewingProjectId) {
            setViewingProjectFiles([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { files } = await getFiles(viewingProjectId);
                if (!cancelled) setViewingProjectFiles(files || []);
            } catch {
                if (!cancelled) setViewingProjectFiles([]);
            }
        })();
        return () => { cancelled = true; };
    }, [viewingProjectId]);

    const projectFiles = useMemo(() => {
        if (!viewingProjectId) return [];
        return viewingProjectFiles;
    }, [viewingProjectFiles, viewingProjectId]);

    if (viewingProjectId && activeProject) {
        return (
            <div className="bg-background animate-in fade-in duration-200">
                <div className="flex items-center gap-4 p-4 border-b">
                    <Button variant="ghost" size="icon" onClick={() => setViewingProjectId(null)}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            {activeProject.name}
                            <Badge variant="outline">{activeProject.visibility}</Badge>
                        </h3>
                        <p className="text-sm text-muted-foreground">{activeProject.description || 'No description'}</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <Tabs defaultValue="files">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                            <TabsTrigger 
                                value="files" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                <FolderTree className="w-4 h-4 mr-2" />
                                Files
                            </TabsTrigger>
                            <TabsTrigger 
                                value="team" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Team Access
                            </TabsTrigger>
                            <TabsTrigger 
                                value="connection" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                <Database className="w-4 h-4 mr-2" />
                                Connection
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="files" className="mt-4 rounded-lg border bg-card">
                            <ScrollArea className="h-[500px]">
                                <div className="p-4">
                                    <FileTree
                                        files={projectFiles}
                                        activeFileId={fileManager.currentFile?.id}
                                        onFileClick={(id) => {
                                            fileManager.switchToFile(id);
                                            onCloseModal();
                                        }}
                                        onOpenCreateDialog={handleOpenCreateDialog}
                                        onDeleteFile={(id) => {
                                            const fileToDelete = fileManager.files.find(f => f.id === id);
                                            if (fileToDelete) {
                                                setDeleteConfirmFile(fileToDelete);
                                                setDeleteConfirmOpen(true);
                                            }
                                        }}
                                        onMoveFile={fileManager.moveFile}
                                    />
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="team" className="mt-4 space-y-4">
                            <div className="rounded-lg border bg-card p-6 space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium">Link to a Team</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Attach this project to one of your teams to share it with team members.
                                    </p>
                                </div>
                                <div className="max-w-md flex items-center gap-4">
                                    <Select 
                                        value={activeProject.team_id || 'none'} 
                                        onValueChange={handleTeamChange}
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a team..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Team (Personal)</SelectItem>
                                            {teams.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Team members will automatically gain access to this project based on their team roles. To manage team members, go to the Collaboration tab.
                                </p>
                            </div>

                            {activeProject.team_id && (
                                <div className="rounded-lg border bg-card/50 overflow-hidden">
                                    <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Users className="w-4 h-4 text-primary" />
                                            <h4 className="text-sm font-semibold">Team Members with Access</h4>
                                        </div>
                                        <Badge variant="outline" className="font-mono text-[10px]">{teamMembers.length}</Badge>
                                    </div>
                                    <ScrollArea className="h-[200px]">
                                        <div className="p-4 space-y-3">
                                            {isLoadingTeamMembers ? (
                                                <div className="flex items-center justify-center p-8">
                                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : teamMembers.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground text-sm">
                                                    No members in this team.
                                                </div>
                                            ) : (
                                                teamMembers.map(member => (
                                                    <div key={member.user_id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden">
                                                                {member.avatar_url ? (
                                                                    <img src={member.avatar_url} alt={member.full_name || ''} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    (member.full_name || member.email || '?')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium">{member.full_name || 'Incognito User'}</div>
                                                                <div className="text-[10px] text-muted-foreground">{member.email}</div>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter h-5">
                                                            {member.role === 'owner' ? 'Admin' : member.role}
                                                        </Badge>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}

                            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 space-y-4 mt-8">
                                <div>
                                    <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Permanently delete this project and all its files. This action cannot be undone.
                                    </p>
                                </div>
                                <Button 
                                    variant="destructive" 
                                    onClick={() => {
                                        setDeleteConfirmFile({ id: activeProject.id, title: activeProject.name, is_folder: true } as SqlFile);
                                        setDeleteConfirmOpen(true);
                                    }}
                                >
                                    Delete Project
                                </Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="connection" className="mt-4">
                            <div className="rounded-lg border bg-card p-6 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium">Project Connections</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Link database connections to this project to enable schema synchronization and AI analysis.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    {isLoadingConnections ? (
                                        <div className="flex items-center justify-center p-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Connections</Label>
                                                {projectConnections.length === 0 ? (
                                                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                                                        No connections linked to this project.
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-2">
                                                        {projectConnections.map(pc => (
                                                            <div key={pc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                                                <div className="flex items-center gap-3">
                                                                    <Database className="w-4 h-4 text-blue-500" />
                                                                    <div>
                                                                        <div className="text-sm font-medium">{pc.name}</div>
                                                                        <div className="text-xs text-muted-foreground">{pc.database_name || 'PostgreSQL'}</div>
                                                                    </div>
                                                                    {pc.is_default && <Badge variant="secondary" className="text-[10px] py-0">Default</Badge>}
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => handleUnlinkConnection(pc.user_connection_id)}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2 pt-4 border-t">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Connections</Label>
                                                <div className="grid gap-2">
                                                    {userConnections
                                                        .filter(uc => !projectConnections.some(pc => pc.user_connection_id === uc.id))
                                                        .map(uc => (
                                                            <div key={uc.id} className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <Database className="w-4 h-4 text-muted-foreground" />
                                                                    <div>
                                                                        <div className="text-sm font-medium">{uc.name}</div>
                                                                        <div className="text-xs text-muted-foreground">{uc.database_name}</div>
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="h-8 gap-1"
                                                                    onClick={() => handleLinkConnection(uc.id)}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    Link
                                                                </Button>
                                                            </div>
                                                        ))
                                                    }
                                                    {userConnections.filter(uc => !projectConnections.some(pc => pc.user_connection_id === uc.id)).length === 0 && (
                                                        <div className="text-sm text-muted-foreground italic p-2">
                                                            No other available connections.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <CreateFileDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    files={projectFiles}
                    isFolder={createDialogIsFolder}
                    defaultParentId={createDialogParentId}
                    onConfirm={(name, extension, parentId) => {
                        const title = extension ? `${name}.${extension}` : name;
                        fileManager.createNewFile(title, undefined, parentId, viewingProjectId);
                    }}
                    onConfirmTemplate={(name, parentId, subfolders) => {
                        fileManager.createFolderFromTemplate(name, parentId, subfolders, viewingProjectId);
                    }}
                />

                <DeleteConfirmDialog
                    open={deleteConfirmOpen}
                    onOpenChange={setDeleteConfirmOpen}
                    onConfirm={handleConfirmDelete}
                    files={fileManager.files}
                    file={deleteConfirmFile}
                />
            </div>
        );
    }

    // Dashboard view
    return (
        <div className="p-8 space-y-8 w-full">
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Workspace Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your projects and files. Select a project to view its contents or attach a team.
                </p>
            </div>

            <div className="rounded-lg border bg-card">
                <Dashboard
                    files={fileManager.files}
                    recentFiles={fileManager.recentFiles}
                    apiProjects={projects}
                    onOpenProject={(rootId, projectId) => {
                        // This handles the "Open in Editor" click
                        if (projectId) {
                            fileManager.openProject(null, projectId);
                        } else if (rootId) {
                            fileManager.openProject(rootId, null);
                        }
                        onCloseModal();
                    }}
                    onViewProject={(id) => {
                        setViewingProjectId(id);
                    }}
                    onOpenFile={(fileId) => {
                        fileManager.switchToFile(fileId);
                        // Only close if it's a file, but project click should only set viewingProjectId
                        onCloseModal();
                    }}
                    onCreateProject={() => handleOpenCreateDialog(true, null)}
                    onCreateFile={() => handleOpenCreateDialog(false, null)}
                    isGuest={fileManager.isGuest}
                />
            </div>

            <CreateFileDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                files={fileManager.files}
                isFolder={createDialogIsFolder}
                defaultParentId={createDialogParentId}
                onConfirm={(name, extension, parentId) => {
                    const title = extension ? `${name}.${extension}` : name;
                    fileManager.createNewFile(title, undefined, parentId);
                }}
                onConfirmTemplate={(name, parentId, subfolders) => {
                    fileManager.createFolderFromTemplate(name, parentId, subfolders);
                }}
            />

            <DeleteConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={handleConfirmDelete}
                files={fileManager.files}
                file={deleteConfirmFile}
            />
        </div>
    );
}
