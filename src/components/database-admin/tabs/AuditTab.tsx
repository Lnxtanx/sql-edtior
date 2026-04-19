// =============================================================================
// Audit Tab
// Professional audit log and change history viewer
// =============================================================================

import { useMemo, useState } from 'react';
import { Edit3, LogIn, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuditTabProps {
  databaseId: string;
}

const AUDIT_EVENTS = [
  { id: 1, timestamp: '2024-03-08 14:30:22', user: 'admin@example.com', action: 'Configuration Updated', details: 'SSL settings modified' },
  { id: 2, timestamp: '2024-03-08 13:15:45', user: 'dev@example.com', action: 'Migration Applied', details: 'Applied migration: 010_migration_system.sql' },
  { id: 3, timestamp: '2024-03-08 12:00:00', user: 'admin@example.com', action: 'Health Check', details: 'Manual health check performed' },
  { id: 4, timestamp: '2024-03-08 11:22:15', user: 'viewer@example.com', action: 'Access', details: 'Database accessed for read operations' },
  { id: 5, timestamp: '2024-03-08 10:45:30', user: 'admin@example.com', action: 'User Added', details: 'New user added to database' },
];

const ACTION_ICONS: Record<string, any> = {
  'Configuration Updated': <Edit3 className="w-4 h-4 text-blue-500" />,
  'Migration Applied': <Edit3 className="w-4 h-4 text-green-500" />,
  'Health Check': <LogIn className="w-4 h-4 text-yellow-500" />,
  'Access': <LogIn className="w-4 h-4 text-gray-500" />,
  'User Added': <LogIn className="w-4 h-4 text-green-500" />,
};

export function AuditTab({ databaseId }: AuditTabProps) {
  const [filterUser, setFilterUser] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    if (!filterUser) return AUDIT_EVENTS;
    return AUDIT_EVENTS.filter(e => e.user === filterUser);
  }, [filterUser]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Audit Log</h3>
            <p className="text-sm text-muted-foreground mt-1">View all database changes and user activities</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export Log
          </Button>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {filteredEvents.map((event, index) => (
            <div
              key={event.id}
              className="border border-border rounded-lg p-4 hover:border-accent transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  {index < filteredEvents.length - 1 && (
                    <div className="w-px h-12 bg-border" />
                  )}
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                      {ACTION_ICONS[event.action] || <Edit3 className="w-4 h-4 text-gray-500" />}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{event.action}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{event.details}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {event.user} • {event.timestamp}
                    </span>
                    <Button variant="ghost" size="sm">View Details</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No audit events found</p>
          </div>
        )}
      </div>
    </div>
  );
}
