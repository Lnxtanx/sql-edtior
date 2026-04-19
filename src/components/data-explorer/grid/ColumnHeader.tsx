// =============================================================================
// Column Header - Professional column header with type badges & FK indicator
// =============================================================================

import { ArrowUp, ArrowDown, ArrowUpDown, Key, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/lib/api/data-explorer';

interface ColumnHeaderProps {
  column: ColumnInfo;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string | null, direction: 'asc' | 'desc') => void;
  onColumnClick?: (column: ColumnInfo) => void;
}

export function ColumnHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
  onColumnClick,
}: ColumnHeaderProps) {
  const isActive = sortColumn === column.name;

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) onSort(column.name, 'asc');
    else if (sortDirection === 'asc') onSort(column.name, 'desc');
    else onSort(null, 'asc');
  };

  const handleHeaderClick = () => {
    if (onColumnClick) onColumnClick(column);
  };

  return (
    <th
      className={cn(
        'text-left px-3 py-1.5 text-[12px] font-medium border-b border-border border-r border-r-border/50',
        'cursor-pointer hover:bg-muted/80 transition-colors group whitespace-nowrap select-none bg-muted',
        isActive && 'bg-primary/5'
      )}
      onClick={handleHeaderClick}
    >
      <div className="flex items-center gap-1.5">
        {/* PK/FK icon */}
        {column.isPrimaryKey && (
          <Key className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />
        )}
        {column.isForeignKey && !column.isPrimaryKey && (
          <Link2 className="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        )}

        {/* Column name */}
        <span className={cn(
          'truncate',
          column.isPrimaryKey && 'text-primary font-semibold',
          column.isForeignKey && !column.isPrimaryKey && 'text-blue-600 dark:text-blue-400'
        )}>
          {column.name}
        </span>

        {/* Type badge */}
        <span className="text-[10px] text-muted-foreground/50 font-normal font-mono">
          {column.type}{column.nullable ? '?' : ''}
        </span>

        {/* FK reference tooltip-style hint */}
        {column.isForeignKey && column.fkReference && (
          <span className="text-[9px] text-blue-500/60 dark:text-blue-400/60 hidden group-hover:inline-block">
            → {column.fkReference.table}
          </span>
        )}

        {/* Sort button */}
        <button
          onClick={handleSortClick}
          className={cn(
            'flex-shrink-0 p-0.5 rounded transition-colors ml-auto',
            isActive ? 'text-primary' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
          )}
          title={isActive ? (sortDirection === 'asc' ? 'Sorted ascending' : 'Sorted descending') : 'Click to sort'}
        >
          {isActive ? (
            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </button>
      </div>
    </th>
  );
}
