/**
 * Enterprise PostgreSQL Parser v2.0
 * 
 * Multi-phase parser with strategy fallback:
 * 1. Tokenize - Lexical analysis
 * 2. Split - Statement separation
 * 3. Parse - Multi-strategy (AST → Regex fallback)
 * 4. Relate - Build relationships
 * 5. Output - Build final schema
 */

import { tokenize } from './core/tokenizer';
import { splitStatements } from './phases/phase-2-split';
import { tryAstParse } from './strategies/strategy-ast-parser';
import { tryRegexParse } from './strategies/strategy-pattern-match';
import { buildOutput } from './phases/phase-7-output';
import { createParseContext, ParseContext } from './context/parse-context';
import {
    ParsedSchema,
    ParseOptions,
    StatementInfo,
    StatementType,
    ParserError,
    Table,
    DEFAULT_PARSE_OPTIONS,
} from './types/core-types';

// Re-export types
export * from './types/core-types';

// =============================================================================
// Sample SQL for Testing
// =============================================================================

export const SAMPLE_SQL = `
-- E-Commerce Database Schema
-- Demonstrates tables, relationships, and PostgreSQL features

-- Users table: Core user accounts
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'customer',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles: One-to-one with users
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  avatar_url TEXT,
  phone VARCHAR(20),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100),
  bio TEXT
);

-- Categories: Product categories with self-reference for hierarchy
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Products: Main product catalog
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(50) UNIQUE,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders: Customer orders
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(30) DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL,
  shipping_address TEXT,
  payment_method VARCHAR(50),
  payment_status VARCHAR(30) DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Order items: Products in each order (many-to-many relationship)
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

-- Reviews: Product reviews by users
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishlists: User's saved products
CREATE TABLE wishlists (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
`;

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parse PostgreSQL DDL SQL and extract schema information
 */
export function parsePostgresSQL(
    sql: string,
    options: Partial<ParseOptions> = {}
): ParsedSchema {
    const startTime = Date.now();
    const context = createParseContext({ ...DEFAULT_PARSE_OPTIONS, ...options });

    try {
        // Phase 1: Tokenize
        const tokens = tokenize(sql);

        // Phase 2: Split into statements
        const statements = splitStatements(tokens);

        // Limit statements if needed
        const maxStatements = context.options.maxStatements || 10000;
        const statementsToProcess = statements.slice(0, maxStatements);

        if (statements.length > maxStatements) {
            context.addWarning({
                level: 'WARNING',
                code: 'PARSE_ERROR',
                message: `Truncated to ${maxStatements} statements (found ${statements.length})`,
            });
        }

        // Phase 3: Parse each statement
        for (const stmt of statementsToProcess) {
            parseStatement(stmt, context);
        }

        // Phase 4-7: Build relationships and output
        return buildOutput(context, startTime);

    } catch (error: any) {
        context.addError({
            level: 'ERROR',
            code: 'PARSE_ERROR',
            message: error.message || 'Unknown parse error',
        });

        return buildOutput(context, startTime);
    }
}

/**
 * Parse a single statement using multi-strategy approach
 */
function parseStatement(stmt: StatementInfo, context: ParseContext): void {
    // Skip unknown or empty statements
    if (stmt.type === 'UNKNOWN' || !stmt.text.trim()) {
        return;
    }

    // Track schema from namespace
    if (stmt.namespace.schemaName) {
        context.addSchema(stmt.namespace.schemaName);
    }

    // Handle SET search_path
    if (stmt.type === 'SET') {
        const match = stmt.text.match(/SET\s+search_path\s+(?:TO|=)\s+(.+)/i);
        if (match) {
            const paths = match[1]
                .split(',')
                .map(p => p.trim().replace(/^"|"$/g, '')) // Remove quotes if present
                .filter(p => p.length > 0);

            // Add implicit 'public' if not present? Postgres doesn't enforce it, but typically it is there.
            // Using exact user setting is better. 
            // NOTE: search_path usually takes effect for subsequent commands. 
            // Since we process sequentially, updating context now is correct.
            context.searchPath = paths;
            if (paths.length > 0) {
                context.currentSchema = paths[0];
            }
        }
        return;
    }

    // For certain types, regex is more reliable - try regex first
    const regexFirstTypes: StatementType[] = [
        'CREATE_INDEX',
        // 'CREATE_VIEW', // AST parser handles views better now (dependencies)
        // 'CREATE_MATERIALIZED_VIEW',
        'CREATE_TRIGGER',
        'CREATE_POLICY',
        'CREATE_TYPE',
        'CREATE_DOMAIN',
    ];

    if (regexFirstTypes.includes(stmt.type)) {
        // Try regex first for these types
        const regexResult = tryRegexParse(stmt, context);
        if (regexResult.success) {
            mergeRegexResult(regexResult, context);
            return;
        }

        // Fall back to AST
        const astResult = tryAstParse(stmt, context);
        if (astResult.success) {
            mergeAstResult(astResult, context);
            return;
        }
    } else {
        // Strategy A: Try AST parser first
        const astResult = tryAstParse(stmt, context);

        if (astResult.success) {
            mergeAstResult(astResult, context);
            return;
        }

        // Strategy C: Try regex pattern matching as fallback
        const regexResult = tryRegexParse(stmt, context);

        if (regexResult.success) {
            mergeRegexResult(regexResult, context);
            return;
        }
    }

    // Both strategies failed - emit warning
    context.addWarning({
        level: 'WARNING',
        code: 'INCOMPLETE_PARSE',
        message: `Could not parse statement: ${stmt.text.slice(0, 100)}...`,
        statement: stmt.text,
        position: stmt.position,
        suggestion: 'Statement may contain unsupported syntax',
        recovery: 'SKIP_STATEMENT',
    });
}

