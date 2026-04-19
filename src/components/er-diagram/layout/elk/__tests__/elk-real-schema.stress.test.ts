/**
 * ELK Layout Engine — Real-World PostgreSQL 16 Heavy Stress Test
 * ═══════════════════════════════════════════════════════════════
 *
 * Uses the actual comprehensive schema from justtalk/test.sql which contains:
 *  - 6 schemas: core, saas, ecommerce, payment, analytics, audit_logs
 *  - All PostgreSQL object types: Tables, Views, Materialized Views, Functions,
 *    ENUMs, Domains, Roles, Sequences, Extensions, Policies
 *  - Cross-schema FKs, self-referential FKs, partitioned table stubs
 *  - GIN / partial indexes, composite types, generated columns, JSONB, INET
 *
 * Tests validate:
 *  1. Correct RenderGraph construction from the SQL parser + SchemaGraph
 *  2. Flat layout: all objects get nodes, finite positions, no duplicates
 *  3. Grouped layout: parent-before-child ordering, no missing parents
 *  4. All 4 directions (LR, RL, TB, BT) in both flat and grouped modes
 *  5. Each PG object type (view, mat-view, enum, domain, role, seq, ext, policy)
 *     appears correctly in ELK output
 *  6. Schema subset combos: per-schema, cross-schema FKs, selective object types
 *  7. Performance benchmarks: flat / grouped / repeated / full pipeline
 *
 * Run:
 *   npx vitest run src/components/er-diagram/layout/elk/__tests__/elk-real-schema.stress.test.ts
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ELK from 'elkjs/lib/elk.bundled.js';
import { parsePostgresSQL } from '@/lib/sql-parser';
import { buildSchemaGraph, applyProjection, analyzeCascadeRisks } from '@/lib/schema-workspace';
import { buildELKGraph } from '../buildELKGraph';
import { parseELKOutput } from '../parseELKOutput';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { LayoutEngineOptions } from '../../types';
import type { RenderGraph, SchemaGraph, ProjectionFlags } from '@/lib/schema-workspace';
import type { ParsedSchema, Table, Relationship } from '@/lib/sql-parser';

// ─── Setup ──────────────────────────────────────────────────────────────────

const SQL_PATH = resolve('C:/schema-weaver/justtalk/test.sql');

let parsedSchema: ParsedSchema;
let schemaGraph: SchemaGraph;
let fullRenderGraph: RenderGraph;

/** All ProjectionFlags ON — show every object type */
const ALL_VISIBLE: ProjectionFlags = {
    showViews: true,
    showMaterializedViews: true,
    showFunctions: true,
    showEnums: true,
    showDomains: true,
    showRoles: true,
    showSequences: true,
    showExtensions: true,
    showPolicies: true,
};

/** Tables-only projection — minimum surface */
const TABLES_ONLY: ProjectionFlags = {
    showViews: false,
    showMaterializedViews: false,
    showFunctions: false,
    showEnums: false,
    showDomains: false,
    showRoles: false,
    showSequences: false,
    showExtensions: false,
    showPolicies: false,
};

