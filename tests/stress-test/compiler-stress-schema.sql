-- =============================================================================
-- Schema Compiler Stress Test — Advanced PostgreSQL Schema
-- =============================================================================
-- Covers: multiple schemas, enums, domains, composite types, tables (normal,
-- partitioned, inherited, unlogged), columns (all types, identity, generated),
-- constraints (PK, FK, unique, check, exclusion), indexes (btree, gin, gist,
-- partial, expression), views (regular, materialized, recursive), functions,
-- triggers, RLS policies, sequences, extensions, and inter-object dependencies.
-- =============================================================================

-- ===================== EXTENSIONS =====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ===================== SCHEMAS =====================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS inventory;

-- ===================== ENUMS =====================
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'editor', 'viewer', 'guest');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'pending', 'archived');
CREATE TYPE billing.payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'paypal', 'crypto');
CREATE TYPE billing.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE inventory.item_condition AS ENUM ('new', 'refurbished', 'used', 'damaged');
-- Intentionally similar enum for duplicate detection
CREATE TYPE public.role_type AS ENUM ('admin', 'manager', 'editor', 'viewer');

-- ===================== DOMAINS =====================
CREATE DOMAIN public.email_address AS citext
    CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

CREATE DOMAIN public.positive_money AS numeric(15,2)
    CHECK (VALUE >= 0);

CREATE DOMAIN public.phone_number AS text
    CHECK (VALUE ~ '^\+?[1-9]\d{1,14}$');

CREATE DOMAIN public.percentage AS numeric(5,2)
    CHECK (VALUE >= 0 AND VALUE <= 100);

-- ===================== COMPOSITE TYPES =====================
CREATE TYPE public.address AS (
    street text,
    city text,
    state text,
    zip_code text,
    country text
);

CREATE TYPE public.audit_info AS (
    created_by uuid,
    updated_by uuid,
    created_at timestamptz,
    updated_at timestamptz
);

-- ===================== SEQUENCES =====================
CREATE SEQUENCE public.global_id_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE billing.invoice_number_seq AS integer START WITH 10001 INCREMENT BY 1;
-- Orphan sequence (not owned by any table)
CREATE SEQUENCE public.orphan_counter_seq START WITH 1;
-- Shared sequence (will be used by multiple tables)
CREATE SEQUENCE public.shared_ref_seq START WITH 1;
-- Cyclic small sequence (overflow risk)
CREATE SEQUENCE public.small_cyclic_seq AS smallint START WITH 1 CYCLE;

-- ===================== AUTH SCHEMA TABLES =====================

CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email public.email_address NOT NULL UNIQUE,
    password_hash text NOT NULL,
    phone public.phone_number,
    role public.user_role NOT NULL DEFAULT 'viewer',
    status public.account_status NOT NULL DEFAULT 'pending',
    display_name text NOT NULL,
    avatar_url text,
    metadata jsonb DEFAULT '{}',
    mfa_enabled boolean DEFAULT false,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT users_email_not_empty CHECK (length(email::text) > 0)
);

COMMENT ON TABLE auth.users IS 'Core user accounts with authentication data';
COMMENT ON COLUMN auth.users.password_hash IS 'bcrypt hashed password';
COMMENT ON COLUMN auth.users.metadata IS 'Flexible JSON metadata for user preferences';

CREATE TABLE auth.sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    ip_address inet,
    user_agent text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);

CREATE TABLE auth.api_keys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_prefix text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    name text NOT NULL,
    scopes text[] DEFAULT '{}',
    rate_limit integer DEFAULT 1000,
    last_used_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked boolean DEFAULT false
);

CREATE TABLE auth.permissions (
    id serial PRIMARY KEY,
    role public.user_role NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    conditions jsonb,
    UNIQUE (role, resource, action)
);

