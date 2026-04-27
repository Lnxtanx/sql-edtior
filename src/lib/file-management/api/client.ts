// =============================================================================
// Files API Client
// Frontend SQL file management API calls
// =============================================================================

import { get, post, patch, del } from '@/lib/api/client';

// =============================================================================
// Types
// =============================================================================

export interface SqlFile {
    id: string;
    title: string;
    content?: string;  // Optional: managed by DocumentSessionStore, not cached in React Query
    connection_id?: string | null;
    parent_id?: string | null;
    project_id?: string | null;
    is_folder?: boolean;
    is_current?: boolean;
    file_extension?: string;
    sort_order?: number;
    created_at: string;
    updated_at: string;
}

export interface FilesListResponse {
    files: SqlFile[];
    nextCursor?: string | null;
}

export interface FileResponse {
    file: SqlFile;
}

export interface LinkedConnection {
    id: string;
    name: string;
    database_name?: string;
    ssl_mode?: string;
    created_at?: string;
}

export interface LinkConnectionResponse {
    success: boolean;
    file: SqlFile;
    connection: LinkedConnection;
}

export interface UnlinkConnectionResponse {
    success: boolean;
    file: SqlFile;
}

export interface GetConnectionResponse {
    connection: LinkedConnection | null;
    projectConnectionId?: string | null;
}

export interface Project {
    id: string;
    name: string;
    description?: string | null;
    slug?: string;
    owner_id?: string;
    visibility: 'private' | 'team' | 'public';
    default_connection_id?: string | null;
    team_id?: string | null;
    settings?: Record<string, unknown>;
    archived_at?: string | null;
    role?: string;
    is_owner?: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProjectListResponse {
    projects: Project[];
}

export interface ProjectResponse {
    project: Project;
}

export interface ProjectLinkResponse {
    success: boolean;
    project: { id: string; name: string; default_connection_id: string | null };
    connection: LinkedConnection;
    projectConnection?: {
        id: string;
        project_id: string;
        user_connection_id: string;
        is_default: boolean;
        connection_type: string;
    };
}

export interface ProjectMember {
    user_id: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    joined_at: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    is_owner: boolean;
}

export interface ProjectMembersResponse {
    members: ProjectMember[];
    currentRole: ProjectMember['role'];
}

export interface ProjectInvitation {
    id: string;
    project_id?: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
    expires_at: string;
    accepted_at?: string | null;
    created_at: string;
    invited_by: string;
}

export interface ProjectInvitationsResponse {
    invitations: ProjectInvitation[];
}

export interface Team {
    id: string;
    name: string;
    slug?: string;
    owner_id?: string;
    avatar_url?: string | null;
    settings?: Record<string, unknown>;
    role?: 'owner' | 'admin' | 'member';
    is_owner?: boolean;
    created_at: string;
    updated_at: string;
}

export interface TeamListResponse {
    teams: Team[];
}

export interface TeamResponse {
    team: Team;
}

export interface TeamMember {
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    is_owner: boolean;
}

export interface TeamMembersResponse {
    members: TeamMember[];
    currentRole: TeamMember['role'];
}

// Invitation Review Info
export interface InvitationInfo {
    id: string;
    type: 'team' | 'project';
    projectId?: string;
    teamId?: string;
    teamName?: string;
    projectName?: string;
    inviterName: string;
    role: string;
    email: string;
    status: string;
    expiresAt: string;
}

// =============================================================================
// Files API Functions
// =============================================================================

/**
 * Get SQL files. If projectId is provided, returns project files.
 * Otherwise returns user's personal files.
 */
export async function getFiles(projectId?: string): Promise<FilesListResponse> {
    const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return get<FilesListResponse>(`/api/files${params}`);
}

/**
 * Get a specific file by ID
 */
export async function getFile(id: string): Promise<FileResponse> {
    return get<FileResponse>(`/api/files/${id}`);
}

/**
 * Create a new SQL file
 */
export async function createFile(params: {
    title?: string;
    content?: string;
    parent_id?: string | null;
    is_folder?: boolean;
    file_extension?: string;
    project_id?: string | null;
}): Promise<FileResponse> {
    return post<FileResponse>('/api/files', params);
}

/**
 * Update a file (for autosave)
 */
export async function updateFile(
    id: string,
    params: {
        title?: string;
        content?: string;
        is_current?: boolean;
        parent_id?: string | null;
        sort_order?: number;
        file_extension?: string;
        expected_updated_at?: string;
    }
): Promise<FileResponse> {
    return patch<FileResponse>(`/api/files/${id}`, params);
}

/**
 * Delete a file
 */
export async function deleteFile(id: string): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/files/${id}`);
}

// =============================================================================
// File-Connection Linking
// =============================================================================

/**
 * Link a file to a database connection
 */
export async function linkFileToConnection(
    fileId: string,
    projectConnectionId: string
): Promise<LinkConnectionResponse> {
    return post<LinkConnectionResponse>(
        `/api/files/${fileId}/link-connection`,
        { projectConnectionId }
    );
}

/**
 * Unlink a file from its database connection
 */
export async function unlinkFileFromConnection(
    fileId: string
): Promise<UnlinkConnectionResponse> {
    return del<UnlinkConnectionResponse>(`/api/files/${fileId}/unlink-connection`);
}

/**
 * Get the linked connection for a file
 */
export async function getFileConnection(
    fileId: string
): Promise<GetConnectionResponse> {
    return get<GetConnectionResponse>(`/api/files/${fileId}/connection`);
}

// =============================================================================
// Project API Functions
// =============================================================================

export async function listProjects(): Promise<ProjectListResponse> {
    return get<ProjectListResponse>('/api/files/projects');
}

export async function getProject(id: string): Promise<ProjectResponse> {
    return get<ProjectResponse>(`/api/files/projects/${id}`);
}

export async function createProject(params: {
    name: string;
    description?: string;
    connectionId?: string;
    teamId?: string;
}): Promise<ProjectResponse> {
    return post<ProjectResponse>('/api/files/projects', params);
}

/**
 * Bootstrap a new project structure atomically
 */
export async function bootstrapProject(params: {
    name: string;
    content: string;
}): Promise<{ project: Project; folder: SqlFile; fileId: string; projectId?: string }> {
    return post('/api/files/projects/bootstrap', params);
}

export async function updateProject(
    id: string,
    params: { name?: string; description?: string; teamId?: string | null }
): Promise<ProjectResponse> {
    return patch<ProjectResponse>(`/api/files/projects/${id}`, params);
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/files/projects/${id}`);
}