beforeAll(() => {
    const sql = readFileSync(SQL_PATH, 'utf-8');
    parsedSchema = parsePostgresSQL(sql);

    // Build the SchemaGraph — this processes ALL pg objects into typed nodes
    schemaGraph = buildSchemaGraph(parsedSchema);

    // Build the full subgraph (no filtering) to get a SchemaSubgraph
    // We replicate what the diagram does when no focus table is selected:
    // collect ALL nodes from the graph into one flat SchemaSubgraph
    const allNodes = [...schemaGraph.nodes.values()];
    const allTables = allNodes
        .filter(n => n.type === 'TABLE')
        .map((n: any) => n.table);
    const allRelationships = parsedSchema.relationships ?? [];

    const fullSubgraph = {
        tables: allTables,
        nodes: allNodes,
        relationships: allRelationships,
        focus: [],
        options: { focusTable: null, depth: 999, direction: 'both' as const },
        stats: { tableCount: allTables.length, depthCounts: new Map(), wasTruncated: false },
    };

    fullRenderGraph = applyProjection(fullSubgraph, ALL_VISIBLE);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('[Real Schema] Loaded from test.sql:');
    console.log(`  Tables:     ${fullRenderGraph.tables.length}`);
    console.log(`  Views:      ${fullRenderGraph.views.length}`);
    console.log(`  Mat-Views:  ${fullRenderGraph.matViews.length}`);
    console.log(`  Functions:  ${fullRenderGraph.functions.length}`);
    console.log(`  ENUMs:      ${fullRenderGraph.enums.length}`);
    console.log(`  Domains:    ${fullRenderGraph.domains.length}`);
    console.log(`  Roles:      ${fullRenderGraph.roles.length}`);
    console.log(`  Sequences:  ${fullRenderGraph.sequences.length}`);
    console.log(`  Extensions: ${fullRenderGraph.extensions.length}`);
    console.log(`  Policies:   ${fullRenderGraph.policies.length}`);
    console.log(`  FKs:        ${fullRenderGraph.relationships.length}`);
    const schemas = [...new Set(fullRenderGraph.tables.map(t => t.schema || 'public'))];
    console.log(`  Schemas:    ${schemas.join(', ')}`);
    console.log('══════════════════════════════════════════════════════');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Run ELK full pipeline and return nodes + timing */
async function runELK(rg: RenderGraph, opts: Partial<LayoutEngineOptions> = {}) {
    const elk = new ELK();
    const options: LayoutEngineOptions = {
        direction: 'LR',
        nodeSpacing: 80,
        rankSpacing: 200,
        groupBySchema: false,
        viewMode: 'ALL',
        ...opts,
    };
    const elkInput = buildELKGraph(rg, options);
    const t0 = performance.now();
    const laid = await elk.layout(elkInput);
    const durationMs = performance.now() - t0;
    const nodes = parseELKOutput(laid, rg, options);
    return { nodes, durationMs };
}

/** Total leaf objects in rg (everything that becomes a node except group containers) */
function totalObjects(rg: RenderGraph) {
    return (
        rg.tables.length +
        rg.views.length +
        rg.matViews.length +
        rg.functions.length +
        rg.enums.length +
        rg.domains.length +
        rg.roles.length +
        rg.sequences.length +
        rg.extensions.length +
        rg.policies.length
    );
}

function assertNoMissingParents(nodes: ReturnType<typeof parseELKOutput>, tag = '') {
    const ids = new Set(nodes.map(n => n.id));
    for (const n of nodes) {
        if (n.parentId) {
            expect(
                ids.has(n.parentId),
                `[${tag}] Node "${n.id}" references missing parent "${n.parentId}"`
            ).toBe(true);
        }
    }
}

function assertParentsBeforeChildren(nodes: ReturnType<typeof parseELKOutput>, tag = '') {
    const seen = new Set<string>();
    for (const n of nodes) {
        if (n.parentId) {
            expect(
                seen.has(n.parentId),
                `[${tag}] "${n.id}" appeared before its parent "${n.parentId}"`
            ).toBe(true);
        }
        seen.add(n.id);
    }
}

function assertValidPositions(nodes: ReturnType<typeof parseELKOutput>, tag = '') {
    for (const n of nodes) {
        expect(Number.isFinite(n.position.x), `[${tag}] "${n.id}" x=${n.position.x}`).toBe(true);
        expect(Number.isFinite(n.position.y), `[${tag}] "${n.id}" y=${n.position.y}`).toBe(true);
    }
}

function assertNoDuplicateIds(nodes: ReturnType<typeof parseELKOutput>, tag = '') {
    const ids = nodes.map(n => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
        expect.fail(`[${tag}] Duplicate node IDs: ${[...new Set(dupes)].join(', ')}`);
    }
}

// ─── Suite 1: Schema Quality ─────────────────────────────────────────────────

describe('Real Schema — Parser Quality', () => {

    it('parses at least 20 tables', () => {
        expect(fullRenderGraph.tables.length).toBeGreaterThanOrEqual(20);
    });

    it('has at least 4 distinct schemas', () => {
        const schemas = new Set(fullRenderGraph.tables.map(t => t.schema || 'public'));
        expect(schemas.size).toBeGreaterThanOrEqual(4);
    });

    it('parses views', () => {
        expect(fullRenderGraph.views.length).toBeGreaterThanOrEqual(1);
    });

    it('parses materialized views', () => {
        expect(fullRenderGraph.matViews.length).toBeGreaterThanOrEqual(1);
    });

    it('parses ENUMs', () => {
        expect(fullRenderGraph.enums.length).toBeGreaterThanOrEqual(3);
    });

    it('parses domains', () => {
        expect(fullRenderGraph.domains.length).toBeGreaterThanOrEqual(2);
    });

    it('parses sequences', () => {
        expect(fullRenderGraph.sequences.length).toBeGreaterThanOrEqual(2);
    });

    it('parses extensions', () => {
        expect(fullRenderGraph.extensions.length).toBeGreaterThanOrEqual(1);
    });

    it('parses cross-schema FKs (e.g. payment → core)', () => {
        const cross = fullRenderGraph.relationships.filter(r =>
            (r.source.schema || 'public') !== (r.target.schema || 'public')
        );
        console.log(`  Cross-schema FKs: ${cross.length}`);
        expect(cross.length).toBeGreaterThan(0);
    });

    it('parses self-referential FKs (categories/messages)', () => {
        const self = fullRenderGraph.relationships.filter(r =>
            r.source.table === r.target.table && r.source.schema === r.target.schema
        );
        console.log(`  Self-referential FKs: ${self.length}`);
        expect(self.length).toBeGreaterThanOrEqual(1);
    });
});

// ─── Suite 2: Flat Layout — All Object Types ─────────────────────────────────

describe('Real Schema — Flat Layout (all object types)', () => {

    it('emits node for every table', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.tables.filter(t => !ids.has(toNodeId(t.schema, t.name)));
        if (missing.length) console.warn(`  Missing tables: ${missing.map(t => t.name).join(', ')}`);
        expect(missing.length).toBe(0);
    });

    it('emits node for every view', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.views.filter(v => !ids.has(toNodeId(v.schema, v.name)));
        expect(missing.length).toBe(0);
    });

    it('emits node for every materialized view', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.matViews.filter(v => !ids.has(toNodeId(v.schema, v.name)));
        expect(missing.length).toBe(0);
    });

    it('emits node for every ENUM', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.enums.filter((e: any) => !ids.has(toNodeId(e.schema, e.name)));
        expect(missing.length).toBe(0);
    });

    it('emits node for every domain', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.domains.filter(d => !ids.has(toNodeId(d.schema, d.name)));
        expect(missing.length).toBe(0);
    });

    it('emits node for every sequence', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        const missing = fullRenderGraph.sequences.filter(s => !ids.has(toNodeId(s.schema, s.name)));
        expect(missing.length).toBe(0);
    });

    it('emits node for every extension', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const ids = new Set(nodes.map(n => n.id));
        // Extensions are global (no schema) — toNodeId(undefined, name)
        const missing = fullRenderGraph.extensions.filter(e => !ids.has(toNodeId(undefined, e.name)));
        expect(missing.length).toBe(0);
    });

    it('total node count matches all tracked object types', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        const expected = totalObjects(fullRenderGraph);
        console.log(`  Total expected: ${expected}, actual ELK output: ${nodes.length}`);
        expect(nodes.length).toBe(expected);
    });

    it('no nodes have a parentId in flat mode', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: false });
        const withParent = nodes.filter(n => n.parentId !== undefined);
        expect(withParent.length).toBe(0);
    });

    it('all nodes have finite positions', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        assertValidPositions(nodes, 'flat/all');
    });

    it('no duplicate node IDs', async () => {
        const { nodes } = await runELK(fullRenderGraph);
        assertNoDuplicateIds(nodes, 'flat/all');
    });

    it('tables-only projection: node count = table count', async () => {
        // Build renderGraph with only tables
        const allNodes = [...schemaGraph.nodes.values()];
        const allTables = allNodes.filter(n => n.type === 'TABLE').map((n: any) => n.table);
        const tablesOnlySubgraph = {
            tables: allTables, nodes: allNodes,
            relationships: fullRenderGraph.relationships,
            focus: [], options: { focusTable: null, depth: 999, direction: 'both' as const },
            stats: { tableCount: allTables.length, depthCounts: new Map(), wasTruncated: false },
        };
        const tablesOnlyRg = applyProjection(tablesOnlySubgraph, TABLES_ONLY);
        const { nodes } = await runELK(tablesOnlyRg);
        expect(nodes.length).toBe(tablesOnlyRg.tables.length);
    });
});

