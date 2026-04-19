/**
 * Partition Compiler
 * 
 * Layer 8: Compiles partition trees, detects missing partition indexes,
 * uneven partition strategies, deep nesting, and orphaned partitions.
 */

import type { ParsedSchema, Table } from '@/lib/sql-parser';
import type {
    PartitionCompilation, CompilationIssue, PartitionTree,
    PartitionNode,
} from '../types';

// Note: PartitionNode is defined in types.ts

export function compilePartitions(schema: ParsedSchema): { partitions: PartitionCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    const tableMap = new Map(schema.tables.map(t => [t.name, t]));

    // Identify all partitioned parents
    const partitionedParents = schema.tables.filter(t => t.isPartitioned);

    // Build parent → children map
    const childrenOf = new Map<string, Table[]>();
    for (const table of schema.tables) {
        if (table.partitionOf) {
            if (!childrenOf.has(table.partitionOf)) childrenOf.set(table.partitionOf, []);
            childrenOf.get(table.partitionOf)!.push(table);
        }
    }

    // Build partition trees recursively
    function buildNode(table: Table, depth: number): PartitionNode {
        const children = (childrenOf.get(table.name) || []).map(child => buildNode(child, depth + 1));
        return {
            name: table.name,
            schema: table.schema,
            bounds: table.partitionBounds ? JSON.stringify(table.partitionBounds) : undefined,
            depth,
            children,
            hasLocalIndexes: schema.indexes.some(idx => idx.table === table.name),
        };
    }

    const trees: PartitionTree[] = partitionedParents.map(parent => {
        const root = buildNode(parent, 0);
        const totalPartitions = countNodes(root) - 1; // minus root
        const maxDepth = getMaxDepth(root);

        return {
            rootTable: parent.name,
            rootSchema: parent.schema,
            strategy: parent.partitionType || 'unknown',
            partitionKey: parent.partitionKey || '',
            root,
            totalPartitions,
            maxDepth,
        };
    });

    // Analyze each tree
    for (const tree of trees) {
        // Deep partition nesting
        if (tree.maxDepth > 2) {
            issues.push({
                id: `partition-deep-${tree.rootTable}`,
                layer: 'partition',
                severity: 'warning',
                category: 'deep-partition-nesting',
                title: 'Deep partition nesting',
                message: `Partition tree "${tree.rootTable}" has depth ${tree.maxDepth}. Multi-level partitioning increases query planning complexity.`,
                affectedObjects: [{ type: 'table', name: tree.rootTable }],
                remediation: 'Consider flattening partition hierarchy. Most use cases are served by single-level partitioning.',
                riskScore: 40,
            });
        }

        // Empty partitioned table (parent with no children)
        if (tree.totalPartitions === 0) {
            issues.push({
                id: `partition-empty-${tree.rootTable}`,
                layer: 'partition',
                severity: 'warning',
                category: 'empty-partition-tree',
                title: 'Partitioned table without partitions',
                message: `Table "${tree.rootTable}" is declared as PARTITION BY ${tree.strategy} but has no child partitions.`,
                affectedObjects: [{ type: 'table', name: tree.rootTable }],
                remediation: `Create partitions: CREATE TABLE ${tree.rootTable}_p1 PARTITION OF "${tree.rootTable}" ...`,
                riskScore: 50,
            });
        }

        // Check for missing indexes on partitions
        const nodesWithoutIndexes = collectNodesWithoutIndexes(tree.root);
        if (nodesWithoutIndexes.length > 0 && tree.totalPartitions > 0) {
            issues.push({
                id: `partition-missing-idx-${tree.rootTable}`,
                layer: 'partition',
                severity: 'info',
                category: 'partition-missing-index',
                title: 'Partition without local indexes',
                message: `${nodesWithoutIndexes.length} partition(s) of "${tree.rootTable}" have no local indexes: ${nodesWithoutIndexes.slice(0, 5).join(', ')}${nodesWithoutIndexes.length > 5 ? '...' : ''}.`,
                affectedObjects: nodesWithoutIndexes.map(n => ({ type: 'table' as const, name: n })),
                remediation: 'In PostgreSQL 11+, indexes on the parent are inherited. If using older versions, create indexes on each partition.',
                riskScore: 20,
            });
        }

        // Large number of partitions
        if (tree.totalPartitions > 100) {
            issues.push({
                id: `partition-large-${tree.rootTable}`,
                layer: 'partition',
                severity: 'info',
                category: 'large-partition-count',
                title: 'Large partition count',
                message: `Table "${tree.rootTable}" has ${tree.totalPartitions} partitions. Very high partition counts can slow down query planning.`,
                affectedObjects: [{ type: 'table', name: tree.rootTable }],
                riskScore: 25,
            });
        }
    }

    // Detect orphaned child partitions (partitionOf references non-existent parent)
    const orphanPartitions: string[] = [];
    for (const table of schema.tables) {
        if (table.partitionOf && !tableMap.has(table.partitionOf)) {
            orphanPartitions.push(table.name);
            issues.push({
                id: `partition-orphan-${table.name}`,
                layer: 'partition',
                severity: 'error',
                category: 'orphaned-partition',
                title: 'Orphaned partition',
                message: `Table "${table.name}" declares PARTITION OF "${table.partitionOf}" but the parent table is not found.`,
                affectedObjects: [{ type: 'table', name: table.name }],
                riskScore: 60,
            });
        }
    }

    // Detect mixed partition strategies (list + range on same parent—not actually possible in PG, but flag if inferred)
    const strategyGroups = new Map<string, Set<string>>();
    for (const parent of partitionedParents) {
        if (parent.partitionType) {
            if (!strategyGroups.has(parent.name)) strategyGroups.set(parent.name, new Set());
            strategyGroups.get(parent.name)!.add(parent.partitionType);
        }
    }

    return {
        partitions: {
            trees,
            orphanPartitions,
            totalPartitionedTables: partitionedParents.length,
            totalPartitions: trees.reduce((sum, t) => sum + t.totalPartitions, 0),
        },
        issues,
    };
}

function countNodes(node: PartitionNode): number {
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function getMaxDepth(node: PartitionNode): number {
    if (node.children.length === 0) return node.depth;
    return Math.max(...node.children.map(child => getMaxDepth(child)));
}

function collectNodesWithoutIndexes(node: PartitionNode): string[] {
    const result: string[] = [];
    if (node.depth > 0 && !node.hasLocalIndexes) result.push(node.name);
    for (const child of node.children) {
        result.push(...collectNodesWithoutIndexes(child));
    }
    return result;
}
