/**
 * Test 1: build-graph.test.ts
 * Verifies graph construction: index/trigger/policy attachment,
 * materialized view typing, self-referential FK handling.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { TableNode } from '../types';
import { TEST_SQL } from './fixture.sql';

describe('build-graph', () => {
    it('constructs graph correctly from parsed schema', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        // Orders node: indexes
        const ordersNode = graph.nodes.get('demo.orders');
        expect(ordersNode).toBeDefined();
        const ordersTable = ordersNode as TableNode;
        expect(ordersTable.indexes?.length).toBe(2);

        // Order_items node: triggers
        const orderItemsNode = graph.nodes.get('demo.order_items');
        expect(orderItemsNode).toBeDefined();
        const itemsTable = orderItemsNode as TableNode;
        expect(itemsTable.triggers?.length).toBe(1);

        // Orders node: policies
        expect(ordersTable.policies?.length).toBe(1);

        // Materialized view type
        const matViewNode = graph.nodes.get('demo.product_sales_summary');
        expect(matViewNode).toBeDefined();
        expect(matViewNode?.type).toBe('MATERIALIZED_VIEW');

        // Regular view type
        const viewNode = graph.nodes.get('demo.user_order_summary');
        expect(viewNode).toBeDefined();
        expect(viewNode?.type).toBe('VIEW');

        // Self-referential FK (categories)
        const catNode = graph.nodes.get('demo.categories');
        expect(catNode).toBeDefined();
        // Self-ref FK should exist in relationships but adjacency skips self-loops
        const selfRefRel = graph.relationships.find(
            r => r.source.table.includes('categories') && r.target.table.includes('categories')
        );
        expect(selfRefRel).toBeDefined();
    });

    it('captures enum types in graph.enums', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        expect(graph.enums.has('demo.order_status')).toBe(true);
        const orderStatusEnum = graph.enums.get('demo.order_status');
        expect(orderStatusEnum?.values).toContain('pending');
        expect(orderStatusEnum?.values).toContain('paid');
        expect(orderStatusEnum?.values).toContain('shipped');
        expect(orderStatusEnum?.values).toContain('cancelled');
    });

    it('attaches materialized view unique index to graph indexes', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        const matViewIndex = graph.indexes.find(
            idx => idx.table === 'product_sales_summary' || idx.table.includes('product_sales_summary')
        );
        expect(matViewIndex).toBeDefined();
        expect(matViewIndex?.isUnique).toBe(true);
    });
});
