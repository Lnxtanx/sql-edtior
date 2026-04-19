
/**
 * Strategy C: Pattern Match Parser (Regex Fallback)
 * 
 * Fallback parser for syntax that pgsql-ast-parser doesn't support:
 * - PARTITION BY / PARTITION OF
 * - GENERATED ALWAYS AS ... STORED
 * - CREATE POLICY with complex USING expressions
 * - Complex CHECK constraints
 * - COMMENT ON statements
 */

import { StatementInfo } from '../types/core-types';
import { ParseContext } from '../context/parse-context';
import {
    RegexParseResult,
    parseCreateTableRegex,
    parseCreatePolicyRegex,
    parseCreateEnumRegex,
    parseCreateTypeRegex,
    parseCreateViewRegex,
    parseCreateFunctionRegex,
    parseCreateTriggerRegex,
    parseCreateExtensionRegex,
    parseCreateSchemaRegex,
    parseCreateSequenceRegex,
    parseCreateDomainRegex,
    parseCreateIndexRegex,
    parseCreateRoleRegex,
    parseAlterTableRegex
} from './regex/parsers';

// Re-export result type for consumers
export type { RegexParseResult };

// =============================================================================
// Main Parser Functions
// =============================================================================

/**
 * Try to parse a statement using regex patterns
 */
export function tryRegexParse(
    statement: StatementInfo,
    context: ParseContext
): RegexParseResult {
    const sql = statement.text.trim();
    const sqlUpper = sql.toUpperCase();

    switch (statement.type) {
        case 'CREATE_TABLE':
        case 'CREATE_TABLE_PARTITION':
            return parseCreateTableRegex(sql, context);

        case 'CREATE_POLICY':
            return parseCreatePolicyRegex(sql, context);

        case 'CREATE_ENUM':
            return parseCreateEnumRegex(sql, context);

        case 'CREATE_TYPE':
            return parseCreateTypeRegex(sql, context);

        case 'CREATE_VIEW':
        case 'CREATE_MATERIALIZED_VIEW':
            return parseCreateViewRegex(sql, context);

        case 'CREATE_FUNCTION':
        case 'CREATE_PROCEDURE':
            return parseCreateFunctionRegex(sql, context);

        case 'CREATE_TRIGGER':
            return parseCreateTriggerRegex(sql, context);

        case 'CREATE_EXTENSION':
            return parseCreateExtensionRegex(sql, context);

        case 'CREATE_SCHEMA':
            return parseCreateSchemaRegex(sql);

        case 'CREATE_SEQUENCE':
            return parseCreateSequenceRegex(sql, context);

        case 'CREATE_DOMAIN':
            return parseCreateDomainRegex(sql, context);

        case 'CREATE_INDEX':
            return parseCreateIndexRegex(sql, context);

        case 'CREATE_ROLE':
            return parseCreateRoleRegex(sql, context);

        case 'ALTER_TABLE':
            return parseAlterTableRegex(sql, context);

        default:
            // Auto-detect based on SQL text for UNKNOWN types
            return tryAutoDetectParse(sql, sqlUpper, context);
    }
}

/**
 * Auto-detect statement type from SQL text and parse
 */
function tryAutoDetectParse(
    sql: string,
    sqlUpper: string,
    context: ParseContext
): RegexParseResult {
    // Try CREATE TABLE
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('TABLE')) {
        const result = parseCreateTableRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE INDEX
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('INDEX')) {
        const result = parseCreateIndexRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE VIEW
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('VIEW')) {
        const result = parseCreateViewRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE FUNCTION
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('FUNCTION')) {
        const result = parseCreateFunctionRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE TRIGGER
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('TRIGGER')) {
        const result = parseCreateTriggerRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE POLICY
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('POLICY')) {
        const result = parseCreatePolicyRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE TYPE with ENUM
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('TYPE') && sqlUpper.includes('ENUM')) {
        const result = parseCreateEnumRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE TYPE (composite)
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('TYPE')) {
        const result = parseCreateTypeRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE EXTENSION
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('EXTENSION')) {
        const result = parseCreateExtensionRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE SCHEMA
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('SCHEMA')) {
        const result = parseCreateSchemaRegex(sql);
        if (result.success) return result;
    }

    // Try CREATE SEQUENCE
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('SEQUENCE')) {
        const result = parseCreateSequenceRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE DOMAIN
    if (sqlUpper.includes('CREATE') && sqlUpper.includes('DOMAIN')) {
        const result = parseCreateDomainRegex(sql, context);
        if (result.success) return result;
    }

    // Try CREATE ROLE / USER
    if (sqlUpper.includes('CREATE') && (sqlUpper.includes('ROLE') || sqlUpper.includes('USER'))) {
        const result = parseCreateRoleRegex(sql, context);
        if (result.success) return result;
    }

    // Try ALTER TABLE ENABLE ROW LEVEL SECURITY
    if (sqlUpper.includes('ALTER') && sqlUpper.includes('TABLE') && sqlUpper.includes('ROW LEVEL SECURITY')) {
        const result = parseAlterTableRegex(sql, context);
        if (result.success) return result;
    }

    return { success: false, confidence: 0, error: 'No matching pattern found' };
}
