
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import SqlEditor from '@/components/sql-editor/SqlEditor';
import DiagramCanvas from '@/components/er-diagram';
import { ParsedSchema, parsePostgresSQL, SAMPLE_SQL, Table } from '@/lib/sql-parser';
import { generatePostgresSQL } from '@/lib/schema-utils/schema-generators';
import { useAuth } from '@/components/auth/AuthProvider';
import { useFileManager } from '@/hooks/useFileManager';
import { useDocumentSession, useDocumentStoreVersion } from '@/hooks/useDocumentSession';
import { useDebounce } from '@/hooks/useDebounce';
import { Loader2 } from 'lucide-react';
import { GraphStats } from '@/lib/schema-workspace';
import { SettingsModal } from '@/components/settings';
import { CurrentFileProvider } from '@/components/connection/CurrentFileContext';
import { acceptProjectInvitation, acceptTeamInvitation, getInvitationInfo, InvitationInfo } from '@/lib/file-management/api/client';
import { InvitationReviewModal } from '@/components/auth/InvitationReviewModal';

import { SubgraphConfig } from '@/components/schema-workspace/SubgraphPanel';
import { SEO, SEO_PAGES, getCanonicalUrl } from '@/lib/seo';

export default function Index() {
  const { user, signInWithGoogle, signOut, loading: authLoading } = useAuth();

  const pageSeo = SEO_PAGES.home;

  const [schema, setSchema] = useState<ParsedSchema | null>(null);

  // Sidebar state handled by SqlEditor internally now
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [aiAnalyzingTable, setAiAnalyzingTable] = useState<Table | null>(null);
  const [showGlobalAI, setShowGlobalAI] = useState(false);
  const [globalAIPrompt, setGlobalAIPrompt] = useState<string>('');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Invitation State
  const [pendingInviteInfo, setPendingInviteInfo] = useState<InvitationInfo | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);

  // Subgraph State
  const [subgraphConfig, setSubgraphConfig] = useState<SubgraphConfig>({
    focusTable: null,
    depth: 1,
    direction: 'both',
    showViews: true,
    showMaterializedViews: true,
  });

  // Graph Settings Panel State (opened from SubgraphPanel gear icon)
  const [openGraphSettings, setOpenGraphSettings] = useState(false);

  const fileManager = useFileManager();
  const documentSession = useDocumentSession({
    file: fileManager.currentFile,
    userId: user?.id,
    autosaveEnabled: fileManager.autosaveEnabled,
  });
  const sql = documentSession.sql || '';
  const documentVersion = useDocumentStoreVersion();

  const mergedSql = useMemo(
    () => fileManager.getMergedSQL(),
    [fileManager.getMergedSQL, fileManager.files, documentVersion],
  );
  const debouncedMergedSql = useDebounce(mergedSql, 300);
  const lastParsedSqlRef = useRef<string | null>(null);

  useEffect(() => {
    if (fileManager.loading && user) return;
    if (debouncedMergedSql === lastParsedSqlRef.current) return;

    lastParsedSqlRef.current = debouncedMergedSql;

    let cancelled = false;
    const parseWork = () => {
      if (cancelled) return;

      try {
        const parsed = parsePostgresSQL(debouncedMergedSql);
        if (!cancelled) {
          setSchema(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const parseTimer = ('requestIdleCallback' in window)
      ? (window as any).requestIdleCallback(parseWork, { timeout: 250 })
      : setTimeout(parseWork, 0);

    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(parseTimer);
      } else {
        clearTimeout(parseTimer);
      }
    };
  }, [debouncedMergedSql, fileManager.loading, user]);

  // Keyboard shortcut: Cmd/Ctrl + K to open AI for selected table
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (selectedTableName && schema) {
          const table = schema.tables.find(t => t.name === selectedTableName || `${t.schema || 'public'}.${t.name}` === selectedTableName);
          if (table) {
            setAiAnalyzingTable(table);
            return;
          }
        }
        if (schema && schema.tables.length > 0) {
          setAiAnalyzingTable(schema.tables[0]);
        }
      }
      if (e.key === 'Escape') {
        if (aiAnalyzingTable) setAiAnalyzingTable(null);
        // Deselect and clear focus mode on Escape
        setSelectedTableName(null);
        setSubgraphConfig(prev => ({ ...prev, focusTable: null }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [schema, selectedTableName, aiAnalyzingTable]);
  
  // Handle Invitations Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectInviteToken = params.get('invite');
    const teamInviteToken = params.get('teamInvite');
    const token = projectInviteToken || teamInviteToken;
    const type = projectInviteToken ? 'project' : 'team';

    if (token) {
      setInviteToken(token);
      const fetchInfo = async () => {
        try {
          const info = await getInvitationInfo(token, type as 'team' | 'project');
          setPendingInviteInfo(info);
        } catch (error) {
          console.error('[Invitation] Info fetch failed:', error);
          // Toast only if we actually tried and failed (to avoid double toasts on refresh)
          if (!pendingInviteInfo) {
            toast.error('Invalid or expired invitation link');
          }
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      fetchInfo();
    }
  }, []);

  const handleAcceptInvite = async () => {
    if (!inviteToken || !pendingInviteInfo || !user) return;
    setIsProcessingInvite(true);
    try {
      if (pendingInviteInfo.type === 'project') {
        const res = await acceptProjectInvitation(inviteToken);
        if (res.success) {
          toast.success('Joined project successfully!');
          fileManager.refreshProjects();
          if (res.invitation.project_id) {
            fileManager.openProject(res.invitation.project_id);
          }
        }
      } else {
        const res = await acceptTeamInvitation(inviteToken);
        if (res.success) {
          toast.success('Joined team successfully!');
          fileManager.refreshProjects();
        }
      }
      setPendingInviteInfo(null);
      setInviteToken(null);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error: any) {
      console.error('[Invitation] Accept failed:', error);
      toast.error(error.message || 'Failed to join');
    } finally {
      setIsProcessingInvite(false);
    }
  };

  const handleDeclineInvite = () => {
    setPendingInviteInfo(null);
    setInviteToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Handle SQL change from editor
  const handleSqlChange = useCallback((newSql: string) => {
    documentSession.setSql(newSql);
  }, [documentSession]);

  // Handle schema change from editor
  const handleSchemaChange = useCallback((newSchema: ParsedSchema) => {
    setSchema(newSchema);
  }, []);

  // Handle table click for editing
  const handleTableClick = useCallback((tableName: string) => {
    const table = schema?.tables.find(t => t.name === tableName || `${t.schema || 'public'}.${t.name}` === tableName);
    if (table) {
      setEditingTable(table);
    }
  }, [schema]);

  // Handle table save from modal (bidirectional editing)
  const handleTableSave = useCallback((updatedTable: Table) => {
    if (!schema) return;
    const newTables = schema.tables.map(t =>
      t.name === editingTable?.name ? updatedTable : t
    );

    // Create a temporary schema just to generate the updated SQL
    const tempSchema: ParsedSchema = { ...schema, tables: newTables };
    const newSql = generatePostgresSQL(tempSchema);

    // Update the SQL directly. The useDebounce will trigger a proper 
    // parsePostgresSQL pass and rebuild the schema accurately with full relationships.
    documentSession.setSql(newSql);
    setEditingTable(null);
  }, [schema, editingTable, documentSession]);

  // Handle AI-generated SQL application
  const handleApplyAISQL = useCallback((aiSql: string) => {
    const newSql = sql.trim() + '\n\n-- AI Generated:\n' + aiSql;
    documentSession.setSql(newSql);
    const newSchema = parsePostgresSQL(newSql);
    setSchema(newSchema);
    toast.success('AI changes applied', {
      description: 'The SQL has been updated. Review the changes in the editor.',
    });
  }, [sql, documentSession]);

  // Terminal pull should replace the current file content (not append like AI proposals).
  const handleReplaceSqlFromPull = useCallback((pulledSql: string) => {
    documentSession.setSql(pulledSql);
  }, [documentSession]);

  // Handle table AI analysis request
  const handleTableAI = useCallback((tableName: string, nodePosition?: { x: number; y: number }) => {
    const table = schema?.tables.find(t => t.name === tableName || `${t.schema || 'public'}.${t.name}` === tableName);
    if (table) {
      setAiAnalyzingTable(table);
      setSelectedTableName(tableName);
      // Ensure focusing table shifts diagram context so context aligns
      setSubgraphConfig(prev => ({ ...prev, focusTable: tableName }));
    }
  }, [schema]);

  const handleCloseTableAI = useCallback(() => setAiAnalyzingTable(null), []);
  const handleOpenGlobalAI = useCallback((prompt?: string) => {
    if (prompt && typeof prompt === 'string') {
      setGlobalAIPrompt(prompt);
    } else {
      setGlobalAIPrompt('');
    }
    setShowGlobalAI(true);
  }, []);
  const handleCloseGlobalAI = useCallback(() => {
    setShowGlobalAI(false);
    setGlobalAIPrompt('');
  }, []);
  const handleTableSelect = useCallback((tableName: string | null) => {
    setSelectedTableName(tableName);
    if (tableName) {
      setSubgraphConfig(prev => ({ ...prev, focusTable: tableName, showViews: true, showMaterializedViews: true }));
    } else {
      setSubgraphConfig(prev => ({ ...prev, focusTable: null }));
    }
  }, []);

  // Stabilize array references so DiagramCanvas + useLayoutEngine don't
  // re-run ELK on every Index re-render. schema.tables is a new array each
  // time parsePostgresSQL runs, but its identity only matters when schema changes.
  const stableTables = useMemo(() => schema?.tables ?? [], [schema]);
  const stableRelationships = useMemo(() => schema?.relationships ?? [], [schema]);

  // Show loading only for initial data fetch
  if (authLoading) {
    return <div className="h-screen w-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <CurrentFileProvider value={{ 
      fileId: fileManager.currentFile?.id || null, 
      fileName: fileManager.currentFile?.title || null, 
      connectionId: fileManager.currentFile?.connection_id || fileManager.currentProject?.default_connection_id || null,
      projectId: fileManager.activeProjectId || fileManager.activeRootId || null, 
      projectName: fileManager.currentProject?.name || null, 
      schema, 
      sql, 
      mergedSql: debouncedMergedSql 
    }}>
      <SEO title={pageSeo.title} description={pageSeo.description} canonical={getCanonicalUrl(pageSeo.path)} schema="webApplication" />
      <TooltipProvider delayDuration={200}>
        <div className="h-screen flex flex-col overflow-hidden bg-background">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            <SqlEditor
              onSchemaChange={handleSchemaChange}
              onSqlChange={handleSqlChange}
              sql={sql}
              mergedSql={mergedSql}
              schema={schema}
              onApplySQL={handleApplyAISQL}
              // File management props
              files={fileManager.files}
              workspaceFiles={fileManager.workspaceFiles}
              isFilesLoading={fileManager.loading}
              recentFiles={fileManager.recentFiles}
              activeRootId={fileManager.activeRootId}
              currentProject={fileManager.currentProject}
              onSetActiveRootId={fileManager.setActiveRootId}
              activeProjectId={fileManager.activeProjectId}
              onSetActiveProjectId={fileManager.setActiveProjectId}
              onOpenProject={fileManager.openProject}
              onCreateProject={fileManager.createProject}
              currentFile={fileManager.currentFile}
              saving={documentSession.saving}
              lastSaved={documentSession.lastSavedAt}
              autosaveEnabled={fileManager.autosaveEnabled}
              isOnline={fileManager.isOnline}
              hasPendingOperations={fileManager.hasPendingOperations}
              onSwitchFile={fileManager.switchToFile}
              onPreviewFile={fileManager.previewFile}
              onCreateFile={(name, ext, parentId) => fileManager.createNewFile(name, undefined, parentId)}
              onRenameFile={fileManager.renameFile}
              onDeleteFile={fileManager.deleteFile}
              onDeleteProject={fileManager.deleteProject}
              onToggleAutosave={fileManager.toggleAutosave}
              onManualSave={documentSession.saveNow}
              onImportFile={fileManager.importFile}
              openTabs={fileManager.openTabs}
              activeTabId={fileManager.activeTabId}
              onCloseTab={fileManager.closeTab}
              onCloseOtherTabs={fileManager.closeOtherTabs}
              onCloseAllTabs={fileManager.closeAllTabs}
              onCreateFolder={(name, parentId) => fileManager.createFolder(name, parentId)}
              onCreateFolderFromTemplate={(title, parentId, subfolders) => fileManager.createFolderFromTemplate(title, parentId, subfolders)}
              onMoveFile={fileManager.moveFile}
              previewTabId={fileManager.previewTabId}
              onPinTab={fileManager.pinTab}
              onDownloadFile={fileManager.downloadCurrentFile}
              onFileDoubleClick={fileManager.switchToFile}
              onCreateFileInFolder={(folderId) => fileManager.createNewFile(undefined, undefined, folderId)}
              isGuest={fileManager.isGuest}
              canCreateFile={fileManager.canCreateFile}
              apiProjects={fileManager.projects}
              subgraphConfig={subgraphConfig}
              onSubgraphConfigChange={setSubgraphConfig}
              graphStats={graphStats}
              onOpenSettings={() => setShowSettings(true)}
              onOpenGraphSettings={() => setOpenGraphSettings(true)}
              searchQuery={searchQuery}
            >
              {/* Diagram Area */}
              <div className="flex-1 flex flex-col min-h-0 h-full">
                <DiagramCanvas
                  tables={stableTables}
                  relationships={stableRelationships}
                  schema={schema}
                  onTableClick={handleTableClick}
                  onTableAI={handleTableAI}
                  onTableSelect={handleTableSelect}
                  onApplySQL={handleReplaceSqlFromPull}
                  showGlobalAI={showGlobalAI}
                  user={user}
                  signInWithGoogle={signInWithGoogle}
                  signOut={signOut}
                  subgraphConfig={subgraphConfig}
                  onStatsChange={setGraphStats}
                  editingTable={editingTable}
                  onEditChange={handleTableSave}
                  onEditClose={() => setEditingTable(null)}
                  onSubgraphConfigChange={setSubgraphConfig}
                  openGraphSettings={openGraphSettings}
                  onGraphSettingsClosed={() => setOpenGraphSettings(false)}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              </div>
            </SqlEditor>
          </div>



          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            user={user}
            signOut={signOut}
            signInWithGoogle={signInWithGoogle}
            currentProjectId={fileManager.activeProjectId}
            projects={fileManager.projects}
          />

          <InvitationReviewModal
            isOpen={!!pendingInviteInfo}
            onClose={() => setPendingInviteInfo(null)}
            invitation={pendingInviteInfo}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
            isAuthenticated={!!user}
            onSignIn={signInWithGoogle}
            isProcessing={isProcessingInvite}
          />

          <Toaster position="bottom-right" />
        </div>
      </TooltipProvider>
    </CurrentFileProvider>
  );
}
