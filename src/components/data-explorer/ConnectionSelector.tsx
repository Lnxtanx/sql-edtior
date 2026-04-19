// =============================================================================
// Connection Selector - Dropdown to pick a database connection
// =============================================================================

import { useState } from 'react';
import { ChevronDown, Database, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConnections } from '@/lib/api/connection';
import type { Connection } from '@/lib/api/connection';

interface ConnectionSelectorProps {
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string | null) => void;
}

export function ConnectionSelector({
  selectedConnectionId,
  onConnectionChange,
}: ConnectionSelectorProps) {
  const { data: connections, isLoading } = useConnections();

  const selectedConnection = connections?.find(c => c.id === selectedConnectionId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-left h-8 px-2.5 text-xs font-medium"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Database className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedConnection?.name || 'Connections'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 ml-2 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {isLoading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : connections && connections.length > 0 ? (
          connections.map((connection) => (
            <DropdownMenuItem
              key={connection.id}
              onClick={() => onConnectionChange(connection.id)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{connection.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {connection.database}
                  </span>
                </div>
              </div>
              {selectedConnectionId === connection.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No connections found</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
