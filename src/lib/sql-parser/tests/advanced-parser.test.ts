/**
 * Advanced PostgreSQL Parser Test Suite
 * Version: 2.0 | Difficulty: EXPERT
 */

import { parsePostgresSQL } from '../index';

const ADVANCED_SCHEMA = `
-- ============================================================================
-- ADVANCED POSTGRESQL PARSER TEST SUITE
-- Version: 2.0 | Difficulty: EXPERT
-- ============================================================================

-- ============================================================================
-- TEST 1: COMPLEX SCHEMA NAMESPACING & CROSS-SCHEMA REFERENCES
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS accounting CASCADE;
CREATE SCHEMA IF NOT EXISTS billing CASCADE;
CREATE SCHEMA IF NOT EXISTS inventory CASCADE;
CREATE SCHEMA IF NOT EXISTS public CASCADE;

CREATE TABLE accounting.chart_of_accounts (
    account_id SERIAL PRIMARY KEY,
    account_code VARCHAR(20) NOT NULL UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_account_id INTEGER REFERENCES accounting.chart_of_accounts(account_id) ON DELETE SET NULL
);

CREATE TABLE billing.invoices (
    invoice_id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    billing_account_id INTEGER NOT NULL REFERENCES accounting.chart_of_accounts(account_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory.stock_ledger (
    ledger_id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES billing.invoices(invoice_id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounting.chart_of_accounts(account_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 2: ADVANCED PARTITIONING
-- ============================================================================

CREATE TABLE sales.transactions (
    transaction_id BIGSERIAL,
    transaction_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    customer_id UUID NOT NULL,
    PRIMARY KEY (transaction_id, transaction_date)
) PARTITION BY RANGE (transaction_date);

CREATE TABLE sales.transactions_2024_q1 PARTITION OF sales.transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE sales.transactions_2024_q2 PARTITION OF sales.transactions
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE support.tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY LIST (status);

CREATE TABLE support.tickets_open PARTITION OF support.tickets
    FOR VALUES IN ('open', 'in_progress', 'pending_review');

CREATE TABLE support.tickets_closed PARTITION OF support.tickets
    FOR VALUES IN ('closed', 'resolved', 'reopened');

CREATE TABLE analytics.events (
    event_id BIGSERIAL,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE analytics.events_0 PARTITION OF analytics.events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE analytics.events_1 PARTITION OF analytics.events FOR VALUES WITH (MODULUS 4, REMAINDER 1);

-- ============================================================================
-- TEST 3: GENERATED COLUMNS
-- ============================================================================

CREATE TABLE commerce.product_pricing (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price > 0),
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    final_price NUMERIC(12, 2) GENERATED ALWAYS AS (
        base_price * (1 + tax_rate) * (1 - discount_percent / 100)
    ) STORED,
    price_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

CREATE TABLE finance.ledger_entries (
    entry_id BIGSERIAL PRIMARY KEY,
    debit_amount NUMERIC(15, 2) DEFAULT 0,
    credit_amount NUMERIC(15, 2) DEFAULT 0,
    net_amount NUMERIC(15, 2) GENERATED ALWAYS AS (debit_amount - credit_amount) STORED,
    entry_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ecommerce.orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_amount NUMERIC(15, 2) NOT NULL,
    shipping_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) GENERATED ALWAYS AS (
        subtotal + tax_amount + shipping_cost - discount_amount
    ) STORED,
    order_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 4: ROW-LEVEL SECURITY
-- ============================================================================

CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON auth.users
    FOR ALL
    USING (auth.uid() = id);

CREATE POLICY users_admin_access ON auth.users
    FOR SELECT
    USING (
        auth.uid() = id 
        OR CURRENT_USER_ID()::TEXT = 'admin'
        OR (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY users_update_own ON auth.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role != 'admin');

CREATE POLICY users_org_isolation ON auth.users
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM auth.user_organizations 
            WHERE user_id = auth.uid()
        )
    );

CREATE TABLE auth.user_organizations (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, organization_id)
);

-- ============================================================================
-- TEST 5: COMPLEX FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.create_user_account(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_role VARCHAR(50) DEFAULT 'user'
)
RETURNS TABLE (user_id UUID, created BOOLEAN) AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT NULL::UUID, FALSE;
        RETURN;
    END IF;
    
    INSERT INTO auth.users (email, role, created_at)
    VALUES (p_email, p_role, NOW())
    RETURNING id INTO v_user_id;
    
    RETURN QUERY SELECT v_user_id, TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION auth.hash_password(p_password TEXT)
RETURNS VARCHAR(255) AS $HASH$
DECLARE
    v_hash VARCHAR(255);
BEGIN
    v_hash := crypt(p_password, gen_salt('bf', 10));
    RETURN v_hash;
END;
$HASH$ LANGUAGE plpgsql IMMUTABLE;

CREATE TYPE auth.user_profile AS (
    user_id UUID,
    email VARCHAR(255),
    role VARCHAR(50),
    created_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION auth.get_user_profile(p_user_id UUID)
RETURNS auth.user_profile AS $$
    SELECT id, email, role, created_at
    FROM auth.users
    WHERE id = p_user_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.authenticate_user(
    p_email VARCHAR(255),
    p_password TEXT,
    OUT user_id UUID,
    OUT authenticated BOOLEAN,
    OUT error_message TEXT
) AS $$
BEGIN
    SELECT id INTO user_id FROM auth.users WHERE email = p_email;
    
    IF user_id IS NULL THEN
        authenticated := FALSE;
        error_message := 'User not found';
        RETURN;
    END IF;
    
    authenticated := TRUE;
    error_message := NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEST 6: TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION auth.update_user_timestamp();

CREATE OR REPLACE FUNCTION audit.log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.user_audit_log (user_id, action, old_values, new_values, changed_at)
    VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        ROW_TO_JSON(OLD),
        ROW_TO_JSON(NEW),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION audit.log_user_changes();

CREATE SCHEMA audit;
CREATE TABLE audit.user_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(10),
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 7: VIEWS & MATERIALIZED VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW billing.invoice_summary AS
SELECT 
    i.invoice_id,
    i.invoice_number,
    COUNT(il.line_item_id)::INTEGER AS line_item_count,
    SUM(il.quantity)::INTEGER AS total_quantity,
    SUM(il.unit_price * il.quantity)::NUMERIC(15, 2) AS total_amount,
    MAX(il.created_at)::TIMESTAMPTZ AS last_updated
FROM billing.invoices i
LEFT JOIN billing.invoice_line_items il ON i.invoice_id = il.invoice_id
WHERE i.deleted_at IS NULL
GROUP BY i.invoice_id, i.invoice_number
ORDER BY i.created_at DESC;

CREATE TABLE billing.invoice_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id BIGINT NOT NULL REFERENCES billing.invoices(invoice_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE MATERIALIZED VIEW analytics.daily_sales_summary AS
SELECT 
    DATE(s.transaction_date)::DATE AS sales_date,
    COUNT(DISTINCT s.customer_id)::BIGINT AS unique_customers,
    COUNT(*)::BIGINT AS transaction_count,
    SUM(s.amount)::NUMERIC(15, 2) AS total_sales,
    AVG(s.amount)::NUMERIC(15, 2) AS avg_transaction,
    MIN(s.amount)::NUMERIC(15, 2) AS min_transaction,
    MAX(s.amount)::NUMERIC(15, 2) AS max_transaction
FROM sales.transactions s
WHERE s.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(s.transaction_date)
WITH DATA;

CREATE UNIQUE INDEX idx_daily_sales_summary ON analytics.daily_sales_summary(sales_date);

-- ============================================================================
-- TEST 8: COMPOSITE TYPES & DOMAINS
-- ============================================================================

CREATE TYPE address AS (
    street_line_1 VARCHAR(255),
    street_line_2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(2),
    is_primary BOOLEAN
);

CREATE TYPE geo_location AS (
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    elevation_meters NUMERIC(8, 2),
    last_updated TIMESTAMPTZ
);

CREATE DOMAIN valid_email AS VARCHAR(255)
    CHECK (VALUE ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$');

CREATE DOMAIN positive_numeric AS NUMERIC(15, 2)
    CHECK (VALUE > 0);

CREATE SCHEMA contacts;

CREATE TABLE contacts.addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    address_data address NOT NULL,
    location geo_location,
    email_address valid_email NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 9: INDEXES
-- ============================================================================

CREATE SCHEMA products;

CREATE TABLE products.inventory (
    product_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    last_counted TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (product_id, warehouse_id),
    
    CONSTRAINT fk_product FOREIGN KEY (product_id) 
        REFERENCES commerce.product_pricing(product_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_quantities CHECK (
        quantity_on_hand >= 0 
        AND quantity_reserved >= 0 
        AND quantity_on_hand >= quantity_reserved
    ),
    
    CONSTRAINT valid_reorder CHECK (reorder_level >= 0)
);

CREATE INDEX idx_inventory_product ON products.inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON products.inventory(warehouse_id);
CREATE INDEX idx_inventory_available ON products.inventory(quantity_available) WHERE quantity_available < reorder_level;
CREATE INDEX idx_inventory_composite ON products.inventory(warehouse_id, product_id) WHERE quantity_available > 0;

CREATE SCHEMA documents;

CREATE TABLE documents.metadata (
    document_id UUID PRIMARY KEY,
    metadata_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metadata_gin ON documents.metadata USING GIN(metadata_json);
CREATE INDEX idx_metadata_jsonb_path ON documents.metadata USING GIN(metadata_json jsonb_path_ops);

CREATE TABLE documents.articles (
    article_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', content), 'B')
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_search ON documents.articles USING GIN(search_vector);

-- ============================================================================
-- TEST 10: ENUM TYPES
-- ============================================================================

CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'paypal', 'crypto');
CREATE TYPE shipping_method AS ENUM ('standard', 'express', 'overnight', 'international');

CREATE TABLE ecommerce.purchases (
    purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_status order_status NOT NULL DEFAULT 'pending',
    payment_method payment_method NOT NULL,
    shipping_method shipping_method NOT NULL DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (order_status != 'cancelled' OR payment_method != 'crypto')
);

-- ============================================================================
-- TEST 11: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA search;

CREATE OR REPLACE FUNCTION search.fuzzy_match_users(search_term VARCHAR)
RETURNS TABLE (user_id UUID, email VARCHAR(255), similarity NUMERIC) AS $$
    SELECT 
        u.id,
        u.email,
        similarity(search_term, u.email)::NUMERIC(3, 2)
    FROM auth.users u
    WHERE search_term % u.email
    ORDER BY similarity DESC
    LIMIT 10;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- TEST 12: SEQUENCES
-- ============================================================================

CREATE SEQUENCE public.global_id_sequence
    START WITH 1000000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 100;

CREATE SCHEMA ticketing;

CREATE TABLE ticketing.tickets (
    ticket_id BIGINT PRIMARY KEY DEFAULT nextval('public.global_id_sequence'),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticketing.ticket_comments (
    comment_id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES ticketing.tickets(ticket_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 13: ALTER TABLE
-- ============================================================================

ALTER TABLE auth.users 
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
    ADD CONSTRAINT uc_email_org UNIQUE (email, organization_id);

-- ============================================================================
-- TEST 14: INHERITED TABLES
-- ============================================================================

CREATE SCHEMA events;

CREATE TABLE events.event_log (
    event_id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events.user_events (
    user_id UUID NOT NULL
) INHERITS (events.event_log);

CREATE TABLE events.system_events (
    component VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL
) INHERITS (events.event_log);

-- ============================================================================
-- TEST 15: PARTITIONED ARCHIVE
-- ============================================================================

CREATE SCHEMA archived;

CREATE TABLE archived.archived_orders (
    order_id UUID PRIMARY KEY,
    archived_date DATE NOT NULL,
    archived_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_archived_date CHECK (archived_date <= CURRENT_DATE)
) PARTITION BY RANGE (archived_date);

CREATE TABLE archived.archived_orders_2023 PARTITION OF archived.archived_orders
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE INDEX idx_active_orders ON ecommerce.purchases(created_at DESC) 
WHERE order_status != 'delivered' AND order_status != 'cancelled';

-- ============================================================================
-- TEST 16: SELF-REFERENCING
-- ============================================================================

CREATE SCHEMA org;

CREATE TABLE org.departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(255) NOT NULL,
    parent_department_id UUID REFERENCES org.departments(department_id) ON DELETE SET NULL,
    budget NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 17: RANGE TYPES
-- ============================================================================

CREATE SCHEMA calendar;

CREATE TABLE calendar.availability (
    availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    available_period INT4RANGE NOT NULL,
    room_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEST 18: JSONB WITH CONSTRAINTS
-- ============================================================================

CREATE SCHEMA settings;

CREATE TABLE settings.user_preferences (
    user_id UUID PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{
        "theme": "dark",
        "notifications": true,
        "language": "en"
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_preferences CHECK (
        preferences ? 'theme' 
        AND preferences ? 'notifications'
    )
);

CREATE INDEX idx_preferences_theme ON settings.user_preferences 
USING GIN((preferences->'theme'));
`;

