/**
 * Tokenizer for PostgreSQL SQL
 * 
 * Performs lexical analysis with context awareness:
 * - Tracks nesting depth (parentheses, brackets, braces)
 * - Handles $$ delimiters as atomic tokens
 * - Preserves source positions for error reporting
 */

import {
    Token,
    TokenType,
    TokenContext,
    Position,
} from '../types/core-types';

// =============================================================================
// PostgreSQL Keywords
// =============================================================================

const KEYWORDS = new Set([
    // DDL commands
    'CREATE', 'TABLE', 'VIEW', 'INDEX', 'FUNCTION', 'PROCEDURE', 'TRIGGER',
    'SCHEMA', 'TYPE', 'ENUM', 'DOMAIN', 'SEQUENCE', 'EXTENSION', 'POLICY',
    'MATERIALIZED', 'TEMPORARY', 'TEMP', 'UNLOGGED', 'IF', 'NOT', 'EXISTS',
    'OR', 'REPLACE', 'AS', 'WITH', 'WITHOUT', 'ZONE', 'TIME', 'TIMESTAMP',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
    'NULL', 'CONSTRAINT', 'CASCADE', 'RESTRICT', 'SET', 'NO', 'ACTION',
    'ON', 'DELETE', 'UPDATE', 'INSERT', 'SELECT', 'FROM', 'WHERE', 'AND',
    'PARTITION', 'BY', 'RANGE', 'LIST', 'HASH', 'OF', 'FOR', 'VALUES',
    'GENERATED', 'ALWAYS', 'STORED', 'IDENTITY', 'RETURNING', 'RETURNS',
    'LANGUAGE', 'VOLATILE', 'STABLE', 'IMMUTABLE', 'SECURITY', 'DEFINER',
    'INVOKER', 'BEGIN', 'END', 'DECLARE', 'RETURN', 'EXECUTE', 'USING',
    'AFTER', 'BEFORE', 'INSTEAD', 'EACH', 'ROW', 'STATEMENT', 'WHEN',
    'PERMISSIVE', 'RESTRICTIVE', 'ALL', 'TO', 'GRANT', 'REVOKE', 'PUBLIC',
    'OWNER', 'COMMENT', 'IS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR',
    'TRUE', 'FALSE', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
    'NOW', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'INTEGER', 'INT', 'BIGINT',
    'SMALLINT', 'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE', 'PRECISION', 'MONEY',
    'TEXT', 'VARCHAR', 'CHAR', 'CHARACTER', 'VARYING', 'BOOLEAN', 'BOOL',
    'UUID', 'JSON', 'JSONB', 'BYTEA', 'INET', 'CIDR', 'MACADDR', 'HSTORE',
    'ARRAY', 'DATE', 'INTERVAL', 'TIMESTAMPTZ', 'TIMETZ', 'POINT', 'LINE',
    'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE', 'TSVECTOR', 'TSQUERY',
    'ENABLE', 'DISABLE', 'ALTER', 'DROP', 'ADD', 'COLUMN', 'INHERITS',
    'INCLUDE', 'CONCURRENTLY', 'ONLY', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'JOIN', 'CROSS', 'NATURAL', 'GROUP', 'ORDER', 'ASC', 'DESC', 'NULLS',
    'FIRST', 'LAST', 'LIMIT', 'OFFSET', 'HAVING', 'UNION', 'INTERSECT',
    'EXCEPT', 'DISTINCT', 'RECURSIVE', 'CASE', 'THEN', 'ELSE', 'ELSIF',
    // PG 15+ MERGE support
    'MERGE', 'MATCHED', 'TARGET', 'SOURCE',
    // PG 17: JSON_TABLE and JSON constructors
    'JSON_TABLE', 'JSON_QUERY', 'JSON_VALUE', 'JSON_EXISTS',
    'JSON_SCALAR', 'JSON_SERIALIZE', 'JSON_OBJECT', 'JSON_ARRAY',
    'JSON_ARRAYAGG', 'JSON_OBJECTAGG',
    'COLUMNS', 'NESTED', 'PLAN', 'WRAPPER', 'QUOTES', 'KEEP',
    'OMIT', 'CONDITIONAL', 'UNCONDITIONAL', 'ERROR', 'EMPTY',
    // PG 18: Virtual generated columns, enhanced RETURNING
    'VIRTUAL', 'OLD', 'NEW',
    // PG 18: COPY enhancements
    'COPY', 'STDIN', 'STDOUT',
    // Additional SQL standard keywords used in PG
    'OVER', 'WINDOW', 'ROWS', 'GROUPS', 'PRECEDING', 'FOLLOWING',
    'UNBOUNDED', 'CURRENT', 'EXCLUDE', 'TIES', 'OTHERS', 'FILTER',
    'WITHIN', 'LATERAL', 'TABLESAMPLE', 'ORDINALITY',
]);

