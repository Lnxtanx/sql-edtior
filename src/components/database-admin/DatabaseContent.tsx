// =============================================================================
// Database Content
// Main content area - NO top tabs (tabs now in left sidebar)
// =============================================================================

import { Fragment } from 'react';
import { OverviewTab } from './tabs/OverviewTab';
import { MigrationsTab } from './tabs/MigrationsTab';
import { ConfigTab } from './tabs/ConfigTab';
import { HealthTab } from './tabs/HealthTab';
import { SecurityTab } from './tabs/SecurityTab';
import { AuditTab } from './tabs/AuditTab';

export type TabType = 'overview' | 'migrations' | 'config' | 'health' | 'security' | 'audit';

interface DatabaseContentProps {
  selectedDatabaseId: string | null;
  activeTab: TabType;
}

export function DatabaseContent({
  selectedDatabaseId,
  activeTab,
}: DatabaseContentProps) {
  if (!selectedDatabaseId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Select a database from the sidebar
          </p>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      {/* No tab navigation header - tabs are in left sidebar */}
      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-background">
        {activeTab === 'overview' && (
          <OverviewTab databaseId={selectedDatabaseId} />
        )}
        {activeTab === 'migrations' && (
          <MigrationsTab databaseId={selectedDatabaseId} />
        )}
        {activeTab === 'config' && (
          <ConfigTab databaseId={selectedDatabaseId} />
        )}
        {activeTab === 'health' && (
          <HealthTab databaseId={selectedDatabaseId} />
        )}
        {activeTab === 'security' && (
          <SecurityTab databaseId={selectedDatabaseId} />
        )}
        {activeTab === 'audit' && (
          <AuditTab databaseId={selectedDatabaseId} />
        )}
      </div>
    </Fragment>
  );
}
