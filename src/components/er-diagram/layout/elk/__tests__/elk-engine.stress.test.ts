/**
 * ELK Layout Engine — Heavy Stress Test Suite
 *
 * Tests the full pipeline: buildELKGraph → ELK layout → parseELKOutput
 * covering correctness, ordering invariants, grouping, and performance.
 *
 * Run with: npx vitest run src/components/er-diagram/layout/elk/__tests__/elk-engine.stress.test.ts
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled.js';
import { buildELKGraph } from '../buildELKGraph';
import { parseELKOutput } from '../parseELKOutput';
import { Table, Relationship, Column } from '@/lib/sql-parser';
import { RenderGraph } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { LayoutEngineOptions } from '../../types';

// ─── Test data generators ───────────────────────────────────────────────────

function makeColumn(name: string, type = 'INTEGER', isPrimaryKey = false, isForeignKey = false): Column {
    return {
        name,
        type,
        typeCategory: 'numeric',
        isPrimaryKey,
        isForeignKey,
        nullable: !isPrimaryKey,
        isUnique: isPrimaryKey,
        isGenerated: false,
    };
}

function makeTable(name: string, schema: string, extraColumns: Column[] = []): Table {
    return {
        name,
        schema,
        columns: [
            makeColumn('id', 'SERIAL', true),
            makeColumn('created_at', 'TIMESTAMPTZ'),
            ...extraColumns,
        ],
        primaryKey: ['id'],
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: [],
    };
}

function makeFK(
    sourceSchema: string, sourceTable: string, sourceColumn: string,
    targetSchema: string, targetTable: string, targetColumn: string,
    id?: string,
): Relationship {
    return {
        id: id ?? `${sourceSchema}.${sourceTable}.${sourceColumn}_to_${targetSchema}.${targetTable}.${targetColumn}`,
        source: { schema: sourceSchema, table: sourceTable, column: sourceColumn },
        target: { schema: targetSchema, table: targetTable, column: targetColumn },
        confidence: 1,
        type: 'FOREIGN_KEY',
    };
}

/** Generate N tables in a given schema, all referencing a "root" hub table */
function generateHubAndSpoke(schema: string, count: number): { tables: Table[]; relationships: Relationship[] } {
    const hub = makeTable('hub', schema);
    const tables: Table[] = [hub];
    const relationships: Relationship[] = [];

    for (let i = 0; i < count; i++) {
        const spoke = makeTable(`spoke_${i}`, schema, [makeColumn('hub_id', 'INTEGER', false, true)]);
        tables.push(spoke);
        relationships.push(makeFK(schema, `spoke_${i}`, 'hub_id', schema, 'hub', 'id'));
    }
    return { tables, relationships };
}

/** Generate a deep FK chain: a → b → c → ... → z */
function generateDeepChain(schema: string, depth: number): { tables: Table[]; relationships: Relationship[] } {
    const tables: Table[] = [];
    const relationships: Relationship[] = [];

    for (let i = 0; i < depth; i++) {
        const extra = i > 0 ? [makeColumn(`parent_id`, 'INTEGER', false, true)] : [];
        tables.push(makeTable(`chain_${i}`, schema, extra));
        if (i > 0) {
            relationships.push(makeFK(schema, `chain_${i}`, 'parent_id', schema, `chain_${i - 1}`, 'id'));
        }
    }
    return { tables, relationships };
}

/** Generate a many-to-many mesh: every entity references every other via junction tables */
function generateManyToManyMesh(schema: string, entityCount: number): { tables: Table[]; relationships: Relationship[] } {
    const entities: Table[] = [];
    const junctions: Table[] = [];
    const relationships: Relationship[] = [];

    for (let i = 0; i < entityCount; i++) {
        entities.push(makeTable(`entity_${i}`, schema));
    }

    let jIdx = 0;
    for (let a = 0; a < entityCount; a++) {
        for (let b = a + 1; b < entityCount; b++) {
            const jName = `j_${a}_${b}`;
            junctions.push(makeTable(jName, schema, [
                makeColumn(`entity_${a}_id`, 'INTEGER', false, true),
                makeColumn(`entity_${b}_id`, 'INTEGER', false, true),
            ]));
            relationships.push(makeFK(schema, jName, `entity_${a}_id`, schema, `entity_${a}`, 'id', `jfk_${jIdx++}`));
            relationships.push(makeFK(schema, jName, `entity_${b}_id`, schema, `entity_${b}`, 'id', `jfk_${jIdx++}`));
        }
    }
    return { tables: [...entities, ...junctions], relationships };
}

