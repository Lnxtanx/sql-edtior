
import { DataTypeCategory } from '../../types/core-types';

// =============================================================================
// Type Categorization
// =============================================================================

export function categorizeDataType(typeName: string): DataTypeCategory {
    const t = typeName.toLowerCase();

    if (/^(int|integer|bigint|smallint|serial|bigserial|smallserial|numeric|decimal|real|float|double|money)/.test(t)) {
        return 'numeric';
    }
    if (/^(text|varchar|char|character|citext|name)/.test(t)) {
        return 'text';
    }
    if (/^(bool|boolean)/.test(t)) {
        return 'boolean';
    }
    if (/^(date|time|timestamp|timestamptz|timetz|interval)/.test(t)) {
        return 'datetime';
    }
    if (t === 'uuid') return 'uuid';
    if (/^(json|jsonb|json_scalar|json_table)/.test(t)) return 'json';
    if (t.endsWith('[]')) return 'array';
    if (t === 'bytea') return 'binary';
    if (t === 'hstore') return 'hstore';
    if (/range$/.test(t)) return 'range';
    if (/multirange$/.test(t)) return 'range';
    if (/^(inet|cidr|macaddr|macaddr8)/.test(t)) return 'network';
    if (/^(geometry|geography|point|line|lseg|box|path|polygon|circle)/.test(t)) {
        return 'geometry';
    }
    if (/^(tsvector|tsquery)/.test(t)) return 'text';
    if (/^(xml)/.test(t)) return 'text';

    return 'other';
}

// =============================================================================
// Regex Patterns
// =============================================================================

export const PATTERNS = {
    // CREATE TABLE with optional schema
    createTable: /CREATE\s+(?:TEMP(?:ORARY)?\s+)?(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(/i,

    // PARTITION BY clause
    partitionBy: /PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*\(\s*([^)]+)\s*\)/i,

    // PARTITION OF clause (child partition)
    partitionOf: /CREATE\s+TABLE\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+PARTITION\s+OF\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+FOR\s+VALUES\s+(FROM\s*\([^)]+\)\s*TO\s*\([^)]+\)|IN\s*\([^)]+\))/i,

    // Column definition (simplified)
    column: /^\s*"?(\w+)"?\s+([A-Z][A-Z0-9_(),.]+)(?:\s*\[\s*\])?(.*)$/i,

    // GENERATED ALWAYS AS (PG <=17: STORED only; PG 18+: STORED or VIRTUAL)
    generatedColumn: /GENERATED\s+ALWAYS\s+AS\s*\(([^)]+)\)\s+(STORED|VIRTUAL)/i,

    // REFERENCES clause
    references: /REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)\s*(?:ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/i,

    // PRIMARY KEY
    primaryKey: /PRIMARY\s+KEY/i,

    // NOT NULL
    notNull: /NOT\s+NULL/i,

    // UNIQUE
    unique: /\bUNIQUE\b/i,

    // DEFAULT
    default: /DEFAULT\s+([^,)]+)/i,

    // CHECK constraint
    check: /CHECK\s*\(([^)]+(?:\([^)]*\)[^)]*)*)\)/i,

    // Table-level CONSTRAINT
    tableConstraint: /CONSTRAINT\s+"?(\w+)"?\s+(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)/i,

    // CREATE POLICY
    createPolicy: /CREATE\s+POLICY\s+"?(\w+)"?\s+ON\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+(?:AS\s+(PERMISSIVE|RESTRICTIVE)\s+)?FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i,

    // USING and WITH CHECK in policies
    policyUsing: /USING\s*\((.+?)\)(?:\s*WITH\s+CHECK\s*\((.+?)\))?/i,

    // CREATE TYPE ... AS ENUM
    createEnum: /CREATE\s+TYPE\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+AS\s+ENUM\s*\(\s*([^)]+)\s*\)/i,

    // CREATE TYPE ... AS (composite) - NOT ENUM (requires matching parens, not ENUM keyword)
    createCompositeType: /CREATE\s+TYPE\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+AS\s*\(\s*([\s\S]+?)\s*\)/i,

    // CREATE DOMAIN
    createDomain: /CREATE\s+DOMAIN\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+(?:AS\s+)?([A-Z][A-Z0-9_(),\s]+?)(?:\s+(?:NOT\s+NULL|NULL|DEFAULT|CHECK|COLLATE)[\s\S]*)?$/i,

    // CREATE VIEW
    createView: /CREATE\s+(?:OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+AS/i,

    // CREATE FUNCTION
    createFunction: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]*)\)\s*RETURNS\s+(\w+(?:\s+\w+)?)/i,

    // CREATE TRIGGER
    createTrigger: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+"?(\w+)"?\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+(INSERT|UPDATE|DELETE)(?:\s+OR\s+(INSERT|UPDATE|DELETE))*\s+ON\s+(?:"?(\w+)"?\.)?"?(\w+)"?/i,

    // EXECUTE FUNCTION
    executeFunction: /EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:"?(\w+)"?\.)?"?(\w+)"?/i,

    // CREATE EXTENSION
    createExtension: /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i,

    // CREATE SCHEMA
    createSchema: /CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i,

    // CREATE SEQUENCE
    createSequence: /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?/i,

    // COMMENT ON
    comment: /COMMENT\s+ON\s+(TABLE|COLUMN|SCHEMA|FUNCTION|INDEX|TRIGGER|VIEW)\s+(?:"?(\w+)"?\.)?"?(\w+)"?(?:\."?(\w+)"?)?\s+IS\s+'([^']+)'/i,

    // CREATE INDEX - improved to handle complex expressions
    createIndex: /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+ON\s+(?:ONLY\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?(?:\s+USING\s+(\w+))?\s*\(([\s\S]+?)\)(?:\s+(?:WHERE|INCLUDE|WITH))?/i,

    // CREATE ROLE
    createRole: /CREATE\s+(ROLE|USER)\s+"?(\w+)"?(?:\s+(SUPERUSER|NOSUPERUSER|CREATEDB|NOCREATEDB|CREATEROLE|NOCREATEROLE|INHERIT|NOINHERIT|LOGIN|NOLOGIN|REPLICATION|NOREPLICATION|BYPASSRLS|NOBYPASSRLS|CONNECTION\s+LIMIT\s+\d+|VALID\s+UNTIL\s+'[^']+'|PASSWORD\s+'[^']+'|IN\s+ROLE\s+[^,;]+|IN\s+GROUP\s+[^,;]+|ROLE\s+[^,;]+|ADMIN\s+[^,;]+|USER\s+[^,;]+|SYSID\s+\d+)*)*/i,

    // ALTER TABLE ENABLE ROW LEVEL SECURITY
    enableRls: /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
};
