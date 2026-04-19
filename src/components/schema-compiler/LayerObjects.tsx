import { Badge } from '@/components/ui/badge';
import type { CompilationLayer, CompilationResult } from '@/lib/schema-compiler/types';

export function LayerObjects({ layer, compilation }: { layer: CompilationLayer; compilation: CompilationResult }) {
    let items: { name: string; badge?: string; desc?: string }[] = [];

    switch (layer) {
        case 'database':
            if (compilation.database) {
                items = [
                    { name: compilation.database.name || compilation.schemaName || 'Database', badge: 'db', desc: compilation.database.serverVersion || 'version unknown' },
                    ...(compilation.database.searchPath ? compilation.database.searchPath.map(p => ({ name: String(p), badge: 'search_path' })) : []),
                    ...(compilation.database.extensions ? compilation.database.extensions.map(e => ({ name: String(e.name), badge: 'ext', desc: String(e.version) })) : [])
                ];
            }
            break;
        case 'schema':
            items = compilation.schemas.map(s => ({ name: String(s.name), badge: `${s.objectCounts.tables} tables` }));
            break;
        case 'table':
            items = compilation.tables.map(t => ({ name: `${t.schema}.${t.name}`, badge: t.tableType, desc: `${t.columnCount} cols` }));
            break;
        case 'column':
            items = compilation.columns.map(c => ({ name: `${c.tableName}.${c.name}`, badge: c.resolvedType, desc: c.nullable ? 'null' : 'not null' }));
            break;
        case 'type':
            items = [
                ...compilation.types.enums.map(e => ({ name: e.name, badge: 'enum', desc: `${e.values.length} vals` })),
                ...compilation.types.domains.map(d => ({ name: d.name, badge: 'domain', desc: `base: ${d.baseType}` })),
                ...compilation.types.compositeTypes.map(c => ({ name: c.name, badge: 'composite', desc: `${c.attributes.length} attrs` })),
            ];
            break;
        case 'constraint':
            items = [
                ...compilation.constraints.primaryKeys.map(pk => ({ name: pk.name || `${pk.table}_pkey`, badge: 'PK', desc: pk.table })),
                ...compilation.constraints.foreignKeys.map(fk => ({ name: fk.name || `${fk.sourceTable}_fk`, badge: 'FK', desc: `${fk.sourceTable} -> ${fk.targetTable}` })),
                ...compilation.constraints.uniqueConstraints.map(uq => ({ name: uq.name || `${uq.table}_key`, badge: 'UNIQUE', desc: uq.table })),
                ...compilation.constraints.checkConstraints.map(ck => ({ name: ck.name || `${ck.table}_check`, badge: 'CHECK', desc: ck.table })),
            ];
            break;
        case 'index':
            items = compilation.indexes.indexes.map(idx => ({ name: String(idx.name), badge: String(idx.type), desc: String(idx.table) }));
            break;
        case 'view':
            items = [
                ...compilation.views.views.map(v => ({ name: String(v.name), badge: 'view' })),
                ...compilation.views.materializedViews.map(mv => ({ name: String(mv.name), badge: 'matview' })),
            ];
            break;
        case 'function':
            items = [
                ...compilation.functions.functions.map(f => ({ name: String(f.name), badge: 'func', desc: String(f.language) })),
                ...compilation.functions.procedures.map(p => ({ name: String(p.name), badge: 'proc', desc: String(p.language) })),
            ];
            break;
        case 'trigger':
            items = compilation.triggers.triggers.map(t => ({ name: String(t.name), badge: String(t.timing), desc: String(t.table) }));
            break;
        case 'rls':
            items = compilation.rls.policies.map(p => ({ name: String(p.name), badge: String(p.command), desc: String(p.table) }));
            break;
        case 'privilege':
            items = compilation.privileges.grants.map(g => ({ name: `${g.grantee} ON ${g.objectName}`, badge: String(g.privilege), desc: String(g.objectType) }));
            break;
        case 'sequence':
            items = compilation.sequences.sequences.map(s => ({ name: String(s.name), badge: 'seq' }));
            break;
        case 'extension':
            items = compilation.extensions.map(e => ({ name: e.name, badge: e.version || 'unknown' }));
            break;
        case 'partition':
            items = [
                ...compilation.partitions.trees.map(p => ({ name: String(p.rootTable), badge: String(p.strategy), desc: `${p.totalPartitions} parts (key: ${Array.isArray(p.partitionKey) ? p.partitionKey.join(', ') : p.partitionKey})` })),
                ...compilation.partitions.orphanPartitions.map(o => ({ name: String(o), badge: 'orphan' }))
            ];
            break;
        case 'dependency':
            items = compilation.dependencies.nodes.map(n => ({ name: n.name, badge: n.type, desc: `in:${n.inDegree} out:${n.outDegree}` }));
            break;
        case 'storage':
            items = [
                ...compilation.storage.tableSizes.map(t => ({ name: t.table, badge: t.tableSize || 'size', desc: t.estimatedRowCount ? `${t.estimatedRowCount} rows` : '' })),
                ...compilation.storage.indexSizes.map(i => ({ name: i.name || 'index', badge: i.size || 'size', desc: i.table }))
            ];
            break;
        case 'replication':
            items = [
                ...compilation.replication.publicationTables.map(t => ({ name: t, badge: 'pub' })),
                ...compilation.replication.subscriptions.map(s => ({ name: s, badge: 'sub' })),
                ...compilation.replication.logicalSlots.map(s => ({ name: s, badge: 'slot' }))
            ];
            break;
        case 'semantic':
            items = compilation.semantic.symbolTable.map(s => ({ name: String(s.name), badge: String(s.type), desc: String(s.schema || s.definedIn || 'global') }));
            break;
        default:
            return null;
    }

    if (items.length === 0) return null;

    return (
        <div className="space-y-1.5 mt-2">
            <div className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                <span>Compiled Objects ({items.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
                {items.slice(0, 50).map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-1.5 py-1 rounded border bg-muted/10 text-[10px]">
                        <span className="font-mono text-[9px] truncate mr-2 text-foreground/90 whitespace-nowrap overflow-hidden" title={item.name}>
                            {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {item.desc && <span className="text-[8px] text-muted-foreground truncate max-w-[80px] text-right" title={item.desc}>{item.desc}</span>}
                            {item.badge && <Badge variant="outline" className="text-[7.5px] uppercase h-3.5 px-1 font-normal bg-muted/30 border-muted-foreground/20 text-muted-foreground">{item.badge}</Badge>}
                        </div>
                    </div>
                ))}
                {items.length > 50 && (
                    <div className="text-[9px] text-muted-foreground text-center py-1 bg-muted/20 rounded border border-dashed">
                        + {items.length - 50} more objects omitted for performance
                    </div>
                )}
            </div>
        </div>
    );
}
