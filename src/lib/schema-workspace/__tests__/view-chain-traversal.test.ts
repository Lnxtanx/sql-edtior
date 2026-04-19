/**
 * Test 3: view-chain-traversal.test.ts
 * Focus on orders depth=2 direction=both.
 * top_customers should appear at distance 2 via chain:
 *   orders ← user_order_summary ← top_customers
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { extractSubgraph } from '../core/subgraph';
import { TEST_SQL } from './fixture.sql';

describe('view-chain-traversal', () => {
    it('traverses view dependency chains correctly', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        const subgraph = extractSubgraph(graph, ['demo.orders'], {
            maxDepth: 2,
            direction: 'both',
        });
        const nodeIds = subgraph.nodes.map(n => n.id);

        // Distance map
        const distanceMap = new Map(subgraph.nodes.map(n => [n.id, n.distance]));

        expect(nodeIds).toContain('demo.top_customers');
        expect(distanceMap.get('demo.top_customers')).toBe(2);

        expect(distanceMap.get('demo.user_order_summary')).toBe(1);

        // product_sales_summary depends on order_items which is at dist 1
        // so product_sales_summary should also be at dist 2
        expect(nodeIds).toContain('demo.product_sales_summary');
    });
});
