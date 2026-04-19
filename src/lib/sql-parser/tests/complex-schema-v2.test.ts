/**
 * Complex PostgreSQL Schema Test v2
 * Testing: Advanced DDL parsing, Storage, Partitioning, and Edge Cases
 */

import { parsePostgresSQL, ParsedSchema } from '../index';

const COMPLEX_SCHEMA = `
-- ============================================================================
-- COMPLEX POSTGRESQL SCHEMA TEST CASE v1.0
-- Testing: Advanced DDL parsing, Storage, Partitioning, and Edge Cases
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "json1";
CREATE EXTENSION IF NOT EXISTS "hstore";

-- ============================================================================
-- CUSTOM TYPES & ENUMS
-- ============================================================================
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'cancelled');
CREATE TYPE order_status AS ENUM ('created', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user', 'guest', 'suspended');
CREATE TYPE content_type AS ENUM ('blog', 'video', 'podcast', 'article', 'tutorial');
CREATE TYPE geo_point AS (latitude NUMERIC(9,6), longitude NUMERIC(9,6));

-- ============================================================================
-- SCHEMAS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS messaging;

-- ============================================================================
-- AUTH SCHEMA TABLES
-- ============================================================================
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt BYTEA NOT NULL,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),
    profile_data JSONB DEFAULT '{}',
    preferences HSTORE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSON
);

CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_session CHECK (expires_at > created_at)
);

CREATE TABLE auth.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

-- ============================================================================
-- COMMERCE SCHEMA TABLES
-- ============================================================================
CREATE TABLE commerce.categories (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES commerce.categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    seo_title VARCHAR(60),
    seo_description VARCHAR(160),
    seo_keywords VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE commerce.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES commerce.categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    long_description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    cost NUMERIC(12, 2) CHECK (cost >= 0),
    discount_price NUMERIC(12, 2),
    weight NUMERIC(8, 3),
    dimensions_cm JSONB,
    is_physical BOOLEAN DEFAULT true,
    requires_shipping BOOLEAN DEFAULT true,
    tax_class VARCHAR(50),
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    image_urls TEXT[],
    attributes JSONB DEFAULT '{}',
    seo_title VARCHAR(60),
    seo_description VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_pricing CHECK (discount_price IS NULL OR discount_price < price)
);

CREATE TABLE commerce.orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status order_status DEFAULT 'created',
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    shipping_cost NUMERIC(12, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    notes TEXT,
    tracking_number VARCHAR(100),
    payment_method VARCHAR(50),
    fulfillment_date TIMESTAMP WITH TIME ZONE,
    delivery_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_amounts CHECK (subtotal >= 0 AND tax_amount >= 0 AND total_amount > 0)
) PARTITION BY RANGE (DATE_TRUNC('month', created_at));

CREATE TABLE commerce.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES commerce.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES commerce.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    line_total NUMERIC(12, 2) NOT NULL,
    selected_attributes JSONB,
    CONSTRAINT valid_line_total CHECK (line_total > 0)
);

CREATE TABLE commerce.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id BIGINT NOT NULL REFERENCES commerce.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    refund_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS SCHEMA TABLES
-- ============================================================================
CREATE TABLE analytics.events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    properties JSONB DEFAULT '{}',
    location geo_point,
    ip_address INET,
    user_agent TEXT,
    referrer VARCHAR(500),
    event_date DATE GENERATED ALWAYS AS (CURRENT_DATE) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (event_date);

CREATE TABLE analytics.page_views (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID NOT NULL,
    page_path VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    referrer VARCHAR(500),
    duration_seconds INTEGER,
    scroll_depth_percent NUMERIC(5, 2),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_duration CHECK (duration_seconds >= 0)
);

-- ============================================================================
-- MESSAGING SCHEMA TABLES
-- ============================================================================
CREATE TABLE messaging.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_type VARCHAR(20) NOT NULL,
    subject VARCHAR(255),
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE messaging.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_muted BOOLEAN DEFAULT false,
    UNIQUE (conversation_id, user_id)
);

CREATE TABLE messaging.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    attachments JSONB DEFAULT '[]',
    metadata JSONB,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (CHAR_LENGTH(content) > 0 OR JSONB_ARRAY_LENGTH(attachments) > 0)
);

CREATE TABLE messaging.message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messaging.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (message_id, user_id, reaction_type)
);

-- ============================================================================
-- INDEXES - PERFORMANCE OPTIMIZATION
-- ============================================================================
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_username ON auth.users(username);
CREATE INDEX idx_users_role ON auth.users(role);
CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_token ON auth.sessions(token_hash);
CREATE INDEX idx_audit_logs_user_id ON auth.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON auth.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON auth.audit_logs(resource_type, resource_id);

CREATE INDEX idx_products_category ON commerce.products(category_id);
CREATE INDEX idx_products_sku ON commerce.products(sku);
CREATE INDEX idx_products_slug ON commerce.products(slug);
CREATE INDEX idx_products_status ON commerce.products(status);
CREATE INDEX idx_products_stock ON commerce.products(stock_quantity) WHERE stock_quantity < low_stock_threshold;

CREATE INDEX idx_orders_user_id ON commerce.orders(user_id);
CREATE INDEX idx_orders_status ON commerce.orders(status);
CREATE INDEX idx_orders_created_at ON commerce.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON commerce.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON commerce.order_items(product_id);
CREATE INDEX idx_payments_order_id ON commerce.payments(order_id);
CREATE INDEX idx_payments_user_id ON commerce.payments(user_id);
CREATE INDEX idx_payments_status ON commerce.payments(status);

CREATE INDEX idx_events_user_id ON analytics.events(user_id);
CREATE INDEX idx_events_type ON analytics.events(event_type);
CREATE INDEX idx_events_created_at ON analytics.events(created_at DESC);
CREATE INDEX idx_page_views_session_id ON analytics.page_views(session_id);
CREATE INDEX idx_page_views_user_id ON analytics.page_views(user_id);

CREATE INDEX idx_conversations_type ON messaging.conversations(conversation_type);
CREATE INDEX idx_conversations_updated_at ON messaging.conversations(updated_at DESC);
CREATE INDEX idx_participants_user_id ON messaging.conversation_participants(user_id);
CREATE INDEX idx_messages_conversation_id ON messaging.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messaging.messages(sender_id);
CREATE INDEX idx_message_reactions_message_id ON messaging.message_reactions(message_id);

-- ============================================================================
-- VIEWS - BUSINESS LOGIC
-- ============================================================================
CREATE OR REPLACE VIEW auth.active_users AS
SELECT 
    id, 
    username, 
    email, 
    role, 
    last_login,
    created_at
FROM auth.users
WHERE is_active = true AND deleted_at IS NULL;

CREATE OR REPLACE VIEW commerce.product_inventory_status AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.stock_quantity,
    p.low_stock_threshold,
    CASE 
        WHEN p.stock_quantity = 0 THEN 'out_of_stock'
        WHEN p.stock_quantity < p.low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
    END AS status
FROM commerce.products p
WHERE p.deleted_at IS NULL;

CREATE MATERIALIZED VIEW commerce.order_revenue_summary AS
SELECT 
    DATE_TRUNC('day', o.created_at)::DATE AS order_date,
    COUNT(*) AS total_orders,
    SUM(o.total_amount) AS revenue,
    AVG(o.total_amount) AS avg_order_value,
    COUNT(DISTINCT o.user_id) AS unique_customers
FROM commerce.orders o
WHERE o.status != 'cancelled'
GROUP BY DATE_TRUNC('day', o.created_at)::DATE;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commerce.update_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commerce.calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_amount = NEW.subtotal + NEW.tax_amount + NEW.shipping_cost - NEW.discount_amount;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION messaging.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE messaging.conversations 
    SET updated_at = NOW(), last_message_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER trig_users_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.update_user_updated_at();

CREATE TRIGGER trig_products_updated_at
BEFORE UPDATE ON commerce.products
FOR EACH ROW
EXECUTE FUNCTION commerce.update_product_updated_at();

CREATE TRIGGER trig_orders_calculate_total
BEFORE INSERT OR UPDATE ON commerce.orders
FOR EACH ROW
EXECUTE FUNCTION commerce.calculate_order_total();

CREATE TRIGGER trig_messages_update_conversation
AFTER INSERT ON messaging.messages
FOR EACH ROW
EXECUTE FUNCTION messaging.update_conversation_timestamp();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON auth.users
    FOR SELECT
    USING (
        id = CURRENT_SETTING('app.current_user_id')::UUID 
        OR CURRENT_SETTING('app.user_role', true) = 'admin'
    );

CREATE POLICY users_self_update ON auth.users
    FOR UPDATE
    USING (
        id = CURRENT_SETTING('app.current_user_id')::UUID
        OR CURRENT_SETTING('app.user_role', true) = 'admin'
    );

-- ============================================================================
-- PARTITIONS (Time-based)
-- ============================================================================
CREATE TABLE commerce.orders_2024_01 PARTITION OF commerce.orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE commerce.orders_2024_02 PARTITION OF commerce.orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================
COMMENT ON SCHEMA auth IS 'Authentication and authorization related tables';
COMMENT ON SCHEMA commerce IS 'E-commerce, orders, and product management';
COMMENT ON SCHEMA analytics IS 'Analytics and event tracking tables';
COMMENT ON SCHEMA messaging IS 'User messaging and conversation tables';

COMMENT ON TABLE auth.users IS 'Core user accounts with authentication details';
COMMENT ON COLUMN auth.users.password_hash IS 'Bcrypt hashed password - never store plaintext';
COMMENT ON COLUMN auth.users.profile_data IS 'User profile metadata stored as JSONB';

COMMENT ON TABLE commerce.products IS 'Product catalog with inventory and pricing';
COMMENT ON TABLE commerce.orders IS 'Customer orders with partitioning by month';
COMMENT ON TABLE commerce.payments IS 'Payment transactions linked to orders';
`;

