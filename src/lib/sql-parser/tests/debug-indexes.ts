import { parsePostgresSQL } from '../index';

const testIndexSQL = `
-- Standard index
CREATE INDEX idx_inventory_product ON products.inventory(product_id);

-- GIN index
CREATE INDEX idx_metadata_gin ON documents.metadata USING GIN(metadata_json);

-- GIN with jsonb_path_ops
CREATE INDEX idx_metadata_jsonb_path ON documents.metadata USING GIN(metadata_json jsonb_path_ops);

-- Full-text search index
CREATE INDEX idx_articles_search ON documents.articles USING GIN(search_vector);

-- Partial index
CREATE INDEX idx_inventory_available ON products.inventory(quantity_available) WHERE quantity_available < reorder_level;

-- Expression index
CREATE INDEX idx_preferences_theme ON settings.user_preferences USING GIN((preferences->'theme'));
`;

console.log('Testing Index Parsing...\n');

const result = parsePostgresSQL(testIndexSQL);

console.log('Indexes found:', result.indexes.length);
result.indexes.forEach(idx => {
    console.log(`  - ${idx.name} on ${idx.table} [${idx.type}]`);
    console.log(`    Columns: ${idx.columns.join(', ')}`);
});

console.log('\nErrors:', result.errors.length);
result.errors.forEach(e => console.log('  ', e.message.slice(0, 80)));
