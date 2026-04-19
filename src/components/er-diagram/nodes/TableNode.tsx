import { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Key, Link, Sparkles, Edit3, Network, Zap, ShieldCheck, ListTree, Check, TableProperties, ChevronDown, ChevronRight } from 'lucide-react';
import { Column, Trigger, Policy, Index } from '@/lib/sql-parser';
import { CascadeRisk } from '@/lib/schema-workspace';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TableIndexes } from './table-sections/TableIndexes';
import { TableTriggers } from './table-sections/TableTriggers';
import { TablePolicies } from './table-sections/TablePolicies';
import { TableCheckConstraints } from './table-sections/TableCheckConstraints';
import { useSchemaColor } from '../layout/elk/schemaColors';
interface TableNodeData {
  label: string;
  columns: Column[];
  isHighlighted?: boolean;
  schema?: string;
  onSubgraph?: (tableName: string) => void;
  rlsEnabled?: boolean;
  risk?: CascadeRisk;
  triggers?: Trigger[];
  policies?: Policy[];
  indexes?: Index[];
  enumNames?: Set<string>;
  checkConstraints?: Array<{ name?: string; check: string }>;
  viewMode?: 'ALL' | 'KEYS' | 'TITLE';
}

const ColumnRow = memo(({ column, index, indexes, enumNames, theme }: { column: Column; index: number; indexes?: Index[]; enumNames?: Set<string>; theme: any }) => {
  const typeDisplay = column.type.length > 20
    ? column.type.substring(0, 18) + '...'
    : column.type;

  // Check if this column is covered by any index
  const coveringIndexes = indexes?.filter(idx => idx.columns.includes(column.name)) || [];
  const isIndexed = coveringIndexes.length > 0;
  const isEnum = enumNames?.has(column.type) ?? false;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs border-t border-border/40 hover:bg-muted/50 transition-colors cursor-default",
          )}
          style={{
            backgroundColor: column.isPrimaryKey || column.isForeignKey ? theme.accent : undefined
          }}
        >
          <div className="flex items-center gap-1 min-w-[20px]">
            {column.isPrimaryKey && (
              <Key className="w-3 h-3" style={{ color: theme.foreground }} />
            )}
            {column.isForeignKey && (
              <Link className="w-3 h-3" style={{ color: theme.foreground }} />
            )}
            {column.isUnique && !column.isPrimaryKey && (
              <Sparkles className="w-3 h-3 text-emerald-500" />
            )}
            {isIndexed && !column.isPrimaryKey && !column.isUnique && (
              <span title={coveringIndexes.map(idx => `${idx.name} (${idx.type}${idx.isUnique ? ', unique' : ''}${idx.columns.length > 1 ? `, ${idx.columns.length} cols` : ''})`).join('\n')} className="relative flex items-center justify-center">
                <ListTree className="w-3 h-3 text-amber-500 cursor-help" />
                {coveringIndexes.some(idx => idx.isUnique) && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold text-amber-700 bg-amber-100 rounded-sm px-[2px] leading-none">U</span>
                )}
              </span>
            )}
            {column.isGenerated && (
              <span title="Generated column">
                <Zap className="w-3 h-3 text-indigo-500 fill-indigo-500 cursor-help" />
              </span>
            )}
          </div>
          <span 
            className={cn("font-semibold flex-1 truncate")}
            style={{ color: column.isPrimaryKey || column.isForeignKey ? theme.foreground : undefined }}
          >
            {column.name}
          </span>
          <span className="text-muted-foreground font-mono text-[10px] truncate max-w-[100px]">
            {typeDisplay}
          </span>
          {isEnum && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-0.5 flex-shrink-0">
              ENUM
            </span>
          )}
          {column.isGenerated && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/70 bg-muted/50 rounded px-1 py-0.5 flex-shrink-0">
              GENERATED
            </span>
          )}
          {!column.nullable && (
            <span className="text-destructive text-[10px] font-bold">*</span>
          )}

          {/* Handles for connections */}
          <Handle
            type="source"
            position={Position.Right}
            id={`${column.name}-source`}
            className={cn("!w-2 !h-2", column.isForeignKey ? "!bg-indigo-500 !border-indigo-600" : "!bg-transparent !border-transparent !opacity-0")}
            style={{ top: 'auto', right: -4 }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id={`${column.name}-target`}
            className="!w-2 !h-2 !bg-primary/50 !border-primary/80"
            style={{ top: 'auto', left: -4, backgroundColor: column.isPrimaryKey ? theme.foreground : 'transparent', borderColor: column.isPrimaryKey ? theme.foreground : 'transparent', opacity: column.isPrimaryKey ? 1 : 0 }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p><strong>Column:</strong> {column.name}</p>
          <p><strong>Type:</strong> {column.type}</p>
          <p><strong>Nullable:</strong> {column.nullable ? 'Yes' : 'No'}</p>
          {column.defaultValue && (
            <p><strong>Default:</strong> {column.defaultValue}</p>
          )}
          {column.isPrimaryKey && <p className="font-bold border-l-2 pl-2" style={{ color: theme.foreground, borderColor: theme.foreground }}>Primary Key</p>}
          {column.isForeignKey && column.references && (
            <p className="font-bold border-l-2 pl-2" style={{ color: theme.foreground, borderColor: theme.foreground }}>
              FK → {column.references.table}.{column.references.column}
              {column.references.onDelete && ` (ON DELETE ${column.references.onDelete})`}
            </p>
          )}
          {column.isUnique && !column.isPrimaryKey && (
            <p className="text-emerald-600 font-medium">Unique Constraint</p>
          )}
          {isEnum && (
            <p className="text-violet-600 font-medium">Enum type</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

ColumnRow.displayName = 'ColumnRow';

// Bug 1.2 fix: destructure `id` from NodeProps — React Flow node IDs are schema-qualified
// (e.g., "public.orders"), while `label` is just the table name ("orders").
// updateNodeInternals must receive the node ID or it silently no-ops.
const TableNode = ({ id, data, selected }: NodeProps<any>) => {
  const { label, columns, isHighlighted, schema, onSubgraph, rlsEnabled, viewMode = 'ALL' } = data as TableNodeData;

  const [expandedSection, setExpandedSection] = useState<'indexes' | 'triggers' | 'policies' | null>(null);
  // Phase 5.5: Column folding for tables with many columns
  const COLUMN_FOLD_THRESHOLD = 15;
  const [showAllColumns, setShowAllColumns] = useState(false);

  // NOTE: Zoom-adaptive viewMode override intentionally removed.
  // Hiding columns when zoomed out was confusing — the table always shows
  // what the user has selected (ALL / KEYS / TITLE) regardless of zoom level.
  // The effectiveViewMode is simply the viewMode prop.
  const effectiveViewMode = viewMode;

  const schemaColor = useSchemaColor(schema);
  const headerGradient = schemaColor.header;
  const borderColor = schemaColor.border;
  const updateNodeInternals = useUpdateNodeInternals();

  const toggleSection = useCallback((section: 'indexes' | 'triggers' | 'policies') => {
    setExpandedSection(prev => prev === section ? null : section);
    // Let React update the DOM, then tell React Flow to recalculate handle positions.
    // Must use `id` (e.g. "public.orders"), not `label` (e.g. "orders").
    setTimeout(() => {
      updateNodeInternals(id);
    }, 0);
  }, [updateNodeInternals, id]);

  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl shadow-md min-w-[200px] max-w-[300px] overflow-hidden transition-all duration-300 font-sans group hover:shadow-xl hover:ring-2 hover:ring-primary/20 hover:-translate-y-0.5",
        selected && "ring-4 ring-primary/40 shadow-2xl -translate-y-1 transform-gpu",
        isHighlighted && "ring-2 ring-primary/30",
      )}
      style={selected || isHighlighted ? { borderColor } : undefined}
    >
      {/* Table Header */}
      <div className="px-3 py-2.5 relative" style={{ background: headerGradient }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <TableProperties className="w-4 h-4 text-white/90 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-white truncate">{label}</h3>
              <p className="flex items-center text-[10px] text-white/80">
                {schema && <span className="mr-1">{schema}.</span>}
                {columns.length} column{columns.length !== 1 ? 's' : ''}
                {rlsEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ShieldCheck className="w-3.5 h-3.5 ml-1.5 text-emerald-300 fill-emerald-900/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium text-xs">Row Level Security Enabled</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {data.risk && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(
                        "ml-2 inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold cursor-help",
                        data.risk.level === 'HIGH' ? "bg-red-500 text-white" : "bg-amber-400 text-black"
                      )}>
                        ⚠
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{data.risk.level === 'HIGH' ? 'High Impact' : 'Warning'}</p>
                      <p className="text-xs">Main Reference Table (High connectivity)</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    if ((data as any).onTableAI) {
                      (data as any).onTableAI(id);
                    }
                  }}
                >
                  <img src="/resona.png" alt="Resona" className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Resona AI</TooltipContent>
            </Tooltip>

            {/* Edit Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center cursor-pointer transition-colors"
                  onClick={(e) => { e.stopPropagation(); /* onEdit or dblclick handled by canvas */ }}
                >
                  <Edit3 className="w-3 h-3 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Double-click to edit</p>
              </TooltipContent>
            </Tooltip>

            {/* Subgraph Button (Only show if handler provided) */}
            {onSubgraph && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center cursor-pointer transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSubgraph(label); }}
                  >
                    <Network className="w-3 h-3 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">View Graph Network</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Columns */}
      {effectiveViewMode !== 'TITLE' && (
        <div className="overflow-visible">
          {(() => {
            const visibleCols = columns.filter(c =>
              effectiveViewMode === 'ALL' || c.isPrimaryKey || c.isForeignKey
            );
            // Phase 5.5: Fold if more than threshold in full-detail mode
            const shouldFold = effectiveViewMode === 'ALL' && visibleCols.length > COLUMN_FOLD_THRESHOLD && !showAllColumns;
            const displayCols = shouldFold ? visibleCols.slice(0, COLUMN_FOLD_THRESHOLD) : visibleCols;
            const hiddenCount = visibleCols.length - COLUMN_FOLD_THRESHOLD;
            return (
              <>
                {displayCols.map((column, index) => (
                  <ColumnRow
                    key={column.name}
                    column={column}
                    index={index}
                    indexes={(data as TableNodeData).indexes}
                    enumNames={(data as TableNodeData).enumNames}
                    theme={schemaColor}
                  />
                ))}
                {shouldFold && (
                  <button
                    onClick={() => setShowAllColumns(true)}
                    className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 border-t border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    +{hiddenCount} more column{hiddenCount !== 1 ? 's' : ''}…
                  </button>
                )}
                {showAllColumns && visibleCols.length > COLUMN_FOLD_THRESHOLD && (
                  <button
                    onClick={() => setShowAllColumns(false)}
                    className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 border-t border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    Show less
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Footer Indicators */}
      {effectiveViewMode !== 'TITLE' && (
        <div className="flex flex-col bg-muted/10 border-t border-border/50">
          <TableIndexes
            indexes={(data as TableNodeData).indexes || []}
            expanded={expandedSection === 'indexes'}
            onToggle={() => toggleSection('indexes')}
            theme={schemaColor}
          />
          <TableTriggers
            triggers={(data as TableNodeData).triggers || []}
            expanded={expandedSection === 'triggers'}
            onToggle={() => toggleSection('triggers')}
            theme={schemaColor}
          />
          <TablePolicies
            policies={(data as TableNodeData).policies || []}
            expanded={expandedSection === 'policies'}
            onToggle={() => toggleSection('policies')}
            theme={schemaColor}
          />
          <TableCheckConstraints constraints={(data as TableNodeData).checkConstraints || []} />
        </div>
      )}

      {/* Default handles for general connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="default-target"
        className="!w-3 !h-3 !bg-muted !border-muted-foreground !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="default-source"
        className="!w-3 !h-3 !bg-muted !border-muted-foreground !opacity-0"
      />
    </div>
  );
};

export default memo(TableNode);
