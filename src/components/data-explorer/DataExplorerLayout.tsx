// =============================================================================
// Data Explorer Layout
// Two-column layout: sidebar (table list) + main content (row grid)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { PanelLeftClose, PanelLeft, Database, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TableSidebar } from './TableSidebar';
import { TableGrid } from './TableGrid';
import { EmptyState } from './EmptyState';
import { SchemaSelector } from './sidebar/SchemaSelector';
import { AIChatSidebar } from './ai/AIChatSidebar';
import { AIChatMain } from './ai/AIChatMain';
import { AIChatLibrary } from './ai/AIChatLibrary';
import { AIChatProjects } from './ai/AIChatProjects';
import { useTableList, useSchemas } from '@/lib/api/data-explorer';
import type { TableInfo } from '@/lib/api/data-explorer';
import { SidebarFooter } from '@/components/layout/SidebarFooter';

interface DataExplorerLayoutProps {
  connectionId: string | null;
  onConnectionChange: (connectionId: string | null) => void;
  headerContent?: React.ReactNode;
  onOpenSettings?: () => void;
  onOpenAI?: () => void;
  isAiMode?: boolean;
  onCloseAI?: () => void;
  onTableSelectChange?: (table: TableInfo | null, schemaName: string) => void;
  onOpenAIForTable?: (tableName: string) => void;
  aiContextTable?: string | null;
  aiContextSchema?: string;
}

export function DataExplorerLayout({ connectionId, onConnectionChange, headerContent, onOpenSettings, onOpenAI, isAiMode, onCloseAI, onTableSelectChange, onOpenAIForTable, aiContextTable, aiContextSchema }: DataExplorerLayoutProps) {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [schemaName, setSchemaName] = useState('public');
  const [aiActiveView, setAiActiveView] = useState<'chat' | 'library' | 'projects'>('chat');

  // Fetch schemas list
  const { data: schemasData, isLoading: schemasLoading } = useSchemas(connectionId);
  const schemas = schemasData?.schemas || ['public'];

  // Fetch table list
  const { data: tableList, isLoading: tablesLoading, error: tablesError } = useTableList(
    connectionId,
    schemaName
  );

  // Reset selected table when schema changes
  const handleSchemaChange = useCallback((newSchema: string) => {
    setSchemaName(newSchema);
    setSelectedTable(null);
    onTableSelectChange?.(null, newSchema);
  }, [onTableSelectChange]);

  const handleTableSelect = useCallback((table: TableInfo) => {
    setSelectedTable(table);
    onTableSelectChange?.(table, schemaName);
  }, [schemaName, onTableSelectChange]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <div className="flex w-full h-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300',
          sidebarCollapsed ? 'w-12' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
          {!sidebarCollapsed && (
            <button 
              onClick={() => {
                if (isAiMode) onCloseAI?.();
                setSelectedTable(null);
                onTableSelectChange?.(null, schemaName);
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Database className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-semibold">Data Explorer</h1>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleSidebar}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Table List / AI Sidebar */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {isAiMode ? (
              <AIChatSidebar
                onCloseAI={onCloseAI!}
                activeView={aiActiveView}
                onViewChange={setAiActiveView}
              />
            ) : (
              <>
                {/* Schema Selector */}
                {connectionId && (
                  <div className="px-3 py-2 border-b border-border">
                    <SchemaSelector
                      schemas={schemas}
                      value={schemaName}
                      onChange={handleSchemaChange}
                      isLoading={schemasLoading}
                      disabled={!connectionId}
                    />
                  </div>
                )}
                <TableSidebar
                  tables={tableList?.tables || []}
                  selectedTable={selectedTable}
                  onTableSelect={handleTableSelect}
                  isLoading={tablesLoading}
                  error={tablesError}
                  hasConnection={!!connectionId}
                  onOpenAIForTable={onOpenAIForTable}
                />
              </>
            )}
          </div>
        )}

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="px-3 shrink-0">
            <SidebarFooter onOpenSettings={onOpenSettings} onOpenAI={onOpenAI} isAiMode={isAiMode} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {headerContent}
        {isAiMode ? (
          aiActiveView === 'library' ? (
            <AIChatLibrary />
          ) : aiActiveView === 'projects' ? (
            <AIChatProjects />
          ) : (
            <AIChatMain aiContextTable={aiContextTable} aiContextSchema={aiContextSchema} />
          )
        ) : selectedTable && connectionId ? (
          <TableGrid
            key={`${connectionId}-${schemaName}-${selectedTable.name}`}
            connectionId={connectionId}
            tableName={selectedTable.name}
            schemaName={schemaName}
            tableInfo={selectedTable}
          />
        ) : (
          <EmptyState hasConnection={!!connectionId} />
        )}
      </main>
    </div>
  );
}
