import { parsePostgresSQL } from '../index';

// Test all index types from the advanced schema
const testIndexSQL = `
-- Line 337
CREATE UNIQUE INDEX idx_daily_sales_summary ON analytics.daily_sales_summary(sales_date);

-- Line 408
CREATE INDEX idx_inventory_product ON products.inventory(product_id);

-- Line 409
CREATE INDEX idx_inventory_warehouse ON products.inventory(warehouse_id);

-- Line 410 - Partial index
CREATE INDEX idx_inventory_available ON products.inventory(quantity_available) WHERE quantity_available < reorder_level;

-- Line 411 - Composite partial index
CREATE INDEX idx_inventory_composite ON products.inventory(warehouse_id, product_id) WHERE quantity_available > 0;

-- Line 421 - GIN index
CREATE INDEX idx_metadata_gin ON documents.metadata USING GIN(metadata_json);

-- Line 422 - GIN with jsonb_path_ops
CREATE INDEX idx_metadata_jsonb_path ON documents.metadata USING GIN(metadata_json jsonb_path_ops);

-- Line 435 - GIN on tsvector
CREATE INDEX idx_articles_search ON documents.articles USING GIN(search_vector);

-- Line 550-551 - Multiline partial index with complex WHERE
CREATE INDEX idx_active_orders ON ecommerce.purchases(created_at DESC) 
WHERE order_status != 'delivered' AND order_status != 'cancelled';

-- Line 602-603 - GIN on JSONB expression
CREATE INDEX idx_preferences_theme ON settings.user_preferences 
USING GIN((preferences->'theme'));
`;

console.log('Testing All Advanced Index Types...\n');

const result = parsePostgresSQL(testIndexSQL);

console.log('Indexes found:', result.indexes.length);
result.indexes.forEach((idx, i) => {
    console.log(`  ${i + 1}. ${idx.name} on ${idx.table}`);
    console.log(`     Type: ${idx.type}, Unique: ${idx.isUnique}, Partial: ${idx.isPartial}`);
    console.log(`     Columns: ${idx.columns.join(', ')}`);
});

console.log('\nExpected: 10 indexes');
console.log('Actual:', result.indexes.length);
console.log('Status:', result.indexes.length === 10 ? 'PASS' : 'FAIL');

console.log('\nWarnings:', result.warnings.length);
result.warnings.forEach(w => console.log('  -', w.message.slice(0, 80)));
