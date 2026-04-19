/**
 * Debug Test 2 - Targeted tests for failing components
 */

import { parsePostgresSQL, ParsedSchema } from '../../sql-parser';

console.log('='.repeat(60));
console.log('DEBUG TEST 2 - TARGETED FAILURES');
console.log('='.repeat(60));

// Test VIEW parsing
const VIEW_SQL = `
CREATE OR REPLACE VIEW auth.active_users AS
SELECT id, username, email, role, last_login, created_at
FROM auth.users
WHERE is_active = true AND deleted_at IS NULL;

CREATE MATERIALIZED VIEW commerce.order_revenue_summary AS
SELECT 
    DATE_TRUNC('day', o.created_at)::DATE AS order_date,
    COUNT(*) AS total_orders,
    SUM(o.total_amount) AS revenue
FROM commerce.orders o
WHERE o.status != 'cancelled'
GROUP BY DATE_TRUNC('day', o.created_at)::DATE;
`;

console.log('\n1. VIEW TEST:');
const viewResult = parsePostgresSQL(VIEW_SQL);
console.log(`   Views found: ${viewResult.views.length}`);
for (const v of viewResult.views) {
    console.log(`   - ${v.name} (materialized: ${v.isMaterialized})`);
}
console.log(`   Warnings: ${viewResult.warnings.length}`);

// Test INDEX parsing
const INDEX_SQL = `
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_username ON auth.users(username);
CREATE UNIQUE INDEX idx_sessions_token ON auth.sessions(token_hash);
`;

console.log('\n2. INDEX TEST:');
const indexResult = parsePostgresSQL(INDEX_SQL);
console.log(`   Indexes found: ${indexResult.indexes.length}`);
for (const i of indexResult.indexes) {
    console.log(`   - ${i.name} on ${i.table}`);
}
console.log(`   Warnings: ${indexResult.warnings.length}`);

// Test TRIGGER parsing
const TRIGGER_SQL = `
CREATE TRIGGER trig_users_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.update_user_updated_at();

CREATE TRIGGER trig_orders_calculate_total
BEFORE INSERT OR UPDATE ON commerce.orders
FOR EACH ROW
EXECUTE FUNCTION commerce.calculate_order_total();
`;

console.log('\n3. TRIGGER TEST:');
const triggerResult = parsePostgresSQL(TRIGGER_SQL);
console.log(`   Triggers found: ${triggerResult.triggers.length}`);
for (const t of triggerResult.triggers) {
    console.log(`   - ${t.name} on ${t.table}`);
}
console.log(`   Warnings: ${triggerResult.warnings.length}`);

// Test ENUM parsing
const ENUM_SQL = `
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'cancelled');
CREATE TYPE order_status AS ENUM ('created', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user', 'guest', 'suspended');
CREATE TYPE content_type AS ENUM ('blog', 'video', 'podcast', 'article', 'tutorial');
`;

console.log('\n4. ENUM TEST:');
const enumResult = parsePostgresSQL(ENUM_SQL);
console.log(`   Enums found: ${enumResult.enums.size}`);
for (const [name, values] of enumResult.enums) {
    console.log(`   - ${name}: ${values.slice(0, 3).join(', ')}...`);
}
console.log(`   Warnings: ${enumResult.warnings.length}`);

console.log('\n' + '='.repeat(60));
