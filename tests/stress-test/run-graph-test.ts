
import { buildSchemaGraph } from '../../src/lib/schema-workspace/build-graph';
import { analyzeCascadeRisks } from '../../src/lib/schema-workspace/core/danger-analysis';
import { extractSubgraph } from '../../src/lib/schema-workspace/core/subgraph';
import { getNodeIds, getNode } from '../../src/lib/schema-workspace/build-graph';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock Parser (Since we can't easily import the complex regex parser here without environment setup)
// actually, let's try to import the real parser if possible.
// If not, we might need to mock the ParsedSchema structure.
// But the user wants to test the "Pipeline".
// So using the real parser is best.
// Assuming we can run this with `npx tsx` which handles imports.

// We need to import the SQL parser. 
// Check where it is. `src/lib/sql-parser/index.ts`?
// Let's assume we can mock the `ParsedSchema` if the parser is hard to invoke, 
// BUT the user passed SQL.
// Let's try to find the parser entry point first.

// Placeholder: I will assume `parseSql` is available or I will implement a basic mock loader 
// if the parser is UI-coupled.
// Based on file explorer, `src/lib/sql-parser` exists.

import { parsePostgresSQL } from '../../src/lib/sql-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    console.log("🚀 Starting Graph Stress Test...");

    const sqlPath = path.join(__dirname, 'complex-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`📄 Loaded SQL (${sqlContent.length} bytes)`);

    // 1. Parse SQL
    console.log("Parsing SQL...");
    const parsedSchema = parsePostgresSQL(sqlContent);

    console.log(`✅ Parsed: ${parsedSchema.tables.length} tables, ${parsedSchema.views.length} views, ${parsedSchema.triggers.length} triggers.`);

    // DEBUG: Check parser output quality
    console.log("DEBUG: First Function Body:", parsedSchema.functions[0]?.body ? "Present" : "Missing");
    console.log("DEBUG: Relationship onDelete sample:", parsedSchema.relationships.map(r => r.onDelete).filter(Boolean).slice(0, 5));

    // 2. Build Graph
    console.log("Building Schema Graph...");
    const graph = buildSchemaGraph(parsedSchema);

    const nodeCount = graph.nodes.size;
    const relCount = graph.relationships.length;
    console.log(`✅ Graph Built: ${nodeCount} nodes, ${relCount} relationships.`);
    console.log("Graph Nodes:", Array.from(graph.nodes.keys()));

    // ASSERTIONS
    const expectedTables = [
        'auth.users', 'auth.sessions',
        'public.organizations', 'public.teams', 'public.projects', 'public.tasks', 'public.subtasks', 'public.task_logs', 'public.schema_migrations',
        'ecom.products', 'ecom.orders', 'ecom.order_items', 'ecom.payments', 'ecom.shipments',
        'analytics.events'
    ];
    const expectedViews = ['analytics.v_high_value_users', 'analytics.v_vip_summary'];

    // Check Nodes Exist
    const missingNodes = [...expectedTables, ...expectedViews].filter(id => !graph.nodes.has(id));
    if (missingNodes.length > 0) {
        console.error("❌ Missing Expected Nodes:", missingNodes);
    } else {
        console.log("✅ All expected nodes present.");
    }

    // 3. Test Danger Analysis (Cascade Chains)
    console.log("\n⚠️ Running Danger Analysis...");
    const risks = analyzeCascadeRisks(graph);

    // public.organizations should be HIGH risk (Chain depth > 5)
    // Org -> Team -> Project -> Task -> Subtask -> Log
    const orgRisk = risks.get('public.organizations');

    if (orgRisk && orgRisk.level === 'HIGH') {
        console.log("✅ Cascade Risk correctly identified for 'public.organizations' (HIGH)");
    } else {
        console.error("❌ Failed to identify High Cascade Risk for 'public.organizations'. Got:", orgRisk);
    }

    // 4. Test Subgraph Extraction (Depths)
    console.log("\n🕸️ Testing Subgraph Extraction...");

    // Scenario A: Extract 'public.organizations' with depth 5 (Should get everything down to task_logs)
    const deepSubgraph = extractSubgraph(graph, ['public.organizations'], {
        maxDepth: 10,
        direction: 'outbound'
    });
    console.log(`   Subgraph (Org -> Outbound Max): ${deepSubgraph.tables.length} tables.`);

    const hasTaskLogs = deepSubgraph.nodes.some(n => n.id === 'public.task_logs');
    if (hasTaskLogs) {
        console.log("✅ Deep subgraph traversal reached 'public.task_logs'");
    } else {
        console.error("❌ Deep subgraph failed to reach leaf node.");
    }

    // Scenario B: Graph Bridging via View
    // 'analytics.v_high_value_users' connects 'auth.users' and 'ecom.orders'.
    // If we focus 'auth.users' inbound/outbound, do we see the view?
    // Note: View depends on users. So Users -> View is Inbound relative to Users (View sources Users).
    // Or Source -> Target?
    // View Source Rel: View -> Table.
    // So Table is Target.
    // So Users is target of View.
    // So View is INBOUND to Users.

    const viewSubgraph = extractSubgraph(graph, ['auth.users'], {
        direction: 'inbound',
        maxDepth: 1,
    });

    const hasView = viewSubgraph.nodes.some(n => n.id === 'analytics.v_high_value_users');
    if (hasView) {
        console.log("✅ View correctly found in Inbound connections of 'auth.users'");
    } else {
        console.error("❌ View 'analytics.v_high_value_users' NOT found connected to 'auth.users'");
    }

    // Test View Filter (now handled by projection layer, not extraction)
    // Views are always traversed; filtering is done by applyProjection
    console.log("✅ View filter test skipped (moved to projection layer).");

    // 5. Test Trigger Extraction
    console.log("\n⚡ Testing Trigger Dependencies...");
    // Trigger on ecom.orders inserts into analytics.events.
    // Expected Connection: ecom.orders -> analytics.events
    // Relation Type: TRIGGER_TARGET

    // Check adjacency
    const orderNode = getNode(graph, 'ecom.orders');
    const triggerEdge = orderNode?.outbound.find(r => r.type === 'TRIGGER_TARGET');

    if (triggerEdge && triggerEdge.target.table === 'events' && triggerEdge.target.schema === 'analytics') {
        console.log("✅ Trigger dependency correctly identified: ecom.orders -> analytics.events");
    } else {
        console.error("❌ Trigger dependency missing or incorrect.", triggerEdge);
    }

    console.log("\n🏁 Test Complete.");
}

runTest().catch(e => {
    console.error("Test Failed:", e);
});
