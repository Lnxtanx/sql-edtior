/**
 * Token Type to CSS Class Mapping
 * 
 * Defines the visual appearance for each PostgreSQL token type.
 * Uses Tailwind CSS classes for consistent styling.
 */

import { TokenType } from '../sql-parser/types/core-types';

/**
 * CSS classes for each token type in the SQL syntax highlighter
 */
export const TOKEN_CLASSES: Record<TokenType, string> = {
    // Keywords: purple/violet for SQL reserved words
    KEYWORD: 'text-violet-600 dark:text-violet-400 font-semibold',

    // Identifiers: blue for table/column names
    IDENTIFIER: 'text-blue-600 dark:text-blue-400',

    // Quoted identifiers: italic blue for "CamelCase" names
    QUOTED_IDENTIFIER: 'text-blue-500 dark:text-blue-300 italic',

    // String literals: green for 'text values'
    STRING: 'text-emerald-600 dark:text-emerald-400',

    // Dollar-quoted strings: green with subtle background for $$function bodies$$
    DOLLAR_STRING: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',

    // Numbers: amber/orange for numeric literals
    NUMBER: 'text-amber-600 dark:text-amber-400',

    // Operators: gray for ::, ->, =, etc.
    OPERATOR: 'text-gray-600 dark:text-gray-400',

    // Symbols: slightly lighter gray for (, ), ;, ,
    SYMBOL: 'text-gray-500 dark:text-gray-500',

    // Delimiters: same as symbols
    DELIMITER: 'text-gray-500 dark:text-gray-500',

    // Comments: muted italic for -- and /* */
    COMMENT: 'text-gray-400 dark:text-gray-500 italic',

    // Whitespace: invisible (no special styling)
    WHITESPACE: '',

    // EOF: no styling needed
    EOF: '',
};

/**
 * PostgreSQL data type keywords that should be styled differently
 * These get a cyan/teal color to distinguish from keywords
 */
export const DATA_TYPE_KEYWORDS = new Set([
    'INTEGER', 'INT', 'BIGINT', 'SMALLINT',
    'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT', 'DOUBLE', 'PRECISION', 'MONEY',
    'TEXT', 'VARCHAR', 'CHAR', 'CHARACTER', 'VARYING',
    'BOOLEAN', 'BOOL',
    'UUID',
    'JSON', 'JSONB',
    'BYTEA',
    'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'TIMETZ', 'INTERVAL',
    'INET', 'CIDR', 'MACADDR',
    'ARRAY',
    'HSTORE',
    'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
    'TSVECTOR', 'TSQUERY',
]);

/**
 * CSS class for data type keywords
 */
export const DATA_TYPE_CLASS = 'text-cyan-600 dark:text-cyan-400 font-medium';

/**
 * Get the appropriate CSS class for a token
 */
export function getTokenClass(type: TokenType, value?: string): string {
    // Check if this is a data type keyword
    if (type === 'KEYWORD' && value && DATA_TYPE_KEYWORDS.has(value.toUpperCase())) {
        return DATA_TYPE_CLASS;
    }

    return TOKEN_CLASSES[type] || '';
}

/**
 * CSS class for the editor container
 */
export const EDITOR_CONTAINER_CLASS = 'font-mono text-[11px] leading-relaxed';

/**
 * CSS class for line numbers
 */
export const LINE_NUMBER_CLASS = 'text-gray-400 dark:text-gray-600 select-none pr-3 text-right';