// Expected counts for EXPERT test
const EXPECTED = {
    schemas: 15,     // accounting, billing, inventory, auth, audit, analytics, commerce, etc.
    tables: 35,      // Approximate - includes partitions, inherited tables
    views: 2,        // 1 regular + 1 materialized
    indexes: 10,     // Various index types
    functions: 8,    // Including trigger functions
    triggers: 2,
    policies: 4,
    enums: 3,        // order_status, payment_method, shipping_method
    compositeTypes: 3, // address, geo_location, auth.user_profile
    domains: 2,      // valid_email, positive_numeric
    sequences: 1,
    extensions: 3,
    relationships: 20, // Foreign keys including cross-schema
};

function runAdvancedTest() {
    console.log('='.repeat(70));
    console.log('ADVANCED POSTGRESQL PARSER TEST SUITE');
    console.log('Version: 2.0 | Difficulty: EXPERT');
    console.log('='.repeat(70));
    console.log();

    const startTime = Date.now();
    const result = parsePostgresSQL(ADVANCED_SCHEMA);
    const parseTime = Date.now() - startTime;

    console.log(`Parse completed in ${parseTime}ms`);
    console.log();

    // Results table
    console.log('PARSING RESULTS');
    console.log('-'.repeat(70));
    console.log();
    console.log('| Component         | Expected | Actual | Status |');
    console.log('|-------------------|----------|--------|--------|');

    const checks: { name: string; actual: number; expected: number; passed: boolean }[] = [];

    // Extensions
    checks.push({ name: 'Extensions', actual: result.extensions.length, expected: EXPECTED.extensions, passed: result.extensions.length >= EXPECTED.extensions });

    // Schemas
    checks.push({ name: 'Schemas', actual: result.schemas.length, expected: EXPECTED.schemas, passed: result.schemas.length >= EXPECTED.schemas * 0.7 });

    // Tables (including partitions)
    checks.push({ name: 'Tables', actual: result.tables.length, expected: EXPECTED.tables, passed: result.tables.length >= EXPECTED.tables * 0.7 });

    // Views
    checks.push({ name: 'Views', actual: result.views.length, expected: EXPECTED.views, passed: result.views.length >= EXPECTED.views });

    // Indexes
    checks.push({ name: 'Indexes', actual: result.indexes.length, expected: EXPECTED.indexes, passed: result.indexes.length >= EXPECTED.indexes });

    // Functions
    checks.push({ name: 'Functions', actual: result.functions.length, expected: EXPECTED.functions, passed: result.functions.length >= EXPECTED.functions * 0.7 });

    // Triggers
    checks.push({ name: 'Triggers', actual: result.triggers.length, expected: EXPECTED.triggers, passed: result.triggers.length >= EXPECTED.triggers });

    // Policies
    checks.push({ name: 'RLS Policies', actual: result.policies.length, expected: EXPECTED.policies, passed: result.policies.length >= EXPECTED.policies });

    // Enums
    checks.push({ name: 'Enum Types', actual: result.enumTypes.length, expected: EXPECTED.enums, passed: result.enumTypes.length >= EXPECTED.enums });

    // Composite Types
    checks.push({ name: 'Composite Types', actual: result.compositeTypes.length, expected: EXPECTED.compositeTypes, passed: result.compositeTypes.length >= 1 });

    // Domains
    checks.push({ name: 'Domains', actual: result.domains.length, expected: EXPECTED.domains, passed: result.domains.length >= EXPECTED.domains });

    // Sequences
    checks.push({ name: 'Sequences', actual: result.sequences.length, expected: EXPECTED.sequences, passed: result.sequences.length >= EXPECTED.sequences });

    // Relationships
    checks.push({ name: 'Relationships', actual: result.relationships.length, expected: EXPECTED.relationships, passed: result.relationships.length >= EXPECTED.relationships * 0.5 });

    let passedCount = 0;
    for (const check of checks) {
        const status = check.passed ? 'PASS' : 'FAIL';
        if (check.passed) passedCount++;
        console.log(`| ${check.name.padEnd(17)} | ${String(check.expected).padStart(8)} | ${String(check.actual).padStart(6)} | ${status.padStart(6)} |`);
    }

    console.log();
    console.log(`Overall: ${passedCount}/${checks.length} checks passed`);
    console.log();

    // Tables by schema
    console.log('TABLES BY SCHEMA');
    console.log('-'.repeat(70));

    const tablesBySchema = new Map<string, typeof result.tables>();
    for (const table of result.tables) {
        const schema = table.schema || 'public';
        if (!tablesBySchema.has(schema)) {
            tablesBySchema.set(schema, []);
        }
        tablesBySchema.get(schema)!.push(table);
    }

    for (const [schema, tables] of Array.from(tablesBySchema.entries()).sort()) {
        console.log(`  ${schema}: ${tables.map(t => t.name.split('.').pop()).join(', ')}`);
    }

    // Relationships
    console.log();
    console.log('FOREIGN KEY RELATIONSHIPS');
    console.log('-'.repeat(70));
    const fkRels = result.relationships.filter(r => r.type === 'FOREIGN_KEY');
    for (const rel of fkRels.slice(0, 15)) {
        const src = `${rel.source.table}.${rel.source.column}`;
        const tgt = `${rel.target.table}.${rel.target.column}`;
        console.log(`  ${src} -> ${tgt}`);
    }
    if (fkRels.length > 15) {
        console.log(`  ... and ${fkRels.length - 15} more FK relationships`);
    }

    // Partition relationships
    const partitionRels = result.relationships.filter(r => r.type === 'PARTITION_CHILD');
    if (partitionRels.length > 0) {
        console.log();
        console.log('PARTITION RELATIONSHIPS');
        console.log('-'.repeat(70));
        for (const rel of partitionRels) {
            console.log(`  ${rel.source.table} PARTITION OF ${rel.target.table}`);
        }
    }

    // Enums
    console.log();
    console.log('ENUM TYPES');
    console.log('-'.repeat(70));
    for (const e of result.enumTypes) {
        console.log(`  ${e.name}: ${e.values.slice(0, 4).join(', ')}${e.values.length > 4 ? '...' : ''}`);
    }

    // Functions
    console.log();
    console.log('FUNCTIONS');
    console.log('-'.repeat(70));
    for (const f of result.functions) {
        console.log(`  ${f.name}() [${f.language}]`);
    }

    // Views
    console.log();
    console.log('VIEWS');
    console.log('-'.repeat(70));
    for (const v of result.views) {
        const type = v.isMaterialized ? 'MATERIALIZED' : 'VIEW';
        console.log(`  ${v.name} [${type}]`);
    }

    // Policies
    console.log();
    console.log('RLS POLICIES');
    console.log('-'.repeat(70));
    for (const p of result.policies) {
        console.log(`  ${p.name} on ${p.table} (${p.command})`);
    }

    // Triggers
    console.log();
    console.log('TRIGGERS');
    console.log('-'.repeat(70));
    for (const t of result.triggers) {
        console.log(`  ${t.name} on ${t.table} [${t.timing} ${t.events.join('/')}]`);
    }

    // Domains
    console.log();
    console.log('DOMAINS');
    console.log('-'.repeat(70));
    for (const d of result.domains) {
        console.log(`  ${d.name}: ${d.baseType}`);
    }

    // Composite Types
    console.log();
    console.log('COMPOSITE TYPES');
    console.log('-'.repeat(70));
    for (const ct of result.compositeTypes) {
        console.log(`  ${ct.name}: ${ct.attributes.length} attributes`);
    }

    // Errors
    if (result.errors.length > 0) {
        console.log();
        console.log('PARSING ERRORS');
        console.log('-'.repeat(70));
        for (const err of result.errors.slice(0, 5)) {
            console.log(`  [${err.code}] ${err.message.slice(0, 60)}...`);
        }
        if (result.errors.length > 5) {
            console.log(`  ... and ${result.errors.length - 5} more errors`);
        }
    }

    // Summary
    console.log();
    console.log('='.repeat(70));
    console.log(`Parse Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Parse Time: ${parseTime}ms`);
    console.log(`Test Result: ${passedCount >= checks.length * 0.7 ? 'PASSED' : 'FAILED'}`);
    console.log('='.repeat(70));

    return {
        passed: passedCount,
        total: checks.length,
        confidence: result.confidence,
        success: passedCount >= checks.length * 0.7
    };
}

// Run the test
const testResult = runAdvancedTest();