/** Build a RenderGraph from tables + relationships */
function makeRenderGraph(tables: Table[], relationships: Relationship[]): RenderGraph {
    return {
        tables,
        views: [],
        matViews: [],
        functions: [],
        enums: [],
        domains: [],
        roles: [],
        sequences: [],
        extensions: [],
        policies: [],
        relationships,
    };
}

/** Run the full ELK pipeline and return nodes + timing */
async function runPipeline(renderGraph: RenderGraph, options: Partial<LayoutEngineOptions> = {}): Promise<{
    nodes: ReturnType<typeof parseELKOutput>;
    durationMs: number;
}> {
    const elk = new ELK();
    const opts: LayoutEngineOptions = {
        direction: 'LR',
        nodeSpacing: 80,
        rankSpacing: 200,
        groupBySchema: false,
        viewMode: 'ALL',
        ...options,
    };

    const elkGraph = buildELKGraph(renderGraph, opts);
    const start = performance.now();
    const laid = await elk.layout(elkGraph);
    const durationMs = performance.now() - start;
    const nodes = parseELKOutput(laid, renderGraph, opts);
    return { nodes, durationMs };
}

// ─── Correctness helpers ─────────────────────────────────────────────────────

function assertNoMissingParents(nodes: ReturnType<typeof parseELKOutput>) {
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const node of nodes) {
        if (node.parentId) {
            expect(nodeIds.has(node.parentId),
                `Node "${node.id}" references parentId "${node.parentId}" which is missing from the output`
            ).toBe(true);
        }
    }
}

function assertParentsBeforeChildren(nodes: ReturnType<typeof parseELKOutput>) {
    const seen = new Set<string>();
    for (const node of nodes) {
        if (node.parentId) {
            expect(seen.has(node.parentId),
                `Node "${node.id}" appeared before its parent "${node.parentId}"`
            ).toBe(true);
        }
        seen.add(node.id);
    }
}

function assertValidPositions(nodes: ReturnType<typeof parseELKOutput>) {
    for (const node of nodes) {
        expect(Number.isFinite(node.position.x), `Node "${node.id}" has non-finite x`).toBe(true);
        expect(Number.isFinite(node.position.y), `Node "${node.id}" has non-finite y`).toBe(true);
    }
}

function assertAllTablesPresent(nodes: ReturnType<typeof parseELKOutput>, tables: Table[]) {
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const t of tables) {
        const id = toNodeId(t.schema, t.name);
        expect(nodeIds.has(id), `Table "${id}" is missing from ELK output`).toBe(true);
    }
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('ELK Engine — Correctness', () => {

    it('produces a node for every table in small schema (flat)', async () => {
        const tables = [
            makeTable('users', 'public'),
            makeTable('posts', 'public', [makeColumn('user_id', 'INTEGER', false, true)]),
        ];
        const relationships = [makeFK('public', 'posts', 'user_id', 'public', 'users', 'id')];
        const rg = makeRenderGraph(tables, relationships);

        const { nodes } = await runPipeline(rg);
        assertAllTablesPresent(nodes, tables);
        assertValidPositions(nodes);
    });

    it('all nodes have finite positions (flat, LR)', async () => {
        const { tables, relationships } = generateHubAndSpoke('public', 20);
        const { nodes } = await runPipeline(makeRenderGraph(tables, relationships));
        assertValidPositions(nodes);
    });

    it('all nodes have finite positions (flat, TB)', async () => {
        const { tables, relationships } = generateDeepChain('public', 30);
        const { nodes } = await runPipeline(makeRenderGraph(tables, relationships), { direction: 'TB' });
        assertValidPositions(nodes);
    });

    it('emits no duplicate node IDs', async () => {
        const { tables, relationships } = generateHubAndSpoke('public', 15);
        const { nodes } = await runPipeline(makeRenderGraph(tables, relationships));
        const ids = nodes.map(n => n.id);
        expect(ids.length).toBe(new Set(ids).size);
    });

    it('node count matches input table count (flat mode)', async () => {
        const { tables, relationships } = generateManyToManyMesh('public', 5);
        const rg = makeRenderGraph(tables, relationships);
        const { nodes } = await runPipeline(rg);
        expect(nodes.length).toBe(tables.length);
    });
});

