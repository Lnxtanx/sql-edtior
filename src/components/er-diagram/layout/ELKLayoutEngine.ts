/**
 * ELKLayoutEngine.ts  (orchestrator — ~50 lines)
 *
 * Hierarchical ELK-based layout engine for the ER diagram.
 * Replaces Dagre compound mode with a true two-level hierarchical layout:
 *   - Root level: inter-group spacing (between schemas)
 *   - Group level: intra-group spacing (between tables within a schema)
 *
 * Phase 5.2: Layout computation runs inside a Web Worker (elk.worker.ts) to
 * avoid blocking the main React rendering thread.
 *
 * This file is intentionally thin — all heavy logic lives in elk/ submodules:
 *   elk/constants.ts        — node sizing constants
 *   elk/schemaColors.ts     — color palette & getSchemaColor()
 *   elk/heightCalculators.ts — computeTableHeight() etc.
 *   elk/buildELKGraph.ts    — ELK graph JSON builder + layout option factories
 *   elk/parseELKOutput.ts   — ELK → React Flow node converter
 */
import ELK from 'elkjs/lib/elk.bundled.js';
import { RenderGraph } from '@/lib/schema-workspace';
import { ILayoutEngine, LayoutEngineOptions, LayoutResult } from './types';
import { buildELKGraph } from './elk/buildELKGraph';
import { parseELKOutput } from './elk/parseELKOutput';

// ---------------------------------------------------------------------------
// Module-level ELK singleton — bundled (main-thread) version.
// We attempted to run ELK in a Vite module Worker, but the Worker constructor
// does not throw when the worker fails at runtime (CJS/ESM mismatch), leaving
// elk.layout() hanging forever → infinite spinner.
// elk.bundled.js on the main thread is fast enough (< 200ms for 200 tables).
// ---------------------------------------------------------------------------
const elk = new ELK();

// ---------------------------------------------------------------------------
// ILayoutEngine implementation
// ---------------------------------------------------------------------------
export class ELKLayoutEngine implements ILayoutEngine {
    async layout(renderGraph: RenderGraph, options: LayoutEngineOptions): Promise<LayoutResult> {
        const elkGraph = buildELKGraph(renderGraph, options);

        const TIMEOUT_MS = 8000; // 8 second max for ELK
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('ELK_TIMEOUT')), TIMEOUT_MS)
        );

        try {
            const positioned = await Promise.race([
                elk.layout(elkGraph),
                timeoutPromise,
            ]);
            const nodes = parseELKOutput(positioned, renderGraph, options);
            return { nodes, edges: [] };
        } catch (err: any) {
            if (err.message === 'ELK_TIMEOUT' && options.groupBySchema) {
                console.warn('[ELK] Hierarchical layout timed out, falling back to flat layout');
                const flatGraph = buildELKGraph(renderGraph, { ...options, groupBySchema: false });

                const FLAT_TIMEOUT_MS = 15000; // 15s max for flat layout
                const flatTimeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('ELK_FLAT_TIMEOUT')), FLAT_TIMEOUT_MS)
                );

                const positioned = await Promise.race([
                    elk.layout(flatGraph),
                    flatTimeoutPromise,
                ]);
                const nodes = parseELKOutput(positioned, renderGraph, { ...options, groupBySchema: false });
                return { nodes, edges: [], timedOut: true };
            }
            throw err;
        }
    }
}