export async function linkProjectToConnection(
    projectId: string,
    connectionId: string
): Promise<ProjectLinkResponse> {
    return post<ProjectLinkResponse>(
        `/api/files/projects/${projectId}/connections`,
        { connectionId, isDefault: true }
    );
}

export async function unlinkProjectFromConnection(
    projectId: string,
    connectionId: string
): Promise<{ message?: string }> {
    return del(`/api/files/projects/${projectId}/connections/${connectionId}`);
}

export async function getProjectConnection(
    projectId: string
): Promise<GetConnectionResponse> {
    return get<GetConnectionResponse>(`/api/files/projects/${projectId}/connections/default`);
}

/**
 * Get all available project connections (multi-connection support)
 */
export async function getProjectConnections(projectId: string): Promise<{
    connections: Array<{
        id: string;
        user_connection_id: string;
        is_default: boolean;
        connection_type: string;
    }>;
}> {
    return get(`/api/files/projects/${projectId}/connections`);
}

/**
 * Link a new connection to the project (adds to project_connections)
 */
export async function addProjectConnection(
    projectId: string,
    connectionId: string,
    isDefault?: boolean
): Promise<{ connection: any; message?: string }> {
    return post(`/api/files/projects/${projectId}/connections`, { connectionId, isDefault });
}

/**
 * Unlink a connection from the project
 */
export async function removeProjectConnection(
    projectId: string,
    connectionId: string
): Promise<{ message?: string }> {
    return del(`/api/files/projects/${projectId}/connections/${connectionId}`);
}

export async function getProjectFiles(
    projectId: string
): Promise<{ files: SqlFile[] }> {
    return get<{ files: SqlFile[] }>(`/api/files/projects/${projectId}/files`);
}

export async function getProjectMembers(
    projectId: string
): Promise<ProjectMembersResponse> {
    return get<ProjectMembersResponse>(`/api/files/projects/${projectId}/members`);
}