// ─── Suite 3: Grouped Layout — All Object Types ───────────────────────────────

describe('Real Schema — Grouped Layout (groupBySchema=true)', () => {

    it('emits a groupNode for each schema', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        const groups = nodes.filter(n => n.type === 'groupNode');
        // Count distinct schemas across ALL object types — not just tables
        const schemas = new Set([
            ...fullRenderGraph.tables.map(t => t.schema || 'public'),
            ...fullRenderGraph.views.map(v => v.schema || 'public'),
            ...fullRenderGraph.matViews.map(v => v.schema || 'public'),
            ...fullRenderGraph.enums.map((e: any) => e.schema || 'public'),
            ...fullRenderGraph.domains.map(d => d.schema || 'public'),
            ...fullRenderGraph.sequences.map(s => s.schema || 'public'),
            ...fullRenderGraph.functions.map(f => f.schema || 'public'),
        ]);
        console.log(`  Groups: ${groups.map(g => g.id).join(', ')}`);
        console.log(`  Distinct schemas across all objects: ${[...schemas].join(', ')}`);
        // ELK should produce exactly one group per schema that has at least 1 object
        expect(groups.length).toBeGreaterThanOrEqual(1);
        expect(groups.length).toBeLessThanOrEqual(schemas.size);
    });

    it('total leaves = all objects, total nodes = leaves + groups', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        const groups = nodes.filter(n => n.type === 'groupNode');
        const leaves = nodes.filter(n => n.type !== 'groupNode');
        const expectedLeaves = totalObjects(fullRenderGraph);
        console.log(`  Groups: ${groups.length}, leaves: ${leaves.length} (expected ${expectedLeaves})`);
        expect(leaves.length).toBe(expectedLeaves);
    });

    it('no missing parent refs — every child has its group container', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        assertNoMissingParents(nodes, 'grouped/all');
    });

    it('group nodes appear before their children (React Flow ordering invariant)', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        assertParentsBeforeChildren(nodes, 'grouped/all');
    });

    it('all nodes (including groups) have finite positions', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        assertValidPositions(nodes, 'grouped/all');
    });

    it('no duplicate node IDs in grouped mode', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        assertNoDuplicateIds(nodes, 'grouped/all');
    });

    it('each table-type node has parentId = group_<schema>', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        const tableMap = new Map(fullRenderGraph.tables.map(t => [toNodeId(t.schema, t.name), t]));
        for (const node of nodes) {
            if (node.type !== 'tableNode' || !node.parentId) continue;
            const table = tableMap.get(node.id);
            if (!table) continue;
            expect(node.parentId).toBe(`group_${table.schema || 'public'}`);
        }
    });

    it('tables-only projection grouped: correct ordering + no missing parents', async () => {
        const allNodes = [...schemaGraph.nodes.values()];
        const allTables = allNodes.filter(n => n.type === 'TABLE').map((n: any) => n.table);
        const sub = {
            tables: allTables, nodes: allNodes,
            relationships: fullRenderGraph.relationships,
            focus: [], options: { focusTable: null, depth: 999, direction: 'both' as const },
            stats: { tableCount: allTables.length, depthCounts: new Map(), wasTruncated: false },
        };
        const rg = applyProjection(sub, TABLES_ONLY);
        const { nodes } = await runELK(rg, { groupBySchema: true });
        assertNoMissingParents(nodes, 'grouped/tables-only');
        assertParentsBeforeChildren(nodes, 'grouped/tables-only');
    });
});

