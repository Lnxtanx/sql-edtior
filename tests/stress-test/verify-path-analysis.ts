import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parsePostgresSQL } from '../../src/lib/sql-parser/index.ts';
import { buildSchemaGraph, getShortestPath, buildWeightedAdjacencyLists, extractSubgraph, calculateEdgeWeight } from '../../src/lib/schema-workspace/index.ts';
import { toNodeId } from '../../src/lib/schema-workspace/utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Schema
const sqlPath = path.join(__dirname, 'complex-schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');
const schema = parsePostgresSQL(sql);

console.log(`Parsed ${schema.tables.length} tables and ${schema.relationships.length} relationships.`);

// Build Graph
const graph = buildSchemaGraph(schema);
console.log(`Graph built with ${graph.nodes.size} nodes and ${graph.relationships.length} edges.`);

// 1. Verify View Dependency (user_order_stats -> orders)
// View "user_order_stats" selects from "orders".
// So there should be a dependency: user_order_stats -> orders.
// Direction: View DEPENDS ON Table.
// Path: user_order_stats -> orders
const viewNode = toNodeId('public', 'user_order_stats');
const orderNode = toNodeId('public', 'orders');

console.log(`\n--- Verifying View Dependency: ${viewNode} -> ${orderNode} ---`);

const adjacency = buildWeightedAdjacencyLists(graph.relationships);
const viewPath = getShortestPath(viewNode, orderNode, adjacency);

if (viewPath && viewPath.path.length > 0) {
    console.log('Path found:', viewPath.path.join(' -> '));
    const edge = viewPath.edges[0];
    console.log('Edge Type:', edge.type);
    if (edge.type === 'VIEW_DEPENDENCY') {
        console.log('✅ Correctly identified VIEW_DEPENDENCY');
    } else {
        console.error('❌ Expected VIEW_DEPENDENCY, got', edge.type);
    }
} else {
    console.error('❌ No path found from View to Table');
}

// 2. Verify Trigger Dependency (order_items -> products via update_stock)
// Trigger on "order_items" calls "update_stock" which updates "products".
// Dependency: order_items -> products (Trigger Target)
const itemNode = toNodeId('public', 'order_items');
const productNode = toNodeId('public', 'products');

console.log(`\n--- Verifying Trigger Dependency: ${itemNode} -> ${productNode} ---`);

const triggerPath = getShortestPath(itemNode, productNode, adjacency);

if (triggerPath && triggerPath.path.length > 0) {
    console.log('Path found:', triggerPath.path.join(' -> '));
    const edge = triggerPath.edges[0];
    console.log('Edge Type:', edge.type);
    if (edge.type === 'TRIGGER_TARGET') {
        console.log('✅ Correctly identified TRIGGER_TARGET');
    } else {
        console.error('❌ Expected TRIGGER_TARGET, got', edge.type);
    }
} else {
    console.error('❌ No path found from Trigger to Table');
}

// 3. Verify Depth Counts (Impact Analysis)
// Focus on "products". 
// Inbound dependencies: order_items (FK), orders (via order_items FK?).
// order_items -> products (FK)
// But also "trg_reduce_stock" makes order_items -> products (TRIGGER).
// Let's check outbound from products? Products -> nothing.
// Check Inbound to products.
console.log(`\n--- Verifying Depth Counts (Inbound to ${productNode}) ---`);

const subgraph = extractSubgraph(graph, [productNode], {
    maxDepth: 2,
    direction: 'inbound',
});

console.log('Subgraph nodes:', subgraph.tables.map(t => t.name).join(', '));
if (subgraph.stats.depthCounts) {
    console.log('Depth Counts:', Object.fromEntries(subgraph.stats.depthCounts));
    // Level 0: products (1)
    // Level 1: order_items (FK + Trigger)
    // Level 2: orders (FK to order_items? No, order_items -> orders via FK)
    // Wait, order_items has FK to orders. So order_items DEPENDS on orders.
    // So orders -> order_items (FK direction is usually PK->FK? No in graph: FK source -> target)
    // FK: order_items (source) -> orders (target).
    // So order_items depends on orders.
    // If we look inbound to products:
    // Who depends on products?
    // order_items has FK to products? Yes. order_items -> products.
    // So order_items is a PARENT/UPSTREAM of products?
    // Relationship: order_items -> products.
    // Inbound to products: incoming edges? 
    // Edges are directional: Source -> Target.
    // FK: order_items -> products. (order_items references products).
    // So edge is order_items -> products.
    // So order_items IS inbound to products.

    // Check Depth 1 count. Should include order_items.
    const depth1 = subgraph.stats.depthCounts.get(1);
    if (depth1 && depth1 > 0) {
        console.log('✅ Depth 1 has nodes');
    } else {
        console.error('❌ Depth 1 is empty');
    }
} else {
    console.error('❌ No depth counts returned');
}
