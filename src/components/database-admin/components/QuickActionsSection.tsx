// =============================================================================
// Quick Actions Section
// Common actions for database management (Health Check, Diff, Pull, etc.)
// =============================================================================

import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  GitCompare,
  Download,
  Upload,
} from 'lucide-react';

interface QuickActionsSectionProps {
  databaseId: string;
}

export function QuickActionsSection({
  databaseId,
}: QuickActionsSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-1.5 h-8 text-xs px-2"
          title="Check database connectivity and status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Check</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-1.5 h-8 text-xs px-2"
          title="Compare local schema with database"
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Diff</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-1.5 h-8 text-xs px-2"
          title="Pull latest schema from database"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pull</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-1.5 h-8 text-xs px-2"
          title="Export database structure"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