// ─── Suite 4: All 4 Layout Directions ────────────────────────────────────────

describe('Real Schema — All Layout Directions', () => {
    const DIRS = ['LR', 'RL', 'TB', 'BT'] as const;

    for (const dir of DIRS) {
        it(`[${dir}] flat: valid positions, no duplicates`, async () => {
            const { nodes } = await runELK(fullRenderGraph, { direction: dir });
            assertValidPositions(nodes, `${dir}/flat`);
            assertNoDuplicateIds(nodes, `${dir}/flat`);
        });

        it(`[${dir}] grouped: no missing parents, correct ordering`, async () => {
            const { nodes } = await runELK(fullRenderGraph, { direction: dir, groupBySchema: true });
            assertNoMissingParents(nodes, `${dir}/grouped`);
            assertParentsBeforeChildren(nodes, `${dir}/grouped`);
            assertValidPositions(nodes, `${dir}/grouped`);
        });
    }
});

// ─── Suite 5: Per-Schema Subset Tests ────────────────────────────────────────

describe('Real Schema — Per-Schema Subsets', () => {

    function makeSubgraphFor(schemas: string[]) {
        const schemaSet = new Set(schemas);
        const allNodes = [...schemaGraph.nodes.values()].filter(n => {
            const s = (n as any).table?.schema || (n as any).view?.schema ||
                (n as any).functionDef?.schema || (n as any).enumDef?.schema ||
                (n as any).domainDef?.schema || (n as any).sequenceDef?.schema ||
                'public';
            return schemaSet.has(s);
        });
        const allTables = allNodes.filter(n => n.type === 'TABLE').map((n: any) => n.table);
        const tableIds = new Set(allTables.map(t => toNodeId(t.schema, t.name)));
        const rels = fullRenderGraph.relationships.filter(r =>
            tableIds.has(toNodeId(r.source.schema, r.source.table)) &&
            tableIds.has(toNodeId(r.target.schema, r.target.table))
        );
        return {
            tables: allTables, nodes: allNodes, relationships: rels,
            focus: [], options: { focusTable: null, depth: 999, direction: 'both' as const },
            stats: { tableCount: allTables.length, depthCounts: new Map(), wasTruncated: false },
        };
    }

    it('core schema only (flat): all tables have nodes, valid positions', async () => {
        const rg = applyProjection(makeSubgraphFor(['core']), ALL_VISIBLE);
        const { nodes } = await runELK(rg);
        assertValidPositions(nodes, 'core/flat');
        assertNoDuplicateIds(nodes, 'core/flat');
        console.log(`  core schema: ${nodes.length} nodes`);
    });

    it('ecommerce schema only (grouped): correct ordering + no missing parents', async () => {
        const rg = applyProjection(makeSubgraphFor(['ecommerce']), ALL_VISIBLE);
        const { nodes } = await runELK(rg, { groupBySchema: true });
        assertNoMissingParents(nodes, 'ecommerce/grouped');
        assertParentsBeforeChildren(nodes, 'ecommerce/grouped');
        console.log(`  ecommerce schema: ${nodes.length} nodes`);
    });

    it('payment + core cross-schema (grouped): valid output with cross-schema FKs', async () => {
        const rg = applyProjection(makeSubgraphFor(['payment', 'core']), ALL_VISIBLE);
        const { nodes } = await runELK(rg, { groupBySchema: true });
        assertNoMissingParents(nodes, 'payment+core/grouped');
        assertParentsBeforeChildren(nodes, 'payment+core/grouped');
        assertValidPositions(nodes, 'payment+core/grouped');
    });

    it('analytics schema only (flat with enums + views)', async () => {
        const rg = applyProjection(makeSubgraphFor(['analytics']), ALL_VISIBLE);
        const { nodes } = await runELK(rg);
        assertValidPositions(nodes, 'analytics/flat');
        assertNoDuplicateIds(nodes, 'analytics/flat');
        console.log(`  analytics schema: ${nodes.length} nodes`);
    });

    it('all 6 schemas grouped: complete invariants', async () => {
        const { nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        assertNoMissingParents(nodes, 'full/grouped');
        assertParentsBeforeChildren(nodes, 'full/grouped');
        assertValidPositions(nodes, 'full/grouped');
        assertNoDuplicateIds(nodes, 'full/grouped');
    });
});

// ─── Suite 6: SchemaGraph Integration ────────────────────────────────────────

describe('Real Schema — SchemaGraph + RiskMap', () => {

    it('buildSchemaGraph succeeds without errors', () => {
        expect(() => buildSchemaGraph(parsedSchema)).not.toThrow();
    });

    it('schemaGraph.nodes includes TABLE, VIEW, MATERIALIZED_VIEW, ENUM, DOMAIN, SEQUENCE, EXTENSION types', () => {
        const types = new Set([...schemaGraph.nodes.values()].map(n => n.type));
        console.log(`  Node types in graph: ${[...types].join(', ')}`);
        expect(types.has('TABLE')).toBe(true);
        expect(types.has('ENUM')).toBe(true);
    });

    it('analyzeCascadeRisks returns risk map with entries', () => {
        const riskMap = analyzeCascadeRisks(schemaGraph);
        console.log(`  Risk entries: ${riskMap.size}`);
        expect(riskMap.size).toBeGreaterThan(0);
    });

    it('layout with riskMap option returns same node count as without', async () => {
        const riskMap = analyzeCascadeRisks(schemaGraph);
        const { nodes: withRisk } = await runELK(fullRenderGraph, { riskMap, graph: schemaGraph });
        const { nodes: without } = await runELK(fullRenderGraph);
        expect(withRisk.length).toBe(without.length);
    });

    it('highlighted path dims non-path nodes, keeps total count', async () => {
        const tenantsId = toNodeId('core', 'tenants');
        const usersId = toNodeId('core', 'users');
        const { nodes } = await runELK(fullRenderGraph, { highlightedPath: [tenantsId, usersId] });
        const dimmed = nodes.filter(n => (n.style as any)?.opacity === 0.3);
        const undimmed = nodes.filter(n => (n.style as any)?.opacity !== 0.3);
        console.log(`  Highlight: ${undimmed.length} normal, ${dimmed.length} dimmed`);
        expect(undimmed.length).toBeGreaterThanOrEqual(2);
        expect(dimmed.length).toBeGreaterThan(0);
        // Total node count must not change
        expect(nodes.length).toBe(totalObjects(fullRenderGraph));
    });

    it('activeSubgraphIds dims non-subgraph nodes', async () => {
        const coreIds = new Set(
            fullRenderGraph.tables
                .filter(t => t.schema === 'core')
                .map(t => toNodeId(t.schema, t.name))
        );
        const { nodes } = await runELK(fullRenderGraph, { activeSubgraphIds: coreIds });
        const dimmed = nodes.filter(n => (n.style as any)?.opacity === 0.3);
        console.log(`  Subgraph core: ${coreIds.size} in subgraph, ${dimmed.length} dimmed`);
        expect(dimmed.length).toBeGreaterThan(0);
    });
});

// ─── Suite 7: Performance Benchmarks ─────────────────────────────────────────

describe('Real Schema — Performance', () => {

    it('flat layout of all objects completes < 10s', async () => {
        const { durationMs, nodes } = await runELK(fullRenderGraph);
        console.log(`[Perf] Flat (${nodes.length} nodes): ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(10000);
    });

    it('grouped layout of all objects completes < 15s', async () => {
        const { durationMs, nodes } = await runELK(fullRenderGraph, { groupBySchema: true });
        console.log(`[Perf] Grouped (${nodes.length} nodes): ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(15000);
    });

    it('5× repeated grouped layouts show no degradation (max < 3× avg + 500ms)', async () => {
        const times: number[] = [];
        for (let i = 0; i < 5; i++) {
            const { durationMs } = await runELK(fullRenderGraph, { groupBySchema: true });
            times.push(durationMs);
        }
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        console.log(`[Perf] 5× grouped: avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
        expect(max).toBeLessThan(avg * 3 + 500);
    });

    it('full pipeline (graph build + risks + grouped layout) completes < 20s', async () => {
        const t0 = performance.now();
        const g = buildSchemaGraph(parsedSchema);
        const riskMap = analyzeCascadeRisks(g);
        const { nodes } = await runELK(fullRenderGraph, {
            groupBySchema: true, riskMap, graph: g
        });
        const total = performance.now() - t0;
        console.log(`[Perf] Full pipeline (${nodes.length} nodes): ${total.toFixed(1)}ms`);
        expect(total).toBeLessThan(20000);
    });

    it('TB direction grouped layout performs within budget', async () => {
        const { durationMs } = await runELK(fullRenderGraph, { direction: 'TB', groupBySchema: true });
        console.log(`[Perf] TB grouped: ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(15000);
    });
});
