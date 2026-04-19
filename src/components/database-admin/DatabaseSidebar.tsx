// =============================================================================
// Database Sidebar
// Clean left sidebar: logo, database list, tab navigation, settings icon
// =============================================================================

import { useMemo, useState } from 'react';
import { useConnections } from '@/lib/api/connection';
import { cn } from '@/lib/utils';
import { Database, AlertCircle, Settings, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { TabType } from './DatabaseAdminLayout';

interface DatabaseSidebarProps {
  selectedDatabaseId: string | null;
  onDatabaseSelect: (dbId: string) => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSettingsClick?: () => void;
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'migrations', label: 'Migrations' },
  { id: 'config', label: 'Config' },
  { id: 'health', label: 'Health' },
  { id: 'security', label: 'Security' },
  { id: 'audit', label: 'Audit' },
];

export function DatabaseSidebar({
  selectedDatabaseId,
  onDatabaseSelect,
  activeTab,
  onTabChange,
  onSettingsClick,
}: DatabaseSidebarProps) {
  const { data: connections, isLoading, error } = useConnections();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const databases = useMemo(() => {
    return connections || [];
  }, [connections]);

  return (
    <div className={cn(
      'border-r border-border bg-background flex flex-col overflow-hidden transition-all duration-300',
      isCollapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-foreground">Database</span>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Collapse"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full p-1 hover:bg-accent rounded transition-colors flex justify-center"
            title="Expand"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </button>
        )}
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Databases List */}
        {!isCollapsed && (
          <div className="px-3 py-3">
            {error ? (
              <div className="flex items-center gap-2 p-2 text-red-500 bg-red-50 dark:bg-red-950/30 rounded text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Failed to load</span>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : databases.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No databases</p>
            ) : (
              <div className="space-y-1">
                {databases.map((db) => (
                  <button
                    key={db.id}
                    onClick={() => onDatabaseSelect(db.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded transition-colors text-sm',
                      selectedDatabaseId === db.id
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{db.name}</span>
                      {db.health_status && (
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            db.health_status === 'healthy' ? 'bg-green-500' :
                            db.health_status === 'unhealthy' ? 'bg-red-500' :
                            'bg-gray-400'
                          )}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs Navigation */}
        {!isCollapsed && selectedDatabaseId && (
          <div className="px-3 py-3 border-t border-border">
            <div className="space-y-1">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded text-xs transition-colors font-medium',
                    activeTab === id
                      ? 'bg-blue-600 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsed Tabs */}
        {isCollapsed && selectedDatabaseId && (
          <div className="px-2 py-2 border-t border-border flex flex-col gap-1">
            {TABS.map(({ id, label }) => {
              const icons: Record<TabType, string> = {
                overview: '◼',
                migrations: '⎇',
                config: '⚙',
                health: '♥',
                security: '🔒',
                audit: '📋',
              };
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    'w-full h-8 rounded flex items-center justify-center transition-colors',
                    activeTab === id
                      ? 'bg-blue-600 text-white text-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  title={label}
                >
                  {icons[id]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Button - Bottom Right */}
      <div className="px-2 py-3 border-t border-border shrink-0">
        <button
          onClick={onSettingsClick}
          className="w-full h-9 rounded hover:bg-accent transition-colors flex items-center justify-center"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
}
