/**
 * Test 4: projection.test.ts
 * Verify applyProjection filters views/matViews correctly
 * and removes VIEW_DEPENDENCY edges when views are hidden.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { parsePostgresSQL } from '../../sql-parser';
import { buildSchemaGraph } from '../build-graph';
import { extractSubgraph } from '../core/subgraph';
import { applyProjection } from '../core/projection';
import { TEST_SQL } from './fixture.sql';

describe('projection', () => {
    it('filters views and matViews correctly based on projection flags', () => {
        const schema = parsePostgresSQL(TEST_SQL);
        const graph = buildSchemaGraph(schema);

        // Extract subgraph centered on users at depth 2
        const subgraph = extractSubgraph(graph, ['demo.users'], {
            maxDepth: 2,
            direction: 'both',
        });

        // --- showViews=false ---
        const hiddenViews = applyProjection(subgraph, {
            showViews: false,
            showMaterializedViews: false,
        });

        expect(hiddenViews.views.length).toBe(0);
        expect(hiddenViews.matViews.length).toBe(0);

        // VIEW_DEPENDENCY edges should be removed
        const viewDepEdges = hiddenViews.relationships.filter(r => r.type === 'VIEW_DEPENDENCY');
        expect(viewDepEdges.length).toBe(0);

        // Tables should still be present
        expect(hiddenViews.tables.length).toBeGreaterThan(0);

        // --- showViews=true ---
        const shownViews = applyProjection(subgraph, {
            showViews: true,
            showMaterializedViews: true,
        });

        // user_order_summary should appear (it depends on users)
        const hasUserOrderSummary = shownViews.views.some(
            v => v.name.includes('user_order_summary')
        );
        expect(hasUserOrderSummary).toBe(true);

        // VIEW_DEPENDENCY edge from user_order_summary to users should be present
        const viewEdge = shownViews.relationships.find(
            r => r.type === 'VIEW_DEPENDENCY' && r.target.table.includes('users')
        );
        expect(viewEdge).toBeDefined();
    });
});