export async function updateProjectMemberRole(
    projectId: string,
    memberUserId: string,
    role: 'admin' | 'editor' | 'viewer'
): Promise<{ member: ProjectMember }> {
    return patch<{ member: ProjectMember }>(`/api/files/projects/${projectId}/members/${memberUserId}`, { role });
}

export async function removeProjectMember(
    projectId: string,
    memberUserId: string
): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/files/projects/${projectId}/members/${memberUserId}`);
}

export async function listProjectInvitations(
    projectId: string
): Promise<ProjectInvitationsResponse> {
    return get<ProjectInvitationsResponse>(`/api/files/projects/${projectId}/invitations`);
}

export async function inviteProjectMember(
    projectId: string,
    params: { email: string; role: 'admin' | 'editor' | 'viewer' }
): Promise<{ invitation: ProjectInvitation; email: { configured: boolean; sent: boolean; providerId?: string | null; error?: string | null } }> {
    return post(`/api/files/projects/${projectId}/invitations`, params);
}

export async function revokeProjectInvitation(
    projectId: string,
    inviteId: string
): Promise<{ success: boolean; invitation: ProjectInvitation }> {
    return del<{ success: boolean; invitation: ProjectInvitation }>(`/api/files/projects/${projectId}/invitations/${inviteId}`);
}

export async function acceptProjectInvitation(
    token: string
): Promise<{ success: boolean; invitation: ProjectInvitation & { accepted_at: string } }> {
    return post('/api/files/projects/invitations/accept', { token });
}

export async function declineProjectInvitation(
    projectId: string,
    inviteId: string
): Promise<{ success: boolean; message: string }> {
    return post(`/api/files/projects/${projectId}/invitations/${inviteId}/decline`);
}

// =============================================================================
// Teams API Functions
// =============================================================================

export async function listTeams(): Promise<TeamListResponse> {
    return get<TeamListResponse>('/api/teams');
}

export async function getTeam(id: string): Promise<TeamResponse> {
    return get<TeamResponse>(`/api/teams/${id}`);
}

export async function createTeam(params: {
    name: string;
    slug?: string;
}): Promise<TeamResponse> {
    return post<TeamResponse>('/api/teams', params);
}

export async function getTeamMembers(
    teamId: string
): Promise<TeamMembersResponse> {
    return get<TeamMembersResponse>(`/api/teams/${teamId}/members`);
}

export async function inviteTeamMember(
    teamId: string,
    params: { email: string; role: 'admin' | 'member' }
): Promise<{ success: boolean; message: string }> {
    return post<{ success: boolean; message: string }>(`/api/teams/${teamId}/invites`, params);
}

export async function removeTeamMember(
    teamId: string,
    memberUserId: string
): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/teams/${teamId}/members/${memberUserId}`);
}

export interface TeamInvitation {
    id: string;
    team_id: string;
    email: string;
    role: 'admin' | 'member';
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
    token: string;
    invited_by: string;
    expires_at: string;
    accepted_at?: string | null;
    created_at: string;
}

export async function getTeamInvitations(
    teamId: string
): Promise<{ invitations: TeamInvitation[] }> {
    return get<{ invitations: TeamInvitation[] }>(`/api/teams/${teamId}/invitations`);
}

