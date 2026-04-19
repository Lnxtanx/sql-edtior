// =============================================================================
// Database Admin Header
// Top header with title and basic controls
// =============================================================================

import { Database, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DatabaseAdminHeader() {
  return (
    <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-card w-full shrink-0">
      {/* Left: Title */}
      <div className="flex items-center gap-2.5">
        <Database className="w-4 h-4 text-blue-500" />
        <h1 className="text-sm font-medium">Database Administration</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1.5 hover:bg-accent"
          title="Add a new database connection"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