// =============================================================================
// Tokenizer Class
// =============================================================================

export class Tokenizer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private tokens: Token[] = [];
    private context: TokenContext;

    constructor(input: string) {
        this.input = input;
        this.context = this.createInitialContext();
    }

    private createInitialContext(): TokenContext {
        return {
            parenthesesDepth: 0,
            bracketDepth: 0,
            braceDepth: 0,
            inFunction: false,
            inString: false,
            stringDelimiter: undefined,
        };
    }

    private currentPosition(): Position {
        return {
            line: this.line,
            column: this.column,
            offset: this.position,
        };
    }

    private peek(offset: number = 0): string {
        return this.input[this.position + offset] || '';
    }

    private advance(): string {
        const char = this.input[this.position] || '';
        this.position++;
        if (char === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return char;
    }

    private isAtEnd(): boolean {
        return this.position >= this.input.length;
    }

    private isWhitespace(char: string): boolean {
        return /\s/.test(char);
    }

    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    private isAlpha(char: string): boolean {
        return /[a-zA-Z_]/.test(char);
    }

    private isAlphaNumeric(char: string): boolean {
        return /[a-zA-Z0-9_]/.test(char);
    }

    private addToken(type: TokenType, value: string, raw?: string): void {
        this.tokens.push({
            type,
            value,
            position: this.currentPosition(),
            context: { ...this.context },
            raw,
        });
    }

    /**
     * Main tokenization entry point
     */
    tokenize(): Token[] {
        this.tokens = [];
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.context = this.createInitialContext();

        while (!this.isAtEnd()) {
            this.scanToken();
        }

        this.addToken('EOF', '');
        return this.tokens;
    }

    private scanToken(): void {
        const char = this.peek();

        // Skip whitespace (but track newlines for position)
        if (this.isWhitespace(char)) {
            this.skipWhitespace();
            return;
        }

        // Comments
        if (char === '-' && this.peek(1) === '-') {
            this.scanLineComment();
            return;
        }

        if (char === '/' && this.peek(1) === '*') {
            this.scanBlockComment();
            return;
        }

        // Dollar-quoted strings (PostgreSQL function bodies)
        if (char === '$') {
            this.scanDollarString();
            return;
        }

        // Strings
        if (char === "'" || char === '"') {
            this.scanString(char);
            return;
        }

        // Numbers
        if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1)))) {
            this.scanNumber();
            return;
        }

        // Identifiers and keywords
        if (this.isAlpha(char)) {
            this.scanIdentifierOrKeyword();
            return;
        }

        // Operators and symbols
        this.scanOperatorOrSymbol();
    }

    private skipWhitespace(): void {
        while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
            this.advance();
        }
    }

    private scanLineComment(): void {
        const start = this.currentPosition();
        let value = '';

        // Consume --
        value += this.advance();
        value += this.advance();

        // Consume until end of line
        while (!this.isAtEnd() && this.peek() !== '\n') {
            value += this.advance();
        }

        this.addToken('COMMENT', value);
    }

    private scanBlockComment(): void {
        let value = '';
        let depth = 0;

        // Consume /*
        value += this.advance();
        value += this.advance();
        depth = 1;

        // Consume until matching */
        while (!this.isAtEnd() && depth > 0) {
            if (this.peek() === '/' && this.peek(1) === '*') {
                value += this.advance();
                value += this.advance();
                depth++;
            } else if (this.peek() === '*' && this.peek(1) === '/') {
                value += this.advance();
                value += this.advance();
                depth--;
            } else {
                value += this.advance();
            }
        }

        this.addToken('COMMENT', value);
    }

    private scanDollarString(): void {
        let value = '';
        let tag = '';

        // Consume opening $
        value += this.advance();

        // Scan for tag (optional text between $ and $)
        while (!this.isAtEnd() && this.peek() !== '$') {
            const char = this.peek();
            if (!this.isAlphaNumeric(char) && char !== '_') {
                // Not a dollar string, treat as operator
                this.addToken('SYMBOL', '$');
                return;
            }
            tag += this.advance();
            value += tag[tag.length - 1];
        }

        if (this.isAtEnd()) {
            this.addToken('SYMBOL', '$');
            return;
        }

        // Consume closing $ of opening tag
        value += this.advance();

        const delimiter = `$${tag}$`;

        // Mark we're in a function body if this looks like a function
        const wasInFunction = this.context.inFunction;
        this.context.inFunction = true;
        this.context.inString = true;
        this.context.stringDelimiter = delimiter;

        // Scan until closing delimiter
        let bodyStart = value.length;
        while (!this.isAtEnd()) {
            if (this.peek() === '$') {
                // Check if this is the closing delimiter
                let potentialClose = '';
                let lookAhead = 0;

                while (lookAhead < delimiter.length &&
                    this.peek(lookAhead) !== undefined) {
                    potentialClose += this.peek(lookAhead);
                    lookAhead++;
                }

                if (potentialClose === delimiter) {
                    // Found closing delimiter
                    for (let i = 0; i < delimiter.length; i++) {
                        value += this.advance();
                    }
                    break;
                }
            }
            value += this.advance();
        }

        this.context.inFunction = wasInFunction;
        this.context.inString = false;
        this.context.stringDelimiter = undefined;

        this.addToken('DOLLAR_STRING', value);
    }

    private scanString(quote: string): void {
        let value = '';

        // Consume opening quote
        value += this.advance();

        this.context.inString = true;
        this.context.stringDelimiter = quote;

        while (!this.isAtEnd()) {
            const char = this.peek();

            if (char === quote) {
                value += this.advance();
                // Check for escaped quote (doubled)
                if (this.peek() === quote) {
                    value += this.advance();
                } else {
                    break;
                }
            } else if (char === '\\' && quote === "'") {
                // Backslash escape in single quotes
                value += this.advance();
                if (!this.isAtEnd()) {
                    value += this.advance();
                }
            } else {
                value += this.advance();
            }
        }

        this.context.inString = false;
        this.context.stringDelimiter = undefined;

        const tokenType = quote === '"' ? 'QUOTED_IDENTIFIER' : 'STRING';
        this.addToken(tokenType, value);
    }

    private scanNumber(): void {
        let value = '';

        // Integer part
        while (!this.isAtEnd() && this.isDigit(this.peek())) {
            value += this.advance();
        }

        // Decimal part
        if (this.peek() === '.' && this.isDigit(this.peek(1))) {
            value += this.advance(); // .
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                value += this.advance();
            }
        }

        // Exponent
        if (this.peek().toLowerCase() === 'e') {
            value += this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                value += this.advance();
            }
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                value += this.advance();
            }
        }

        this.addToken('NUMBER', value);
    }

    private scanIdentifierOrKeyword(): void {
        let value = '';

        while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
            value += this.advance();
        }

        const upper = value.toUpperCase();
        const isKeyword = KEYWORDS.has(upper);

        this.addToken(
            isKeyword ? 'KEYWORD' : 'IDENTIFIER',
            isKeyword ? upper : value,
            value
        );
    }

    private scanOperatorOrSymbol(): void {
        const char = this.advance();

        // Track nesting depth
        switch (char) {
            case '(':
                this.context.parenthesesDepth++;
                this.addToken('SYMBOL', char);
                return;
            case ')':
                this.context.parenthesesDepth = Math.max(0, this.context.parenthesesDepth - 1);
                this.addToken('SYMBOL', char);
                return;
            case '[':
                this.context.bracketDepth++;
                this.addToken('SYMBOL', char);
                return;
            case ']':
                this.context.bracketDepth = Math.max(0, this.context.bracketDepth - 1);
                this.addToken('SYMBOL', char);
                return;
            case '{':
                this.context.braceDepth++;
                this.addToken('SYMBOL', char);
                return;
            case '}':
                this.context.braceDepth = Math.max(0, this.context.braceDepth - 1);
                this.addToken('SYMBOL', char);
                return;
        }

        // Two-character operators
        const next = this.peek();
        const twoChar = char + next;

        const twoCharOperators = new Set([
            '::', '!=', '<>', '<=', '>=', '||', '&&', '->', '->>',
            '#>', '#>>', '?|', '?&', '@>', '<@', '@@', '~*', '!~',
            '!~*', '<<', '>>'
        ]);

        // Three-character operators
        const threeChar = twoChar + this.peek(1);
        if (threeChar === '->>' || threeChar === '#>>' || threeChar === '!~*') {
            this.advance();
            this.advance();
            this.addToken('OPERATOR', threeChar);
            return;
        }

        if (twoCharOperators.has(twoChar)) {
            this.advance();
            this.addToken('OPERATOR', twoChar);
            return;
        }

        // Single character operators and symbols
        const singleOperators = new Set(['+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '@', '#', '&', '|', '^']);
        const singleSymbols = new Set([',', '.', ';', ':', '?']);

        if (singleOperators.has(char)) {
            this.addToken('OPERATOR', char);
        } else if (singleSymbols.has(char)) {
            this.addToken('SYMBOL', char);
        } else {
            this.addToken('SYMBOL', char);
        }
    }
}

/**
 * Convenience function to tokenize SQL
 */
export function tokenize(sql: string): Token[] {
    const tokenizer = new Tokenizer(sql);
    return tokenizer.tokenize();
}
