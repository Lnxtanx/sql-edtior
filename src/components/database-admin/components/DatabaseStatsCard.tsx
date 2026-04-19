// =============================================================================
// Database Stats Card
// Individual stat card showing key database metrics
// =============================================================================

import { cn } from '@/lib/utils';
import {
  Heart,
  GitBranch,
  Clock,
  Calendar,
  Info,
} from 'lucide-react';

interface DatabaseStatsCardProps {
  label: string;
  value: string | number;
  type: 'health' | 'metric';
  icon: 'heart' | 'git' | 'clock' | 'calendar';
  tooltip?: string;
}

export function DatabaseStatsCard({
  label,
  value,
  type,
  icon,
  tooltip,
}: DatabaseStatsCardProps) {
  const iconMap = {
    heart: Heart,
    git: GitBranch,
    clock: Clock,
    calendar: Calendar,
  };

  const Icon = iconMap[icon];

  const isHealthy =
    type === 'health' && 
    (String(value).toLowerCase() === 'healthy' || String(value).toLowerCase() === 'ok');

  return (
    <div className="bg-background border border-border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
          {label}
        </p>
        {tooltip && (
          <Info className="w-3 h-3 text-muted-foreground cursor-help" aria-label={tooltip} />
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <Icon
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            isHealthy
              ? 'text-green-500'
              : type === 'health'
              ? 'text-amber-500'
              : 'text-blue-500'
          )}
        />
        <span className={cn(
          'text-lg font-bold leading-none',
          isHealthy ? 'text-green-600 dark:text-green-400' : 'text-foreground'
        )}>
          {String(value).length > 10 ? String(value).substring(0, 7) + '...' : value}
        </span>
      </div>
    </div>
  );
}
