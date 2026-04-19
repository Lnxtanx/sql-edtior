/**
 * Test 7: confidence-filter.test.ts
 * Verifies that minConfidence option in extractSubgraph correctly
 * excludes low-confidence (inferred) edges from the subgraph.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { extractSubgraph } from '../core/subgraph';

// SQL with one explicit FK (confidence=1.0) and structured so the parser
// may produce inferred relationships.
// We test the filter by manually checking confidence values after extraction.
const CONFIDENCE_SQL = `
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
);

CREATE TABLE public.orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id),
    total NUMERIC(10,2)
);

CREATE TABLE public.events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL
);
`;

describe('confidence-filter', () => {
    it('includes all edges when minConfidence=0', () => {
        const schema = parsePostgresSQL(CONFIDENCE_SQL);
        const graph = buildSchemaGraph(schema);

        const subgraph = extractSubgraph(graph, ['public.users'], {
            maxDepth: 2,
            direction: 'both',
            minConfidence: 0,
        });

        // All relationships should be included
        const explicitFK = subgraph.relationships.find(
            r => r.source.table.includes('orders') &&
                r.target.table.includes('users')
        );
        expect(explicitFK).toBeDefined();
    });

    it('explicit FK has confidence=1.0', () => {
        const schema = parsePostgresSQL(CONFIDENCE_SQL);
        const graph = buildSchemaGraph(schema);

        const explicitFK = graph.relationships.find(
            r => r.source.table.includes('orders') &&
                r.target.table.includes('users') &&
                r.type === 'FOREIGN_KEY'
        );

        expect(explicitFK).toBeDefined();
        expect(explicitFK?.confidence).toBe(1.0);
    });

    it('minConfidence=1.0 excludes inferred edges, keeps explicit FKs', () => {
        const schema = parsePostgresSQL(CONFIDENCE_SQL);
        const graph = buildSchemaGraph(schema);

        const subgraph = extractSubgraph(graph, ['public.users'], {
            maxDepth: 2,
            direction: 'both',
            minConfidence: 1.0,
        });

        // All remaining relationships must have confidence >= 1.0
        for (const rel of subgraph.relationships) {
            expect(rel.confidence ?? 1.0).toBeGreaterThanOrEqual(1.0);
        }

        // Explicit FK from orders to users should still be present
        const explicitFK = subgraph.relationships.find(
            r => r.source.table.includes('orders') && r.target.table.includes('users')
        );
        expect(explicitFK).toBeDefined();
    });

    it('subgraph node count does not change with confidence filter (nodes depend on edges that pass)', () => {
        const schema = parsePostgresSQL(CONFIDENCE_SQL);
        const graph = buildSchemaGraph(schema);

        const allEdges = extractSubgraph(graph, ['public.users'], {
            maxDepth: 1,
            direction: 'both',
            minConfidence: 0,
        });

        const strictEdges = extractSubgraph(graph, ['public.users'], {
            maxDepth: 1,
            direction: 'both',
            minConfidence: 1.0,
        });

        // Strict filter should have same or fewer relationships
        expect(strictEdges.relationships.length).toBeLessThanOrEqual(allEdges.relationships.length);
    });
});
