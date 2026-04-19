/**
 * Test 2: subgraph-traversal.test.ts
 * Verifies BFS traversal: self-ref doesn't infinite loop,
 * focus on orders depth=1 direction=both finds users + order_items + view.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { extractSubgraph } from '../core/subgraph';
import { TEST_SQL } from './fixture.sql';

describe('subgraph-traversal', () => {
    it('handles self-referential FKs without infinite loops', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        // --- Self-referential FK doesn't cause infinite loop ---
        const catSubgraph = extractSubgraph(graph, ['demo.categories'], {
            maxDepth: 3,
            direction: 'both',
        });

        expect(catSubgraph.nodes.length).toBeGreaterThanOrEqual(1);
        expect(catSubgraph.nodes.length).toBe(1); // Self-ref deduplicated by distance map
    });

    it('extracts correct neighborhood for orders depth=1', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        // --- Focus on orders depth=1 direction=both ---
        const ordersSubgraph = extractSubgraph(graph, ['demo.orders'], {
            maxDepth: 1,
            direction: 'both',
        });
        const nodeIds = ordersSubgraph.nodes.map(n => n.id);

        expect(nodeIds).toContain('demo.orders'); // focus
        expect(nodeIds).toContain('demo.users'); // outbound FK
        expect(nodeIds).toContain('demo.order_items'); // inbound FK
        expect(nodeIds).toContain('demo.user_order_summary'); // inbound VIEW_DEPENDENCY

        // Tables count should be 3 (orders, users, order_items)
        expect(ordersSubgraph.tables.length).toBe(3);
    });
});