-- Self-referencing table (org hierarchy)
CREATE TABLE auth.organizations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    parent_org_id uuid REFERENCES auth.organizations(id) ON DELETE SET NULL,
    owner_id uuid NOT NULL REFERENCES auth.users(id),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth.org_members (
    org_id uuid NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'viewer',
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

-- ===================== BILLING SCHEMA TABLES =====================

CREATE TABLE billing.customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id text UNIQUE,
    tax_id text,
    billing_address public.address,
    default_payment_method billing.payment_method,
    currency char(3) DEFAULT 'USD',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing.plans (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    price public.positive_money NOT NULL,
    billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
    features jsonb NOT NULL DEFAULT '[]',
    max_seats integer,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing.subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id uuid NOT NULL REFERENCES billing.customers(id) ON DELETE CASCADE,
    plan_id integer NOT NULL REFERENCES billing.plans(id),
    status public.account_status NOT NULL DEFAULT 'active',
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    trial_end timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partitioned table (range by date)
CREATE TABLE billing.invoices (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    invoice_number integer NOT NULL DEFAULT nextval('billing.invoice_number_seq'),
    customer_id uuid NOT NULL REFERENCES billing.customers(id),
    subscription_id uuid REFERENCES billing.subscriptions(id),
    status billing.invoice_status NOT NULL DEFAULT 'draft',
    amount public.positive_money NOT NULL,
    tax_amount public.positive_money DEFAULT 0,
    currency char(3) DEFAULT 'USD',
    due_date date NOT NULL,
    paid_at timestamptz,
    line_items jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE billing.invoices_2024 PARTITION OF billing.invoices
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE billing.invoices_2025 PARTITION OF billing.invoices
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE billing.invoices_2026 PARTITION OF billing.invoices
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE billing.payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id uuid NOT NULL,
    invoice_created_at timestamptz NOT NULL,
    amount public.positive_money NOT NULL,
    method billing.payment_method NOT NULL,
    processor_txn_id text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (invoice_id, invoice_created_at) REFERENCES billing.invoices(id, created_at)
);

-- ===================== INVENTORY SCHEMA TABLES =====================

CREATE TABLE inventory.categories (
    id serial PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    parent_id integer REFERENCES inventory.categories(id) ON DELETE CASCADE,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory.products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    category_id integer REFERENCES inventory.categories(id) ON DELETE SET NULL,
    price public.positive_money NOT NULL,
    cost public.positive_money,
    weight_kg numeric(10,3),
    dimensions jsonb,
    tags text[] DEFAULT '{}',
    condition inventory.item_condition NOT NULL DEFAULT 'new',
    is_active boolean DEFAULT true,
    metadata hstore,
    search_vector tsvector,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory.warehouses (
    id serial PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    location public.address,
    capacity integer,
    is_active boolean DEFAULT true
);

CREATE TABLE inventory.stock_levels (
    product_id uuid NOT NULL REFERENCES inventory.products(id) ON DELETE CASCADE,
    warehouse_id integer NOT NULL REFERENCES inventory.warehouses(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    reorder_point integer DEFAULT 10,
    last_counted_at timestamptz,
    PRIMARY KEY (product_id, warehouse_id),
    CONSTRAINT stock_reserved_lte_quantity CHECK (reserved <= quantity)
);

-- Unlogged table for fast writes
CREATE UNLOGGED TABLE inventory.stock_movements (
    id bigserial PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES inventory.products(id),
    warehouse_id integer NOT NULL REFERENCES inventory.warehouses(id),
    quantity_change integer NOT NULL,
    movement_type text NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'adjustment', 'transfer')),
    reference_id uuid,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===================== ANALYTICS SCHEMA TABLES =====================

-- Wide table (many columns) to test column density warnings
CREATE TABLE analytics.events (
    id bigserial PRIMARY KEY,
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id uuid,
    org_id uuid REFERENCES auth.organizations(id) ON DELETE SET NULL,
    ip_address inet,
    user_agent text,
    referrer text,
    page_url text,
    element_id text,
    element_class text,
    element_tag text,
    viewport_width integer,
    viewport_height integer,
    screen_resolution text,
    device_type text,
    os_name text,
    os_version text,
    browser_name text,
    browser_version text,
    country_code char(2),
    region text,
    city text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    duration_ms integer,
    properties jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table without PK (to trigger missing PK warning)
CREATE TABLE analytics.raw_pageviews (
    url text NOT NULL,
    visitor_hash text NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT now(),
    duration_ms integer,
    referrer text
);

-- ===================== PUBLIC SCHEMA TABLES =====================

-- Table with many FKs (high coupling)
CREATE TABLE public.audit_log (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    org_id uuid REFERENCES auth.organizations(id) ON DELETE SET NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    action text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table with generated column
CREATE TABLE public.order_summaries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id uuid NOT NULL REFERENCES billing.customers(id),
    subtotal public.positive_money NOT NULL,
    tax_rate public.percentage NOT NULL DEFAULT 0,
    tax_amount public.positive_money GENERATED ALWAYS AS (subtotal * tax_rate / 100) STORED,
    total public.positive_money GENERATED ALWAYS AS (subtotal + subtotal * tax_rate / 100) STORED,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Circular FK reference pair (A references B, B references A)
CREATE TABLE public.documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    content text,
    current_version_id uuid, -- FK added after versions table
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_versions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    content text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

ALTER TABLE public.documents
    ADD CONSTRAINT fk_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES public.document_versions(id)
    ON DELETE SET NULL;

-- Table referencing shared sequence
CREATE TABLE public.ref_codes_a (
    id integer PRIMARY KEY DEFAULT nextval('public.shared_ref_seq'),
    code text NOT NULL
);

CREATE TABLE public.ref_codes_b (
    id integer PRIMARY KEY DEFAULT nextval('public.shared_ref_seq'),
    label text NOT NULL
);

-- ===================== INDEXES =====================

-- Standard indexes
CREATE INDEX idx_users_email ON auth.users (email);
CREATE INDEX idx_users_role_status ON auth.users (role, status);
CREATE INDEX idx_users_created_at ON auth.users (created_at DESC);
CREATE INDEX idx_sessions_user_id ON auth.sessions (user_id);
CREATE INDEX idx_sessions_expires ON auth.sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user ON auth.api_keys (user_id) WHERE revoked = false;

-- Expression index
CREATE INDEX idx_users_lower_name ON auth.users (lower(display_name));

-- GIN indexes
CREATE INDEX idx_products_tags ON inventory.products USING GIN (tags);
CREATE INDEX idx_products_metadata ON inventory.products USING GIN (metadata);
CREATE INDEX idx_products_search ON inventory.products USING GIN (search_vector);

-- GiST index
CREATE INDEX idx_events_ip ON analytics.events USING GIST (ip_address inet_ops);

-- Partial index
CREATE INDEX idx_subscriptions_active ON billing.subscriptions (customer_id)
    WHERE status = 'active';

-- Composite indexes
CREATE INDEX idx_stock_levels_lookup ON inventory.stock_levels (warehouse_id, product_id);
CREATE INDEX idx_events_user_time ON analytics.events (user_id, created_at DESC);
CREATE INDEX idx_audit_target ON public.audit_log (target_type, target_id);

-- Duplicate index (intentional, for detection)
CREATE INDEX idx_users_email_dup ON auth.users (email);

-- Redundant index (prefix covered by composite)
CREATE INDEX idx_events_user ON analytics.events (user_id);

-- ===================== VIEWS =====================

CREATE VIEW auth.active_users AS
    SELECT u.id, u.email, u.display_name, u.role, u.last_login_at
    FROM auth.users u
    WHERE u.status = 'active' AND u.deleted_at IS NULL;

CREATE VIEW billing.revenue_summary AS
    SELECT
        date_trunc('month', p.created_at) AS month,
        count(*) AS payment_count,
        sum(p.amount) AS total_revenue,
        avg(p.amount) AS avg_payment
    FROM billing.payments p
    WHERE p.status = 'completed'
    GROUP BY date_trunc('month', p.created_at);

CREATE VIEW analytics.user_activity AS
    SELECT
        u.id AS user_id,
        u.display_name,
        count(e.id) AS event_count,
        max(e.created_at) AS last_activity
    FROM auth.users u
    LEFT JOIN analytics.events e ON e.user_id = u.id
    GROUP BY u.id, u.display_name;

-- View depending on another view
CREATE VIEW analytics.active_user_activity AS
    SELECT ua.*
    FROM analytics.user_activity ua
    JOIN auth.active_users au ON au.id = ua.user_id;

-- Materialized view
CREATE MATERIALIZED VIEW analytics.daily_stats AS
    SELECT
        date_trunc('day', created_at) AS day,
        event_type,
        count(*) AS event_count,
        count(DISTINCT user_id) AS unique_users
    FROM analytics.events
    GROUP BY date_trunc('day', created_at), event_type;

CREATE INDEX idx_daily_stats_day ON analytics.daily_stats (day);

-- Recursive view (org tree)
CREATE RECURSIVE VIEW auth.org_tree (id, name, parent_org_id, depth, path) AS
    SELECT id, name, parent_org_id, 0 AS depth, ARRAY[id] AS path
    FROM auth.organizations
    WHERE parent_org_id IS NULL
    UNION ALL
    SELECT o.id, o.name, o.parent_org_id, t.depth + 1, t.path || o.id
    FROM auth.organizations o
    JOIN auth.org_tree t ON t.id = o.parent_org_id;

-- ===================== FUNCTIONS =====================

CREATE OR REPLACE FUNCTION auth.hash_password(raw_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN crypt(raw_password, gen_salt('bf', 12));
END;
$$;

CREATE OR REPLACE FUNCTION auth.verify_password(raw_password text, hashed text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN hashed = crypt(raw_password, hashed);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inventory.adjust_stock(
    p_product_id uuid,
    p_warehouse_id integer,
    p_quantity integer,
    p_type text DEFAULT 'adjustment'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE inventory.stock_levels
    SET quantity = quantity + p_quantity,
        last_counted_at = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    INSERT INTO inventory.stock_movements (product_id, warehouse_id, quantity_change, movement_type)
    VALUES (p_product_id, p_warehouse_id, p_quantity, p_type);
END;
$$;

CREATE OR REPLACE FUNCTION analytics.cleanup_old_events(retention_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM analytics.events
    WHERE created_at < now() - (retention_days || ' days')::interval;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Unused function (should be detected)
CREATE OR REPLACE FUNCTION public.unused_helper()
RETURNS void
LANGUAGE sql
AS $$
    SELECT 1;
$$;

-- ===================== TRIGGERS =====================

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON billing.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON inventory.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Multiple triggers on same table/event (ordering conflict)
CREATE TRIGGER trg_users_audit_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_users_welcome_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger with missing function reference (intentional)
CREATE TRIGGER trg_broken_function
    AFTER DELETE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.nonexistent_function();

-- ===================== RLS POLICIES =====================

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON auth.users
    FOR SELECT
    TO authenticated
    USING (id = current_setting('app.current_user_id')::uuid);

CREATE POLICY users_admin_all ON auth.users
    FOR ALL
    TO admin_role
    USING (true);

-- Over-permissive policy
CREATE POLICY sessions_public ON auth.sessions
    FOR ALL
    USING (true);

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_customer_select ON billing.invoices
    FOR SELECT
    USING (customer_id = current_setting('app.current_customer_id')::uuid);

-- ===================== GRANTS (for privilege analysis) =====================
-- (The parser may or may not pick these up, but they're here for completeness)

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON billing.invoices TO billing_admin;
