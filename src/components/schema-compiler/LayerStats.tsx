import type { CompilationLayer, CompilationResult } from '@/lib/schema-compiler/types';

export function LayerStats({ layer, compilation }: { layer: CompilationLayer; compilation: CompilationResult }) {
    const stats: { label: string; value: string | number }[] = [];

    switch (layer) {
        case 'table':
            stats.push(
                { label: 'Tables', value: compilation.tables.length },
                { label: 'Partitioned', value: compilation.tables.filter(t => t.tableType === 'partitioned').length },
                { label: 'Unlogged', value: compilation.tables.filter(t => t.tableType === 'unlogged').length },
            );
            break;
        case 'column':
            stats.push(
                { label: 'Columns', value: compilation.columns.length },
                { label: 'Business Keys', value: compilation.columns.filter(c => c.isBusinessKeyCandidate).length },
                { label: 'Generated', value: compilation.columns.filter(c => c.isGenerated).length },
            );
            break;
        case 'constraint':
            stats.push(
                { label: 'Primary Keys', value: compilation.constraints.primaryKeys.length },
                { label: 'Foreign Keys', value: compilation.constraints.foreignKeys.length },
                { label: 'Unique', value: compilation.constraints.uniqueConstraints.length },
                { label: 'Check', value: compilation.constraints.checkConstraints.length },
            );
            break;
        case 'index':
            stats.push(
                { label: 'Total', value: compilation.indexes.indexes.length },
                { label: 'Duplicates', value: compilation.indexes.duplicateIndexes.length },
                { label: 'Redundant', value: compilation.indexes.redundantIndexes.length },
                { label: 'Suggested', value: compilation.indexes.missingIndexSuggestions.length },
            );
            break;
        case 'view':
            stats.push(
                { label: 'Views', value: compilation.views.views.length },
                { label: 'Broken Refs', value: compilation.views.brokenReferences.length },
                { label: 'Circular', value: compilation.views.circularViewDeps.length },
            );
            break;
        case 'function':
            stats.push(
                { label: 'Functions', value: compilation.functions.functions.length },
                { label: 'Sec Definer', value: compilation.functions.unsafeSecurityDefiners.length },
                { label: 'Unused', value: compilation.functions.unusedFunctions.length },
            );
            break;
        case 'trigger':
            stats.push(
                { label: 'Triggers', value: compilation.triggers.triggers.length },
                { label: 'Conflicts', value: compilation.triggers.orderingConflicts.length },
                { label: 'Disabled', value: compilation.triggers.disabledTriggers.length },
            );
            break;
        case 'rls':
            stats.push(
                { label: 'Policies', value: compilation.rls.policies.length },
                { label: 'Coverage', value: `${compilation.rls.coverage.coveragePercent}%` },
                { label: 'Sensitive w/o RLS', value: compilation.rls.sensitiveSansRLS.length },
            );
            break;
        case 'sequence':
            stats.push(
                { label: 'Sequences', value: compilation.sequences.sequences.length },
                { label: 'Orphans', value: compilation.sequences.orphanSequences.length },
                { label: 'Shared', value: compilation.sequences.sharedSequences.length },
            );
            break;
        case 'dependency':
            stats.push(
                { label: 'Nodes', value: compilation.dependencies.totalNodes },
                { label: 'Edges', value: compilation.dependencies.totalEdges },
                { label: 'Cycles', value: compilation.dependencies.cycles.length },
            );
            break;
        case 'semantic':
            stats.push(
                { label: 'Symbols', value: compilation.semantic.totalSymbols },
                { label: 'Unresolved', value: compilation.semantic.unresolvedReferences.length },
                { label: 'Type Drift', value: compilation.semantic.typeDrift.length },
                { label: 'Naming Issues', value: compilation.semantic.namingAnomalies.length },
            );
            break;
        default:
            break;
    }

    if (stats.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {stats.map(s => (
                <div key={s.label} className="px-2 py-1 rounded border bg-muted/20 text-center">
                    <div className="text-[9px] text-muted-foreground">{s.label}</div>
                    <div className="text-xs font-semibold">{s.value}</div>
                </div>
            ))}
        </div>
    );
}
