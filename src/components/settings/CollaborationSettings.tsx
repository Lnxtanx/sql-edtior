import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Loader2, Mail, Shield, Trash2, UserPlus, Users, Plus, 
    Database, CheckSquare, Square, ExternalLink, Settings2,
    Lock, Globe, Info, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    listTeams,
    createTeam,
    getTeamMembers,
    inviteTeamMember,
    removeTeamMember,
    Team,
    TeamMember,
    TeamInvitation,
    getTeamInvitations,
    revokeTeamInvitation,
    updateProject,
    listProjects,
    getProjectConnections,
    Project,
} from '@/lib/file-management/api/client';
import { useConnections } from '@/lib/api/connection';

interface CollaborationSettingsProps {
    user?: { id?: string } | null;
    onNavigateToProject?: (projectId: string) => void;
}

const queryKeys = {
    teams: ['collaboration', 'teams'],
    members: (teamId: string) => ['collaboration', 'members', teamId],
    invites: (teamId: string) => ['collaboration', 'invites', teamId],
    projects: ['collaboration', 'projects'],
};

export function CollaborationSettings({ user, onNavigateToProject }: CollaborationSettingsProps) {
    const queryClient = useQueryClient();
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [email, setEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

    // ─── Data Fetching (React Query) ─────────────────────────────────────────

    const { data: teams = [] } = useQuery({
        queryKey: queryKeys.teams,
        queryFn: async () => {
            const res = await listTeams();
            if (res.teams.length > 0 && !selectedTeamId) setSelectedTeamId(res.teams[0].id);
            return res.teams;
        },
        enabled: !!user,
    });

    const selectedTeam = useMemo(() => teams.find(t => t.id === selectedTeamId), [teams, selectedTeamId]);

    const { data: memberData, isLoading: membersLoading } = useQuery({
        queryKey: queryKeys.members(selectedTeamId),
        queryFn: () => getTeamMembers(selectedTeamId),
        enabled: !!selectedTeamId,
    });

    const members = memberData?.members || [];
    const currentRole = memberData?.currentRole || 'member';
    const canManage = currentRole === 'owner' || currentRole === 'admin';

    const { data: invitations = [] } = useQuery({
        queryKey: queryKeys.invites(selectedTeamId),
        queryFn: async () => {
            const res = await getTeamInvitations(selectedTeamId);
            return res.invitations;
        },
        enabled: !!selectedTeamId && canManage,
    });

    const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
        queryKey: queryKeys.projects,
        queryFn: async () => {
            const res = await listProjects();
            return res.projects;
        },
        enabled: !!user,
    });

    // ─── Mutations (Optimistic Updates) ──────────────────────────────────────

    const toggleProjectMutation = useMutation({
        mutationFn: ({ id, isLinked }: { id: string, isLinked: boolean }) => 
            updateProject(id, { teamId: isLinked ? null : selectedTeamId }),
        onMutate: async ({ id, isLinked }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.projects });
            const previous = queryClient.getQueryData(queryKeys.projects);
            queryClient.setQueryData(queryKeys.projects, (old: Project[]) => 
                old.map(p => p.id === id ? { ...p, team_id: isLinked ? null : selectedTeamId } : p)
            );
            return { previous };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(queryKeys.projects, context?.previous);
            toast.error('Failed to update project');
        },
        onSuccess: () => {
            toast.success('Project updated');
        }
    });

    const inviteMutation = useMutation({
        mutationFn: (data: { email: string, role: any }) => inviteTeamMember(selectedTeamId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invites(selectedTeamId) });
            setEmail('');
            toast.success('Invitation sent');
        },
        onError: (err: any) => toast.error(err.message || 'Failed to send invite')
    });

    const removeMemberMutation = useMutation({
        mutationFn: (memberUserId: string) => removeTeamMember(selectedTeamId, memberUserId),
        onMutate: async (memberUserId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.members(selectedTeamId) });
            const previous = queryClient.getQueryData(queryKeys.members(selectedTeamId));
            queryClient.setQueryData(queryKeys.members(selectedTeamId), (old: any) => ({
                ...old,
                members: old.members.filter((m: any) => m.user_id !== memberUserId)
            }));
            return { previous };
        },
        onSuccess: () => toast.success('Member removed'),
        onError: (err, variables, context) => {
            queryClient.setQueryData(queryKeys.members(selectedTeamId), context?.previous);
        }
    });

    // ... (rest of render logic remains, but simplified to use these hooks)
    
    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        setSubmittingCreate(true);
        try {
            const { team } = await createTeam({ name: newTeamName });
            setNewTeamName('');
            setIsCreatingTeam(false);
            await loadTeams();
            setSelectedTeamId(team.id);
            toast.success('Team created successfully!');
        } catch (error) {
            toast.error('Failed to create team');
        } finally {
            setSubmittingCreate(false);
        }
    }

    const handleInvite = async () => {
        if (!selectedTeamId) return;
        setSubmittingInvite(true);
        try {
            await inviteTeamMember(selectedTeamId, { email, role: inviteRole });
            setEmail('');
            await loadTeamData();
            toast.success('Invitation sent');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add team member');
        } finally {
            setSubmittingInvite(false);
        }
    };

    const handleRemoveMember = async (member: TeamMember) => {
        if (!selectedTeamId) return;
        try {
            await removeTeamMember(selectedTeamId, member.user_id);
            setMembers(previous => previous.filter(item => item.user_id !== member.user_id));
            toast.success('Member removed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove member');
        }
    };

    const handleRevokeInvite = async (inviteId: string) => {
        if (!selectedTeamId) return;
        try {
            await revokeTeamInvitation(selectedTeamId, inviteId);
            setInvitations(previous => previous.filter(item => item.id !== inviteId));
            toast.success('Invitation revoked');
        } catch (error) {
            toast.error('Failed to revoke invitation');
        }
    };

    const handleToggleProjectTeam = async (projectId: string, isLinked: boolean) => {
        if (!selectedTeamId || !canManage) return;
        try {
            await updateProject(projectId, { teamId: isLinked ? null : selectedTeamId });
            toast.success(isLinked ? 'Project removed from team' : 'Project added to team');
            await loadTeamData();
        } catch (error) {
            toast.error('Failed to update project');
        }
    };

    if (!user) return (
        <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Collaboration</h3>
            <Alert><AlertDescription>Sign in to manage team members.</AlertDescription></Alert>
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Teams & Collaboration</h3>
                    <p className="text-sm text-muted-foreground">Manage your workspace teams and shared resources.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingTeam(!isCreatingTeam)}>
                    <Plus className="mr-2 h-4 w-4" /> New Team
                </Button>
            </div>
            
            {isCreatingTeam && (
                <div className="rounded-xl border bg-card/50 p-5 space-y-4">
                    <h4 className="text-sm font-medium">Create a New Team</h4>
                    <div className="flex gap-2">
                        <Input placeholder="Engineering Team..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                        <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || submittingCreate}>
                            {submittingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                        </Button>
                    </div>
                </div>
            )}

            {teams.length === 0 ? (
                <Alert><AlertDescription>Create a team to enable collaboration.</AlertDescription></Alert>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border bg-card/30 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users className="h-3.5 w-3.5" />Active Team</div>
                            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                                <SelectTrigger className="bg-background/50 border-none h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="rounded-xl border bg-card/30 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Shield className="h-3.5 w-3.5" />Your Role</div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold capitalize">{currentRole}</span>
                                {selectedTeam?.is_owner && <Badge className="bg-amber-500/10 text-amber-600 border-none h-5 px-1.5 text-[10px]">OWNER</Badge>}
                            </div>
                        </div>
                    </div>

                    <Tabs defaultValue="members" className="w-full">
                        <TabsList className="bg-muted/50 p-1 rounded-xl mb-4">
                            <TabsTrigger value="members" className="rounded-lg px-4 py-2">Members</TabsTrigger>
                            <TabsTrigger value="projects" className="rounded-lg px-4 py-2">Manage Projects</TabsTrigger>
                            <TabsTrigger value="connections" className="rounded-lg px-4 py-2">Shared Connections</TabsTrigger>
                        </TabsList>

                        <TabsContent value="members" className="space-y-6 animate-in fade-in duration-300">
                            {/* Add Teammate Section */}
                            <div className="rounded-xl border bg-card/50 p-5 space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4 text-primary" />Add Teammate</div>
                                <div className="flex gap-2">
                                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className="flex-1 h-9" />
                                    <Select value={inviteRole} onValueChange={v => setInviteRole(v as any)}>
                                        <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="admin" disabled={currentRole !== 'owner'}>Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleInvite} disabled={!email.trim() || submittingInvite} className="h-9 px-4">Invite</Button>
                                </div>
                            </div>

                            {/* Member List */}
                            <ScrollArea className="h-[300px] rounded-xl border bg-card/30">
                                <div className="p-4 space-y-4">
                                    {members.map(member => (
                                        <div key={member.user_id} className="flex items-center justify-between group p-2 hover:bg-muted/30 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                    {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" /> : (member.full_name || member.email || '?')[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium">{member.full_name || 'Anonymous'}</div>
                                                    <div className="text-xs text-muted-foreground opacity-70">{member.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] uppercase h-5">{member.role}</Badge>
                                                {canManage && !member.is_owner && member.user_id !== user?.id && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveMember(member)}><Trash2 className="h-4 w-4" /></Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {invitations.filter(i => i.status === 'pending').length > 0 && (
                                        <div className="pt-4 space-y-3">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">Pending</p>
                                            {invitations.filter(i => i.status === 'pending').map(i => (
                                                <div key={i.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                                    <div className="text-xs font-medium px-2">{i.email} <span className="opacity-50 ml-1">({i.role})</span></div>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-500/10" onClick={() => handleRevokeInvite(i.id)}><X className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="projects" className="space-y-4 animate-in fade-in duration-300">
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3">
                                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-primary">Manage Team Projects</p>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        Linking a project to this team grants all members <b>Editor</b> access. 
                                        Members can view all database connections linked to these projects.
                                    </p>
                                </div>
                            </div>

                            <ScrollArea className="h-[400px] rounded-xl border bg-card/30">
                                <div className="p-4 space-y-2">
                                    {allProjects.length === 0 ? (
                                        <div className="py-20 text-center text-muted-foreground italic">
                                            No projects found. Create a project in the SQL Editor first.
                                        </div>
                                    ) : (
                                        allProjects.map(project => {
                                            const isLinked = project.team_id === selectedTeamId;
                                            const isOtherTeam = project.team_id && project.team_id !== selectedTeamId;
                                            
                                            return (
                                                <div key={project.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isLinked ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-background hover:bg-muted/10'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg ${isLinked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                            <Settings2 className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold flex items-center gap-2">
                                                                {project.name}
                                                                {isLinked && <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4">TEAM SHARED</Badge>}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {project.visibility === 'private' ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                                                                <span className="text-[10px] text-muted-foreground uppercase">{project.visibility}</span>
                                                                {isOtherTeam && <Badge variant="secondary" className="h-4 text-[9px]">Shared with another team</Badge>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant={isLinked ? "destructive" : "outline"} 
                                                        size="sm" 
                                                        disabled={(isOtherTeam || !canManage) && !selectedTeam?.is_owner}
                                                        onClick={() => handleToggleProjectTeam(project.id, isLinked)}
                                                        className={`h-8 rounded-lg text-xs font-semibold ${!isLinked && 'border-primary/20 text-primary hover:bg-primary/5'}`}
                                                    >
                                                        {isLinked ? 'Unshare' : 'Share with Team'}
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="connections" className="space-y-4 animate-in fade-in duration-300">
                            <div className="rounded-xl border bg-card/30 overflow-hidden">
                                <div className="px-5 py-4 bg-muted/30 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <Database className="w-4 h-4 text-primary" />
                                        Shared Database Connections
                                    </div>
                                    <Badge variant="secondary" className="font-mono">{sharedConnections.length}</Badge>
                                </div>
                                <div className="p-4">
                                    {sharedConnections.length === 0 ? (
                                        <div className="text-center py-10 opacity-50 space-y-2">
                                            <Database className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                            <p className="text-sm">No connections are currently shared.</p>
                                            <p className="text-[10px]">Connections are shared automatically when you link a project that uses them.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {sharedConnections.map(conn => (
                                                <div key={conn.id} className="p-4 rounded-xl border bg-background flex flex-col gap-2 relative group">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg bg-muted"><Database className="w-4 h-4 text-primary" /></div>
                                                            <div>
                                                                <div className="text-sm font-bold truncate max-w-[150px]">{conn.name}</div>
                                                                <div className="text-[10px] text-muted-foreground font-mono truncate">{conn.database}</div>
                                                            </div>
                                                        </div>
                                                        {conn.isDefault && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-none">DEFAULT</Badge>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}

function X({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}
