/**
 * Test 5: stats-schema-mismatch.test.ts
 * Regression test: indexes/triggers/policies with undefined schema
 * but qualified table name must match correctly via toNodeId.
 */

import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { TableNode } from '../types';
import { toNodeId } from '../utils';
import { TEST_SQL } from './fixture.sql';

describe('stats-schema-mismatch', () => {
    it('handles unresolved schemas and aggregates stats using toNodeId correctly', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        const focusTable = 'demo.orders';

        // Reproduce useDiagramStats filtering logic
        const indexCount = graph.indexes.filter(
            idx => toNodeId(idx.schema, idx.table) === focusTable
        ).length;
        const policyCount = graph.policies.filter(
            p => toNodeId(p.schema, p.table) === focusTable
        ).length;
        const triggerCountOrders = graph.triggers.filter(
            t => toNodeId(t.schema, t.table) === focusTable
        ).length;

        expect(indexCount).toBe(2);
        expect(policyCount).toBe(1);
        expect(triggerCountOrders).toBe(0); // trigger on order_items

        // Trigger is on order_items
        const focusOrderItems = 'demo.order_items';
        const triggerCountItems = graph.triggers.filter(
            t => toNodeId(t.schema, t.table) === focusOrderItems
        ).length;

        expect(triggerCountItems).toBe(1);

        // --- Verify toNodeId handles qualified names with undefined schema ---
        expect(toNodeId(undefined, 'demo.orders')).toBe('demo.orders');
        expect(toNodeId('demo', 'orders')).toBe('demo.orders');
        expect(toNodeId(undefined, 'users')).toBe('public.users');

        // Verify graph node attachment matches
        const ordersNode = graph.nodes.get('demo.orders') as TableNode;
        expect(ordersNode?.indexes?.length).toBe(indexCount);
        expect(ordersNode?.policies?.length).toBe(policyCount);

        const itemsNode = graph.nodes.get('demo.order_items') as TableNode;
        expect(itemsNode?.triggers?.length).toBe(triggerCountItems);
    });
});