export async function revokeTeamInvitation(
    teamId: string,
    inviteId: string
): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/teams/${teamId}/invitations/${inviteId}`);
}

export async function acceptTeamInvitation(
    token: string
): Promise<{ success: boolean; membership: any }> {
    return post<{ success: boolean; membership: any }>('/api/teams/invitations/accept', { token });
}

export async function declineTeamInvitation(
    teamId: string,
    inviteId: string
): Promise<{ success: boolean; message: string }> {
    return post(`/api/teams/${teamId}/invitations/${inviteId}/decline`);
}

/**
 * Publicly fetch invitation details for review
 */
export async function getInvitationInfo(token: string, type: 'team' | 'project'): Promise<InvitationInfo> {
    const endpoint = type === 'team'
        ? `/api/teams/invitations/info/${token}`
        : `/api/files/projects/invitations/info/${token}`;
    return get<InvitationInfo>(endpoint);
}

// =============================================================================
// Version History (Snapshots)
// =============================================================================

export type SnapshotTriggerType = 'manual' | 'auto' | 'pull' | 'push' | 'connection' | 'restore';

export interface Snapshot {
    id: string;
    version_number: number;
    trigger_type: SnapshotTriggerType;
    commit_message?: string;
    byte_size?: number;
    content?: string; // Only included when fetching single snapshot
    created_at: string;
}

export interface SnapshotsListResponse {
    snapshots: Snapshot[];
    total: number;
    hasMore: boolean;
}

export interface CreateSnapshotResponse {
    success: boolean;
    snapshot: Snapshot;
}

export interface RestoreSnapshotResponse {
    success: boolean;
    file: SqlFile;
    restoredFrom: number;
}

/**
 * Get version history for a file
 */
export async function getFileSnapshots(
    fileId: string,
    options?: { limit?: number; offset?: number }
): Promise<SnapshotsListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return get<SnapshotsListResponse>(`/api/files/${fileId}/snapshots${query}`);
}

/**
 * Create a new snapshot (save version)
 */
export async function createSnapshot(
    fileId: string,
    content: string,
    options?: { triggerType?: SnapshotTriggerType; commitMessage?: string }
): Promise<CreateSnapshotResponse> {
    return post<CreateSnapshotResponse>(`/api/files/${fileId}/snapshots`, {
        content,
        triggerType: options?.triggerType || 'manual',
        commitMessage: options?.commitMessage
    });
}

/**
 * Get a specific snapshot with content
 */
export async function getSnapshot(
    fileId: string,
    snapshotId: string
): Promise<{ snapshot: Snapshot }> {
    return get<{ snapshot: Snapshot }>(`/api/files/${fileId}/snapshots/${snapshotId}`);
}

/**
 * Restore a file to a previous snapshot
 */
export async function restoreSnapshot(
    fileId: string,
    snapshotId: string
): Promise<RestoreSnapshotResponse> {
    return post<RestoreSnapshotResponse>(`/api/files/${fileId}/snapshots/${snapshotId}/restore`, {});
}

/**
 * Delete a specific snapshot
 */
export async function deleteSnapshot(
    fileId: string,
    snapshotId: string
): Promise<{ success: boolean }> {
    return del<{ success: boolean }>(`/api/files/${fileId}/snapshots/${snapshotId}`);
}

/**
 * Cleanup old snapshots, keeping only the last N versions
 */
export async function cleanupSnapshots(
    fileId: string,
    keepCount: number = 20
): Promise<{ success: boolean; deletedCount: number }> {
    return post<{ success: boolean; deletedCount: number }>(
        `/api/files/${fileId}/snapshots/cleanup`,
        { keepCount }
    );
}

// =============================================================================
// Multi-File Project API
// =============================================================================

export interface FileTreeResponse {
    tree: SqlFile[];
}

export interface MergedSQLResponse {
    mergedSQL: string;
}

export interface FolderResponse {
    folder: SqlFile;
    message: string;
}

export interface MoveFileResponse {
    file: SqlFile;
    message: string;
}

/**
 * Get the full file/folder tree for the current user
 */
export async function getFileTree(projectId: string): Promise<FileTreeResponse> {
    const query = `?project_id=${encodeURIComponent(projectId)}`;
    return get<FileTreeResponse>(`/api/files/tree${query}`);
}

/**
 * Get merged SQL content of all project files (for workspace-merge parsing)
 */
export async function getMergedSQL(projectId: string, parentId?: string | null): Promise<MergedSQLResponse> {
    const params = new URLSearchParams({ project_id: projectId });
    if (parentId) params.set('parent_id', parentId);
    const query = `?${params.toString()}`;
    return get<MergedSQLResponse>(`/api/files/merge${query}`);
}

/**
 * Create a new folder
 */
export async function createFolder(params: {
    title?: string;
    parent_id?: string | null;
    project_id?: string | null;
}): Promise<FolderResponse> {
    return post<FolderResponse>('/api/files/folders', params);
}

/**
 * Create a folder with sub-folders from a template
 */
export async function createFolderFromTemplate(params: {
    title: string;
    parent_id?: string | null;
    project_id?: string | null;
    subfolders: string[];
}): Promise<{ folder: SqlFile; subfolders: SqlFile[]; message: string }> {
    return post('/api/files/folders/template', params);
}

/**
 * Move a file/folder to a new parent
 */
export async function moveFile(
    fileId: string,
    params: { parent_id?: string | null; sort_order?: number }
): Promise<MoveFileResponse> {
    return patch<MoveFileResponse>(`/api/files/${fileId}/move`, params);
}


