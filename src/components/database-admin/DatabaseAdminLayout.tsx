// =============================================================================
// Database Admin Layout
// Two-column layout: left sidebar + right content panel with header
// =============================================================================

import { Fragment } from 'react';
import { DatabaseSidebar } from './DatabaseSidebar';
import { DatabaseContent } from './DatabaseContent';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TabType = 'overview' | 'migrations' | 'config' | 'health' | 'security' | 'audit';

interface DatabaseAdminLayoutProps {
  selectedDatabaseId: string | null;
  selectedDatabaseName?: string;
  onDatabaseSelect: (dbId: string) => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onAddDatabaseClick?: () => void;
  onSettingsClick?: () => void;
}

export function DatabaseAdminLayout({
  selectedDatabaseId,
  selectedDatabaseName,
  onDatabaseSelect,
  activeTab,
  onTabChange,
  onAddDatabaseClick,
  onSettingsClick,
}: DatabaseAdminLayoutProps) {
  return (
    <Fragment>
      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden h-screen">
        {/* Left Sidebar */}
        <DatabaseSidebar
          selectedDatabaseId={selectedDatabaseId}
          onDatabaseSelect={onDatabaseSelect}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSettingsClick={onSettingsClick}
        />

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Right Panel Header */}
          <div className="h-16 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
            {selectedDatabaseId ? (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedDatabaseName || 'Database'}
                </h2>
                <Button
                  onClick={onAddDatabaseClick}
                  size="sm"
                  className="gap-2"
                  title="Add a new database connection"
                >
                  <Plus className="w-4 h-4" />
                  Add Database
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a database from the sidebar to get started
              </p>
            )}
          </div>

          {/* Content Area */}
          <DatabaseContent
            selectedDatabaseId={selectedDatabaseId}
            activeTab={activeTab}
          />
        </div>
      </div>
    </Fragment>
  );
}

export { DatabaseSidebar } from './DatabaseSidebar';
export { DatabaseContent } from './DatabaseContent';