// Expected counts
const EXPECTED = {
    extensions: 4,
    schemas: 4,
    enums: 4,
    compositeTypes: 1,
    tables: 14, // 3 auth + 5 commerce + 2 analytics + 4 messaging
    views: 3,   // 2 regular + 1 materialized
    indexes: 31,
    functions: 4,
    triggers: 4,
    policies: 2,
    relationships: 15, // Approximate - FK relationships
};

function runTest() {
    console.log('='.repeat(70));
    console.log('COMPLEX POSTGRESQL SCHEMA PARSER TEST v2');
    console.log('='.repeat(70));
    console.log();

    const startTime = Date.now();
    const result = parsePostgresSQL(COMPLEX_SCHEMA);
    const parseTime = Date.now() - startTime;

    console.log(`Parse completed in ${parseTime}ms`);
    console.log();

    // Summary
    console.log('📊 PARSING RESULTS SUMMARY');
    console.log('-'.repeat(70));

    const checks: { name: string; actual: number; expected: number; passed: boolean }[] = [];

    // Check Extensions
    const extCount = result.extensions.length;
    checks.push({ name: 'Extensions', actual: extCount, expected: EXPECTED.extensions, passed: extCount >= EXPECTED.extensions });

    // Check Schemas
    const schemaCount = result.schemas.length;
    checks.push({ name: 'Schemas', actual: schemaCount, expected: EXPECTED.schemas, passed: schemaCount >= EXPECTED.schemas });

    // Check Enums
    const enumCount = result.enumTypes.length;
    checks.push({ name: 'Enum Types', actual: enumCount, expected: EXPECTED.enums, passed: enumCount >= EXPECTED.enums });

    // Check Composite Types
    const compCount = result.compositeTypes.length;
    checks.push({ name: 'Composite Types', actual: compCount, expected: EXPECTED.compositeTypes, passed: compCount >= EXPECTED.compositeTypes });

    // Check Tables
    const tableCount = result.tables.length;
    checks.push({ name: 'Tables', actual: tableCount, expected: EXPECTED.tables, passed: tableCount >= EXPECTED.tables * 0.8 }); // 80% threshold

    // Check Views
    const viewCount = result.views.length;
    checks.push({ name: 'Views', actual: viewCount, expected: EXPECTED.views, passed: viewCount >= EXPECTED.views });

    // Check Indexes
    const indexCount = result.indexes.length;
    checks.push({ name: 'Indexes', actual: indexCount, expected: EXPECTED.indexes, passed: indexCount >= EXPECTED.indexes * 0.8 });

    // Check Functions
    const funcCount = result.functions.length;
    checks.push({ name: 'Functions', actual: funcCount, expected: EXPECTED.functions, passed: funcCount >= EXPECTED.functions });

    // Check Triggers
    const triggerCount = result.triggers.length;
    checks.push({ name: 'Triggers', actual: triggerCount, expected: EXPECTED.triggers, passed: triggerCount >= EXPECTED.triggers });

    // Check Policies
    const policyCount = result.policies.length;
    checks.push({ name: 'RLS Policies', actual: policyCount, expected: EXPECTED.policies, passed: policyCount >= EXPECTED.policies });

    // Check Relationships
    const relCount = result.relationships.length;
    checks.push({ name: 'Relationships', actual: relCount, expected: EXPECTED.relationships, passed: relCount >= EXPECTED.relationships * 0.7 });

    // Print results table
    console.log();
    console.log('| Component         | Expected | Actual | Status |');
    console.log('|-------------------|----------|--------|--------|');

    let passedCount = 0;
    for (const check of checks) {
        const status = check.passed ? '✅ PASS' : '❌ FAIL';
        if (check.passed) passedCount++;
        console.log(`| ${check.name.padEnd(17)} | ${String(check.expected).padStart(8)} | ${String(check.actual).padStart(6)} | ${status} |`);
    }

    console.log();
    console.log(`Overall: ${passedCount}/${checks.length} checks passed`);
    console.log();

    // Detailed breakdown by schema
    console.log('📋 TABLES BY SCHEMA');
    console.log('-'.repeat(70));

    const tablesBySchema = new Map<string, typeof result.tables>();
    for (const table of result.tables) {
        const schema = table.schema || 'public';
        if (!tablesBySchema.has(schema)) {
            tablesBySchema.set(schema, []);
        }
        tablesBySchema.get(schema)!.push(table);
    }

    for (const [schema, tables] of tablesBySchema) {
        console.log(`\n  ${schema} (${tables.length} tables):`);
        for (const table of tables) {
            console.log(`    - ${table.name} (${table.columns.length} columns)`);
        }
    }

    // Views detail
    console.log('\n📋 VIEWS');
    console.log('-'.repeat(70));
    for (const view of result.views) {
        const type = view.isMaterialized ? 'MATERIALIZED' : 'VIEW';
        console.log(`  - ${view.name} [${type}]`);
    }

    // Relationships detail
    console.log('\n📋 RELATIONSHIPS');
    console.log('-'.repeat(70));
    for (const rel of result.relationships) {
        const srcTable = rel.source.table;
        const srcCol = rel.source.column || '*';
        const tgtTable = rel.target.table;
        const tgtCol = rel.target.column || '*';
        const action = rel.onDelete ? ` ON DELETE ${rel.onDelete.toUpperCase()}` : '';
        console.log(`  ${srcTable}.${srcCol} → ${tgtTable}.${tgtCol}${action}`);
    }

    // Enum types detail
    console.log('\n📋 ENUM TYPES');
    console.log('-'.repeat(70));
    for (const enumType of result.enumTypes) {
        console.log(`  - ${enumType.name}: ${enumType.values.slice(0, 3).join(', ')}${enumType.values.length > 3 ? '...' : ''}`);
    }

    // Triggers detail
    console.log('\n📋 TRIGGERS');
    console.log('-'.repeat(70));
    for (const trigger of result.triggers) {
        console.log(`  - ${trigger.name} on ${trigger.table} (${trigger.timing} ${trigger.events.join('/')})`);
    }

    // Policies detail
    console.log('\n📋 RLS POLICIES');
    console.log('-'.repeat(70));
    for (const policy of result.policies) {
        console.log(`  - ${policy.name} on ${policy.table} (${policy.command})`);
    }

    // Errors and warnings
    if (result.errors.length > 0) {
        console.log('\n⚠️ PARSING ERRORS');
        console.log('-'.repeat(70));
        for (const err of result.errors.slice(0, 10)) {
            console.log(`  ${err.code}: ${err.message}`);
        }
        if (result.errors.length > 10) {
            console.log(`  ... and ${result.errors.length - 10} more errors`);
        }
    }

    if (result.warnings.length > 0) {
        console.log('\n⚠️ PARSING WARNINGS');
        console.log('-'.repeat(70));
        for (const warn of result.warnings.slice(0, 10)) {
            console.log(`  ${warn.code}: ${warn.message}`);
        }
        if (result.warnings.length > 10) {
            console.log(`  ... and ${result.warnings.length - 10} more warnings`);
        }
    }

    console.log();
    console.log('='.repeat(70));
    console.log(`Parse confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    return {
        passed: passedCount,
        total: checks.length,
        success: passedCount >= checks.length * 0.8,
    };
}

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';

describe('complex-schema-v2', () => {
    it('parses complex schema successfully', () => {
        const testResult = runTest();
        expect(testResult.success).toBe(true);
    });
});