describe('ELK Engine — Grouping (groupBySchema)', () => {

    it('emits group container nodes for each schema', async () => {
        const schemas = ['public', 'auth', 'billing'];
        const allTables: Table[] = [];
        const allRels: Relationship[] = [];

        for (const s of schemas) {
            const { tables, relationships } = generateHubAndSpoke(s, 5);
            allTables.push(...tables);
            allRels.push(...relationships);
        }

        const { nodes } = await runPipeline(makeRenderGraph(allTables, allRels), { groupBySchema: true });
        const groupNodes = nodes.filter(n => n.type === 'groupNode');
        expect(groupNodes.length).toBe(schemas.length);
    });

    it('every child node has a valid parentId referencing an existing group node', async () => {
        const schemas = ['public', 'analytics', 'payments'];
        const allTables: Table[] = [];
        const allRels: Relationship[] = [];

        for (const s of schemas) {
            const { tables, relationships } = generateDeepChain(s, 8);
            allTables.push(...tables);
            allRels.push(...relationships);
        }

        const { nodes } = await runPipeline(makeRenderGraph(allTables, allRels), { groupBySchema: true });
        assertNoMissingParents(nodes);
    });

    it('group container nodes appear BEFORE their children (React Flow requirement)', async () => {
        const schemas = ['public', 'auth', 'admin', 'audit'];
        const allTables: Table[] = [];
        const allRels: Relationship[] = [];

        for (const s of schemas) {
            const { tables, relationships } = generateHubAndSpoke(s, 10);
            allTables.push(...tables);
            allRels.push(...relationships);
        }

        const { nodes } = await runPipeline(makeRenderGraph(allTables, allRels), { groupBySchema: true });
        assertParentsBeforeChildren(nodes);
    });

    it('total node count = tables + group containers', async () => {
        const schemas = ['public', 'billing'];
        const allTables: Table[] = [];
        const allRels: Relationship[] = [];

        for (const s of schemas) {
            const { tables, relationships } = generateHubAndSpoke(s, 4);
            allTables.push(...tables);
            allRels.push(...relationships);
        }

        const { nodes } = await runPipeline(makeRenderGraph(allTables, allRels), { groupBySchema: true });
        const groupCount = nodes.filter(n => n.type === 'groupNode').length;
        expect(nodes.length).toBe(allTables.length + groupCount);
    });

    it('group node positions are finite', async () => {
        const { tables, relationships } = generateHubAndSpoke('public', 8);
        const { nodes } = await runPipeline(makeRenderGraph(tables, relationships), { groupBySchema: true });
        const groups = nodes.filter(n => n.type === 'groupNode');
        expect(groups.length).toBeGreaterThan(0);
        for (const g of groups) {
            expect(Number.isFinite(g.position.x)).toBe(true);
            expect(Number.isFinite(g.position.y)).toBe(true);
        }
    });

    it('cross-schema FKs are handled without dropping nodes', async () => {
        const tA = makeTable('users', 'auth', [makeColumn('id', 'SERIAL', true)]);
        const tB = makeTable('orders', 'billing', [makeColumn('user_id', 'INTEGER', false, true)]);
        const rel = makeFK('billing', 'orders', 'user_id', 'auth', 'users', 'id');
        const rg = makeRenderGraph([tA, tB], [rel]);

        const { nodes } = await runPipeline(rg, { groupBySchema: true });
        assertNoMissingParents(nodes);
        assertAllTablesPresent(nodes, [tA, tB]);
    });
});

describe('ELK Engine — Edge Cases', () => {

    it('handles single table with no FKs', async () => {
        const tables = [makeTable('solo', 'public')];
        const { nodes } = await runPipeline(makeRenderGraph(tables, []));
        expect(nodes.length).toBe(1);
        assertValidPositions(nodes);
    });

    it('handles self-referential FK (tree-structured table)', async () => {
        const treeTable = makeTable('categories', 'public', [makeColumn('parent_id', 'INTEGER', false, true)]);
        const selfRel = makeFK('public', 'categories', 'parent_id', 'public', 'categories', 'id');
        const { nodes } = await runPipeline(makeRenderGraph([treeTable], [selfRel]));
        expect(nodes.length).toBe(1);
        assertValidPositions(nodes);
    });

    it('handles diamond dependency pattern (A → B, A → C, B → D, C → D)', async () => {
        const tables = ['a', 'b', 'c', 'd'].map(name => makeTable(name, 'public', name !== 'a' ? [makeColumn(`dep_id`, 'INTEGER', false, true)] : []));
        const rels = [
            makeFK('public', 'b', 'dep_id', 'public', 'a', 'id', 'b→a'),
            makeFK('public', 'c', 'dep_id', 'public', 'a', 'id', 'c→a'),
            makeFK('public', 'd', 'dep_id', 'public', 'b', 'id', 'd→b'),
            makeFK('public', 'd', 'dep_id', 'public', 'c', 'id', 'd→c'),
        ];
        const { nodes } = await runPipeline(makeRenderGraph(tables, rels));
        expect(nodes.length).toBe(4);
        assertValidPositions(nodes);
    });

    it('handles empty schema (zero tables)', async () => {
        const { nodes } = await runPipeline(makeRenderGraph([], []));
        expect(nodes.length).toBe(0);
    });

    it('handles 1 table, 1 schema in grouped mode', async () => {
        const { nodes } = await runPipeline(
            makeRenderGraph([makeTable('lone', 'public')], []),
            { groupBySchema: true }
        );
        assertNoMissingParents(nodes);
        assertParentsBeforeChildren(nodes);
    });
});