/**
 * Merge AST parse result into context
 */
function mergeAstResult(result: any, context: ParseContext): void {
    // Tables
    for (const table of result.tables || []) {
        if (!context.tables.has(table.name)) {
            context.tables.set(table.name, table);
            context.defineSymbol(
                table.name.split('.').pop() || table.name,
                'table',
                table,
                table.schema,
                'DEFINITIVE'
            );
            table.verificationLevel = 'DEFINITIVE';
        }
    }

    // Enums
    for (const enumType of result.enums || []) {
        context.enums.set(enumType.name, enumType);
        context.defineSymbol(
            enumType.name.split('.').pop() || enumType.name,
            'enum',
            enumType,
            enumType.schema,
            'DEFINITIVE'
        );
    }

    // Views
    for (const view of result.views || []) {
        context.views.set(view.name, view);
        context.defineSymbol(
            view.name.split('.').pop() || view.name,
            'view',
            view,
            view.schema,
            'DEFINITIVE'
        );
        view.verificationLevel = 'DEFINITIVE';
    }

    // Indexes
    for (const index of result.indexes || []) {
        context.indexes.set(index.name, index);
    }

    // Functions
    for (const func of result.functions || []) {
        context.functions.set(func.name, func);
        context.defineSymbol(
            func.name.split('.').pop() || func.name,
            'function',
            func,
            func.schema,
            'DEFINITIVE'
        );
    }

    // Triggers
    for (const trigger of result.triggers || []) {
        context.triggers.set(trigger.name, trigger);
    }

    // Policies
    for (const policy of result.policies || []) {
        context.policies.set(policy.name, policy);
    }

    // Sequences
    for (const sequence of result.sequences || []) {
        context.sequences.set(sequence.name, sequence);
        context.defineSymbol(
            sequence.name.split('.').pop() || sequence.name,
            'sequence',
            sequence,
            sequence.schema,
            'DEFINITIVE'
        );
    }

    // Extensions
    for (const extension of result.extensions || []) {
        context.extensions.set(extension.name, extension);
    }

    // Schemas
    for (const schema of result.schemas || []) {
        context.addSchema(schema);
    }
}

/**
 * Merge regex parse result into context
 */
function mergeRegexResult(result: any, context: ParseContext): void {
    if (result.table) {
        if (!context.tables.has(result.table.name)) {
            context.tables.set(result.table.name, result.table);
            context.defineSymbol(
                result.table.name.split('.').pop() || result.table.name,
                'table',
                result.table,
                result.table.schema,
                'HEURISTIC'
            );
        }
    }

    if (result.view) {
        context.views.set(result.view.name, result.view);
        context.defineSymbol(
            result.view.name.split('.').pop() || result.view.name,
            'view',
            result.view,
            result.view.schema,
            'HEURISTIC'
        );
    }

    if (result.index) {
        context.indexes.set(result.index.name, result.index);
    }

    if (result.policy) {
        context.policies.set(result.policy.name, result.policy);
    }

    if (result.function) {
        context.functions.set(result.function.name, result.function);
        context.defineSymbol(
            result.function.name.split('.').pop() || result.function.name,
            'function',
            result.function,
            result.function.schema,
            'HEURISTIC'
        );
    }

    if (result.trigger) {
        context.triggers.set(result.trigger.name, result.trigger);
    }

    if (result.enum) {
        context.enums.set(result.enum.name, result.enum);
        context.defineSymbol(
            result.enum.name.split('.').pop() || result.enum.name,
            'enum',
            result.enum,
            result.enum.schema,
            'HEURISTIC'
        );
    }

    if (result.compositeType) {
        context.compositeTypes.set(result.compositeType.name, result.compositeType);
    }

    if (result.domain) {
        context.domains.set(result.domain.name, result.domain);
    }

    if (result.extension) {
        context.extensions.set(result.extension.name, result.extension);
    }

    if (result.sequence) {
        context.sequences.set(result.sequence.name, result.sequence);
        context.defineSymbol(
            result.sequence.name.split('.').pop() || result.sequence.name,
            'sequence',
            result.sequence,
            result.sequence.schema,
            'HEURISTIC'
        );
    }

    if (result.schema) {
        context.addSchema(result.schema);
    }
}

// =============================================================================
// Utility Exports
// =============================================================================

export { tokenize } from './core/tokenizer';
export { createTokenStream } from './core/token-stream';
export { splitStatements } from './phases/phase-2-split';
export { createParseContext } from './context/parse-context';
