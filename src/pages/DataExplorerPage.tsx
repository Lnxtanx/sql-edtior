// =============================================================================
// Data Explorer Page
// Professional database explorer with table browsing and data inspection
// =============================================================================

import { useState, useCallback } from 'react';
import { DataExplorerLayout } from '@/components/data-explorer';
import { ConnectionSelector } from '@/components/data-explorer/ConnectionSelector';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2, ChevronRight } from 'lucide-react';
import { SettingsModal } from '@/components/settings';
import { ExportButton } from '@/components/data-explorer/ExportButton';
import type { TableInfo } from '@/lib/api/data-explorer/types';
import { SEO, SEO_PAGES, getCanonicalUrl } from '@/lib/seo';

export default function DataExplorerPage() {
  const { user, loading: authLoading, isLoggingIn, signOut, signInWithGoogle } = useAuth();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const pageSeo = SEO_PAGES.dataExplorer;

  // Toggle for the full-page AI interface
  const [isAiMode, setIsAiMode] = useState(false);

  // Table context for AI (when user clicks AI icon on a specific table)
  const [aiContextTable, setAiContextTable] = useState<string | null>(null);

  // Track selected table and schema for export
  const [selectedTable, setSelectedTable] = useState<{ table: TableInfo | null, schema: string }>({
    table: null,
    schema: 'public'
  });

  const handleConnectionChange = useCallback((newConnectionId: string | null) => {
    setConnectionId(newConnectionId);
    setSelectedTable({ table: null, schema: 'public' });
  }, []);

  const handleTableSelectChange = useCallback((table: TableInfo | null, schemaName: string) => {
    setSelectedTable({ table, schema: schemaName });
  }, []);

  // Auth loading state or redirect processing
  if (authLoading || isLoggingIn) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          {isLoggingIn ? 'Signing you in...' : 'Initializing Data Explorer...'}
        </p>
      </div>
    );
  }

  return (
    <>
      <SEO title={pageSeo.title} description={pageSeo.description} canonical={getCanonicalUrl(pageSeo.path)} />
      <div className="h-screen flex bg-background">
        <DataExplorerLayout
          isAiMode={isAiMode}
          onCloseAI={() => setIsAiMode(false)}
          connectionId={connectionId}
          onConnectionChange={handleConnectionChange}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAI={() => setIsAiMode(prev => !prev)}
          onTableSelectChange={handleTableSelectChange}
          // Pass header content to the layout
          headerContent={
            <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-card w-full shrink-0">
              {/* Left: Connection + breadcrumb + table actions */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-44 shrink-0">
                  <ConnectionSelector
                    selectedConnectionId={connectionId}
                    onConnectionChange={handleConnectionChange}
                  />
                </div>
                {selectedTable.table && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                    <ChevronRight className="w-3 h-3" />
                    <span>{selectedTable.schema}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedTable.table.name}</span>
                  </div>
                )}
                {/* Portal target for table grid actions (Filter, Columns, Refresh, etc.) */}
                <div id="table-actions-portal" className="flex items-center gap-1 ml-2" />
              </div>

              {/* Right: AI + Export */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedTable.table && (
                  <button
                    onClick={() => { setAiContextTable(selectedTable.table?.name || null); setIsAiMode(true); }}
                    className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    title="Ask Resona AI about this table"
                  >
                    <img src="/resona.png" alt="Resona" className="w-4 h-4" />
                  </button>
                )}
                <ExportButton
                  connectionId={connectionId}
                  tableName={selectedTable.table?.name || ''}
                  schemaName={selectedTable.schema}
                />
              </div>
            </div>
          }
          onOpenAIForTable={(tableName: string) => { setAiContextTable(tableName); setIsAiMode(true); }}
          aiContextTable={aiContextTable}
          aiContextSchema={selectedTable.schema}
        />
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        signOut={signOut}
        signInWithGoogle={signInWithGoogle}
      />
    </>
  );
}