describe('ELK Engine — Performance Benchmarks', () => {

    it('lays out 50 tables flat in under 3s', async () => {
        const { tables, relationships } = generateHubAndSpoke('public', 49);
        const { durationMs } = await runPipeline(makeRenderGraph(tables, relationships));
        console.log(`[Bench] 50-table flat layout: ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(3000);
    });

    it('lays out 100 tables flat in under 5s', async () => {
        const s1 = generateHubAndSpoke('public', 49);
        const s2 = generateHubAndSpoke('auth', 49);
        const tables = [...s1.tables, ...s2.tables];
        const rels = [...s1.relationships, ...s2.relationships];
        const { durationMs } = await runPipeline(makeRenderGraph(tables, rels));
        console.log(`[Bench] 100-table flat layout: ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(5000);
    });

    it('lays out 200-table schema with 5 groups in under 10s', async () => {
        const schemas = ['public', 'auth', 'billing', 'analytics', 'audit'];
        const allTables: Table[] = [];
        const allRels: Relationship[] = [];

        for (const s of schemas) {
            const { tables, relationships } = generateHubAndSpoke(s, 39); // 40 tables × 5 = 200
            allTables.push(...tables);
            allRels.push(...relationships);
        }

        const { nodes, durationMs } = await runPipeline(
            makeRenderGraph(allTables, allRels),
            { groupBySchema: true }
        );
        console.log(`[Bench] 200-table grouped layout (5 schemas): ${durationMs.toFixed(1)}ms → ${nodes.length} nodes`);
        expect(durationMs).toBeLessThan(10000);
        assertNoMissingParents(nodes);
        assertParentsBeforeChildren(nodes);
    });

    it('lays out 30-deep FK chain in under 3s', async () => {
        const { tables, relationships } = generateDeepChain('public', 30);
        const { durationMs } = await runPipeline(makeRenderGraph(tables, relationships));
        console.log(`[Bench] 30-depth FK chain: ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(3000);
    });

    it('lays out many-to-many mesh (6 entities = 15 junction tables) in under 4s', async () => {
        const { tables, relationships } = generateManyToManyMesh('public', 6);
        const { nodes, durationMs } = await runPipeline(makeRenderGraph(tables, relationships));
        console.log(`[Bench] M2M mesh (${tables.length} tables, ${relationships.length} FKs): ${durationMs.toFixed(1)}ms`);
        expect(durationMs).toBeLessThan(4000);
        expect(nodes.length).toBe(tables.length);
    });

    it('handles repeat layouts (10 × same graph) without degradation', async () => {
        const { tables, relationships } = generateHubAndSpoke('public', 20);
        const rg = makeRenderGraph(tables, relationships);
        const times: number[] = [];

        for (let i = 0; i < 10; i++) {
            const { durationMs } = await runPipeline(rg);
            times.push(durationMs);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        console.log(`[Bench] 10 × repeated layouts: avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);

        // No single run should be more than 3× the average (no memory leak / degradation)
        expect(max).toBeLessThan(avg * 3 + 200);
    });
});

describe('ELK Engine — Layout Directions', () => {
    const directions = ['LR', 'RL', 'TB', 'BT'] as const;

    for (const dir of directions) {
        it(`produces valid grouped layout in direction: ${dir}`, async () => {
            const { tables, relationships } = generateHubAndSpoke('public', 10);
            const { nodes } = await runPipeline(
                makeRenderGraph(tables, relationships),
                { direction: dir, groupBySchema: true }
            );
            assertNoMissingParents(nodes);
            assertParentsBeforeChildren(nodes);
            assertValidPositions(nodes);
        });
    }
});

describe('ELK Engine — Node Type Mix', () => {

    it('handles schema with tables and views (flat)', async () => {
        const tables = [makeTable('users', 'public'), makeTable('orders', 'public')];
        const views = [{
            name: 'user_orders',
            schema: 'public',
            columns: [makeColumn('id', 'INTEGER')],
            definition: 'SELECT * FROM users JOIN orders ON ...',
            dependencies: ['users', 'orders'],
        }];

        const rg: RenderGraph = {
            ...makeRenderGraph(tables, []),
            views: views as any,
        };

        const { nodes } = await runPipeline(rg);
        expect(nodes.length).toBe(tables.length + views.length);
        assertValidPositions(nodes);
    });
});
