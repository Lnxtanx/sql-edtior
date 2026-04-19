// =============================================================================
// Table Grid - Clean data grid with proper grid lines and cell formatting
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Filter, RefreshCw, Check, Eye, EyeOff, ChevronRight, Table2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableRowsSimple } from '@/lib/api/data-explorer';
import { useQueryClient } from '@tanstack/react-query';
import { dataExplorerKeys } from '@/lib/api/data-explorer/hooks';
import { GridPagination } from './GridPagination';
import { ColumnStatsPanel } from './ColumnStatsPanel';
import { ColumnHeader } from './grid/ColumnHeader';
import type { TableInfo, ColumnInfo, FilterCondition } from '@/lib/api/data-explorer/types';

interface TableGridProps {
  connectionId: string;
  tableName: string;
  schemaName: string;
  tableInfo: TableInfo;
}

export function TableGrid({ connectionId, tableName, schemaName, tableInfo }: TableGridProps) {
  const [page, setPage] = useState(0);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<ColumnInfo | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [tempFilter, setTempFilter] = useState<{ column: string; operator: string; value: string }>({ column: '', operator: 'eq', value: '' });
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  // Find portal target on mount
  useEffect(() => {
    const el = document.getElementById('table-actions-portal');
    setPortalTarget(el);
  }, []);

  const limit = 50;

  const { data, isLoading, error, refetch } = useTableRowsSimple(
    connectionId,
    tableName,
    {
      schemaName,
      cursor: cursorHistory[page],
      orderBy: sortColumn || undefined,
      orderDirection: sortDirection,
      filters,
      limit
    }
  );

  const handleNextPage = useCallback(() => {
    if (data?.pagination.nextCursor) {
      const nextPage = page + 1;
      setCursorHistory(prev => {
        const updated = [...prev];
        updated[nextPage] = data.pagination.nextCursor!;
        return updated;
      });
      setPage(nextPage);
    }
  }, [data?.pagination.nextCursor, page]);

  const handlePrevPage = useCallback(() => {
    if (page > 0) {
      setPage(page - 1);
    }
  }, [page]);

  const handleColumnClick = useCallback((column: ColumnInfo) => {
    setSelectedColumn(prev => prev?.name === column.name ? null : column);
  }, []);

  const handleSort = useCallback((column: string | null, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(0);
    setCursorHistory([undefined]);
  }, []);

  const handleFiltersChange = useCallback((newFilters: FilterCondition[]) => {
    setFilters(newFilters);
    setPage(0);
    setCursorHistory([undefined]);
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: dataExplorerKeys.rows(connectionId, tableName),
    });
  }, [queryClient, connectionId, tableName]);

  const handleCopyCell = useCallback(async (value: any, cellKey: string) => {
    const text = value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCell(cellKey);
      setTimeout(() => setCopiedCell(null), 1500);
    } catch {
      // Fallback
    }
  }, []);

  const toggleColumnVisibility = useCallback((columnName: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnName)) next.delete(columnName);
      else next.add(columnName);
      return next;
    });
  }, []);

  const getColumnType = (col: ColumnInfo) => {
    const t = col.type.toLowerCase();
    if (t.includes('varchar') || t.includes('text')) return 'text';
    if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return 'number';
    if (t.includes('bool')) return 'boolean';
    if (t.includes('date') || t.includes('time')) return 'date';
    return 'general';
  };

  const operatorsByType: Record<string, string[]> = {
    text: ['eq', 'neq', 'like'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
    boolean: ['eq', 'neq'],
    date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
    general: ['eq', 'neq', 'in', 'is_null', 'not_null'],
  };

  const getFilteredOperators = () => {
    if (!tempFilter.column) return operatorsByType.general;
    const col = columns.find(c => c.name === tempFilter.column);
    if (!col) return operatorsByType.general;
    return [...operatorsByType[getColumnType(col)], ...operatorsByType.general].filter((op, i, arr) => arr.indexOf(op) === i);
  };

  const handleAddFilter = () => {
    if (!tempFilter.column || !tempFilter.operator) return;
    let value: any = tempFilter.value;
    if (tempFilter.operator === 'in') {
      value = tempFilter.value.split(',').map(v => v.trim()).filter(v => v);
    } else if (tempFilter.operator === 'is_null' || tempFilter.operator === 'not_null') {
      value = undefined;
    } else {
      const col = columns.find(c => c.name === tempFilter.column);
      if (col && getColumnType(col) === 'number' && tempFilter.value) {
        const n = Number(tempFilter.value);
        if (!isNaN(n)) value = n;
      }
    }
    handleFiltersChange([...filters, { column: tempFilter.column, operator: tempFilter.operator, value }]);
    setTempFilter({ column: '', operator: 'eq', value: '' });
    setFilterPopoverOpen(false);
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="flex border-b border-border bg-muted px-3 py-2 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24 rounded" />
          ))}
        </div>
        {/* Row skeletons */}
        <div className="flex-1 p-0">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex px-3 py-2 gap-4 border-b border-border/40">
              <Skeleton className="h-4 w-8 rounded" />
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-24 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load data</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rows = data?.rows || [];
  const columns = data?.columns || [];
  const pagination = data?.pagination;
  const visibleColumns = columns.filter(c => !hiddenColumns.has(c.name));
  const rowOffset = page * limit;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Action bar portaled into header */}
      {portalTarget && createPortal(
        <>
          <div className="w-px h-4 bg-border mx-1" />
          {/* Filter */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={filters.length > 0 ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-6 px-2 text-[11px] gap-1', filters.length > 0 && 'bg-primary text-primary-foreground')}
              >
                <Filter className="w-3 h-3" />
                Filter
                {filters.length > 0 && (
                  <span className="bg-primary-foreground/20 text-primary-foreground px-1 rounded-full text-[10px] min-w-[14px] text-center">
                    {filters.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-2.5">
                <h4 className="text-xs font-medium">Add Filter</h4>
                <Select value={tempFilter.column} onValueChange={(v) => setTempFilter({ ...tempFilter, column: v, value: '' })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(c => (
                      <SelectItem key={c.name} value={c.name} className="text-xs">{c.name} <span className="text-muted-foreground">({c.type})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tempFilter.operator} onValueChange={(v) => setTempFilter({ ...tempFilter, operator: v })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredOperators().map(op => (
                      <SelectItem key={op} value={op} className="text-xs">
                        {op === 'eq' ? '=' : op === 'neq' ? '\u2260' : op === 'gt' ? '>' : op === 'gte' ? '\u2265' : op === 'lt' ? '<' : op === 'lte' ? '\u2264' : op === 'like' ? '~ Contains' : op === 'is_null' ? 'IS NULL' : op === 'not_null' ? 'NOT NULL' : op === 'in' ? 'IN (list)' : op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tempFilter.operator !== 'is_null' && tempFilter.operator !== 'not_null' && (
                  <Input
                    ref={filterInputRef}
                    value={tempFilter.value}
                    onChange={(e) => setTempFilter({ ...tempFilter, value: e.target.value })}
                    placeholder={tempFilter.operator === 'in' ? 'Values (comma separated)' : 'Value...'}
                    className="h-7 text-xs"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFilter(); }}
                  />
                )}
                <Button onClick={handleAddFilter} disabled={!tempFilter.column || !tempFilter.operator} size="sm" className="w-full h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Filter
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Column visibility */}
          {columns.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1">
                  <Eye className="w-3 h-3" />
                  Columns
                  {hiddenColumns.size > 0 && (
                    <span className="text-[10px] text-muted-foreground">({columns.length - hiddenColumns.size}/{columns.length})</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Toggle columns</div>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {columns.map(col => (
                    <button
                      key={col.name}
                      onClick={() => toggleColumnVisibility(col.name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors text-left',
                        hiddenColumns.has(col.name) && 'opacity-50'
                      )}
                    >
                      {hiddenColumns.has(col.name) ? (
                        <EyeOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Eye className="w-3 h-3 text-foreground flex-shrink-0" />
                      )}
                      <span className={cn('truncate', col.isPrimaryKey && 'text-primary font-medium')}>{col.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{col.type}</span>
                    </button>
                  ))}
                </div>
                {hiddenColumns.size > 0 && (
                  <button
                    onClick={() => { for (const name of hiddenColumns) toggleColumnVisibility(name); }}
                    className="w-full text-xs text-primary mt-2 px-2 py-1 hover:bg-muted rounded text-center"
                  >
                    Show all columns
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            title="Refresh data"
          >
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          </Button>

          {/* Inline filter chips */}
          {filters.length > 0 && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <div className="flex items-center gap-1 overflow-x-auto">
                {filters.map((filter, index) => (
                  <span key={index} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                    <span className="font-medium">{filter.column}</span>
                    <span className="opacity-60">{filter.operator === 'eq' ? '=' : filter.operator}</span>
                    {filter.value !== undefined && filter.value !== null && <span>{String(filter.value)}</span>}
                    <button onClick={() => { const f = [...filters]; f.splice(index, 1); handleFiltersChange(f); }} className="hover:text-foreground">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <button onClick={() => handleFiltersChange([])} className="text-muted-foreground hover:text-foreground text-[10px]">Clear</button>
              </div>
            </>
          )}

          {/* Row count */}
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            ~{formatCount(pagination?.estimatedTotal || tableInfo.estimatedRows)} rows
          </span>
        </>,
        portalTarget
      )}

      {/* Data grid */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            {filters.length > 0 ? (
              <div className="text-center space-y-2">
                <Filter className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No rows match your filters</p>
                <Button variant="link" className="text-xs h-auto p-0" onClick={() => setFilters([])}>Clear filters</Button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <Table2 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">This table is empty</p>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted border-b border-border">
                <th className="w-10 min-w-[40px] px-2 py-1.5 text-[11px] text-muted-foreground font-normal border-r border-border text-center bg-muted">#</th>
                {visibleColumns.map((column) => (
                  <ColumnHeader
                    key={column.name}
                    column={column}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onColumnClick={handleColumnClick}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const rowNum = rowOffset + rowIndex + 1;
                return (
                  <tr key={rowIndex} className={cn(
                    'group transition-colors',
                    rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                    'hover:bg-accent/50'
                  )}>
                    <td className="w-10 min-w-[40px] px-2 py-[6px] text-[11px] text-muted-foreground/50 border-r border-border border-b border-b-border/40 text-center tabular-nums select-none">
                      {rowNum}
                    </td>
                    {visibleColumns.map((column) => {
                      const cellKey = `${rowIndex}-${column.name}`;
                      const value = row[column.name];
                      const isCopied = copiedCell === cellKey;
                      return (
                        <td
                          key={column.name}
                          className="px-3 py-[6px] border-r border-border/40 border-b border-b-border/40 last:border-r-0 relative cursor-default"
                          onClick={() => handleCopyCell(value, cellKey)}
                          title="Click to copy"
                        >
                          {value === null ? (
                            <span className="text-muted-foreground/30 italic text-[12px]">NULL</span>
                          ) : typeof value === 'boolean' ? (
                            <span className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium',
                              value ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            )}>
                              {String(value)}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[350px]">
                                {formatCellValue(value)}
                              </span>
                              {column.isForeignKey && column.fkReference && (
                                <ChevronRight className="w-3 h-3 text-blue-400/60 flex-shrink-0" />
                              )}
                            </div>
                          )}
                          {isCopied && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded shadow-sm">
                              <Check className="w-2.5 h-2.5" />
                              Copied
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <GridPagination
          hasMore={pagination.hasMore}
          hasPrev={page > 0}
          onNext={handleNextPage}
          onPrev={handlePrevPage}
          isLoading={isLoading}
          rowCount={rows.length}
          estimatedTotal={pagination.estimatedTotal || tableInfo.estimatedRows}
          page={page}
          pageSize={limit}
        />
      )}

      {/* Column Stats Panel */}
      {selectedColumn && (
        <ColumnStatsPanel
          connectionId={connectionId}
          tableName={tableName}
          schemaName={schemaName}
          columnName={selectedColumn.name}
          onClose={() => setSelectedColumn(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatCellValue(value: any): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

function formatCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}
