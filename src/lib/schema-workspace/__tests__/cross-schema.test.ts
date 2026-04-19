/**
 * Test 6: cross-schema.test.ts
 * Verifies FK resolution and node ID generation across two schemas.
 * A table in 'billing' schema references a table in 'public' schema.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { extractSubgraph } from '../core/subgraph';
import { toNodeId } from '../utils';

const CROSS_SCHEMA_SQL = `
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE public.products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL
);

CREATE SCHEMA billing;

CREATE TABLE billing.invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    total NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE billing.invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_invoices_user_id ON billing.invoices(user_id);
CREATE INDEX idx_invoice_items_invoice_id ON billing.invoice_items(invoice_id);

CREATE VIEW billing.user_invoice_summary AS
SELECT u.id AS user_id, u.email, COUNT(i.id) AS invoice_count, SUM(i.total) AS total_billed
FROM public.users u
LEFT JOIN billing.invoices i ON i.user_id = u.id
GROUP BY u.id, u.email;
`;

describe('cross-schema', () => {
    it('generates correct qualified node IDs for both schemas', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        expect(graph.nodes.has('public.users')).toBe(true);
        expect(graph.nodes.has('public.products')).toBe(true);
        expect(graph.nodes.has('billing.invoices')).toBe(true);
        expect(graph.nodes.has('billing.invoice_items')).toBe(true);
    });

    it('resolves cross-schema FK from billing.invoices to public.users', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        const crossSchemaFK = graph.relationships.find(rel =>
            toNodeId(rel.source.schema, rel.source.table) === 'billing.invoices' &&
            toNodeId(rel.target.schema, rel.target.table) === 'public.users' &&
            rel.type === 'FOREIGN_KEY'
        );

        expect(crossSchemaFK).toBeDefined();
        expect(crossSchemaFK?.onDelete?.toUpperCase()).toBe('CASCADE');
    });

    it('resolves cross-schema FK from billing.invoice_items to public.products', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        const crossFK = graph.relationships.find(rel =>
            toNodeId(rel.source.schema, rel.source.table) === 'billing.invoice_items' &&
            toNodeId(rel.target.schema, rel.target.table) === 'public.products' &&
            rel.type === 'FOREIGN_KEY'
        );

        expect(crossFK).toBeDefined();
    });

    it('attaches cross-schema indexes correctly to billing nodes', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        const invoicesNode = graph.nodes.get('billing.invoices');
        expect(invoicesNode?.type).toBe('TABLE');
        if (invoicesNode?.type === 'TABLE') {
            expect(invoicesNode.indexes.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('traverses cross-schema FK in subgraph from billing.invoices depth=1', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        const subgraph = extractSubgraph(graph, ['billing.invoices'], {
            maxDepth: 1,
            direction: 'both',
        });

        const nodeIds = subgraph.nodes.map(n => n.id);

        expect(nodeIds).toContain('billing.invoices');
        expect(nodeIds).toContain('public.users');
        expect(nodeIds).toContain('billing.invoice_items');
    });

    it('places cross-schema view in correct schema node bucket', () => {
        const schema = parsePostgresSQL(CROSS_SCHEMA_SQL);
        const graph = buildSchemaGraph(schema);

        const viewNode = graph.nodes.get('billing.user_invoice_summary');
        expect(viewNode).toBeDefined();
        expect(viewNode?.type).toBe('VIEW');
    });

    it('toNodeId handles cross-schema qualified names without double-qualifying', () => {
        expect(toNodeId('public', 'users')).toBe('public.users');
        expect(toNodeId('billing', 'invoices')).toBe('billing.invoices');
        expect(toNodeId(undefined, 'public.users')).toBe('public.users');
        expect(toNodeId('billing', 'billing.invoices')).toBe('billing.invoices');
    });
});
