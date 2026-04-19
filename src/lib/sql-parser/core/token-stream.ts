/**
 * Token Stream Manager
 * 
 * Provides iterator-like access to token stream with lookahead
 * and backtracking capabilities for parsing strategies.
 */

import { Token, TokenType, Position } from '../types/core-types';

export class TokenStream {
    private tokens: Token[];
    private position: number = 0;
    private marks: number[] = []; // Stack for backtracking

    constructor(tokens: Token[]) {
        // Filter out whitespace and comments by default
        this.tokens = tokens.filter(t =>
            t.type !== 'WHITESPACE' && t.type !== 'COMMENT'
        );
    }

    /**
     * Get current token without advancing
     */
    current(): Token {
        return this.tokens[this.position] || this.createEOF();
    }

    /**
     * Look ahead N tokens without advancing
     */
    peek(offset: number = 0): Token {
        const idx = this.position + offset;
        return this.tokens[idx] || this.createEOF();
    }

    /**
     * Advance to next token and return current
     */
    advance(): Token {
        const token = this.current();
        if (this.position < this.tokens.length) {
            this.position++;
        }
        return token;
    }

    /**
     * Check if at end of stream
     */
    isAtEnd(): boolean {
        return this.position >= this.tokens.length ||
            this.current().type === 'EOF';
    }

    /**
     * Check if current token matches type
     */
    check(type: TokenType): boolean {
        return this.current().type === type;
    }

    /**
     * Check if current token matches value (case-insensitive for keywords)
     */
    checkValue(value: string): boolean {
        const token = this.current();
        return token.value.toUpperCase() === value.toUpperCase();
    }

    /**
     * Check if current is one of the given keyword values
     */
    checkAny(...values: string[]): boolean {
        const upper = this.current().value.toUpperCase();
        return values.some(v => v.toUpperCase() === upper);
    }

    /**
     * Match and advance if current token matches type
     */
    match(type: TokenType): boolean {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * Match and advance if current token matches value
     */
    matchValue(value: string): boolean {
        if (this.checkValue(value)) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * Match any of the given values
     */
    matchAny(...values: string[]): Token | null {
        if (this.checkAny(...values)) {
            return this.advance();
        }
        return null;
    }

    /**
     * Expect a specific token type, throw if not found
     */
    expect(type: TokenType, message?: string): Token {
        if (!this.check(type)) {
            throw new Error(
                message ||
                `Expected ${type} but got ${this.current().type} (${this.current().value})`
            );
        }
        return this.advance();
    }

    /**
     * Expect a specific value
     */
    expectValue(value: string, message?: string): Token {
        if (!this.checkValue(value)) {
            throw new Error(
                message ||
                `Expected '${value}' but got '${this.current().value}'`
            );
        }
        return this.advance();
    }

    /**
     * Mark current position for potential backtracking
     */
    mark(): void {
        this.marks.push(this.position);
    }

    /**
     * Backtrack to last marked position
     */
    reset(): void {
        const pos = this.marks.pop();
        if (pos !== undefined) {
            this.position = pos;
        }
    }

    /**
     * Discard last mark (commit to current position)
     */
    commit(): void {
        this.marks.pop();
    }

    /**
     * Get current position in stream
     */
    getPosition(): number {
        return this.position;
    }

    /**
     * Set position in stream
     */
    setPosition(pos: number): void {
        this.position = Math.max(0, Math.min(pos, this.tokens.length));
    }

    /**
     * Get all tokens from current position to delimiter
     */
    collectUntil(delimiter: string): Token[] {
        const collected: Token[] = [];
        while (!this.isAtEnd() && !this.checkValue(delimiter)) {
            collected.push(this.advance());
        }
        return collected;
    }

    /**
     * Skip tokens until a specific value is found
     */
    skipUntil(value: string): void {
        while (!this.isAtEnd() && !this.checkValue(value)) {
            this.advance();
        }
    }

    /**
     * Collect all tokens within balanced parentheses
     */
    collectParenthesized(): Token[] {
        const collected: Token[] = [];
        let depth = 0;

        if (this.checkValue('(')) {
            collected.push(this.advance());
            depth = 1;
        } else {
            return collected;
        }

        while (!this.isAtEnd() && depth > 0) {
            const token = this.advance();
            collected.push(token);

            if (token.value === '(') depth++;
            else if (token.value === ')') depth--;
        }

        return collected;
    }

    /**
     * Get the raw SQL text between two positions
     */
    getTextBetween(start: number, end: number): string {
        return this.tokens
            .slice(start, end)
            .map(t => t.raw || t.value)
            .join(' ');
    }

    /**
     * Get remaining tokens
     */
    remaining(): Token[] {
        return this.tokens.slice(this.position);
    }

    /**
     * Get all tokens as array
     */
    all(): Token[] {
        return [...this.tokens];
    }

    /**
     * Create stream for a subset of tokens
     */
    slice(start: number, end: number): TokenStream {
        return new TokenStream(this.tokens.slice(start, end));
    }

    /**
     * Find next occurrence of value
     */
    findNext(value: string): number {
        for (let i = this.position; i < this.tokens.length; i++) {
            if (this.tokens[i].value.toUpperCase() === value.toUpperCase()) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Check if sequence of values matches starting from current position
     */
    matchSequence(...values: string[]): boolean {
        for (let i = 0; i < values.length; i++) {
            const token = this.peek(i);
            if (token.value.toUpperCase() !== values[i].toUpperCase()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get source position of current token
     */
    currentPosition(): Position {
        return this.current().position;
    }

    private createEOF(): Token {
        const lastToken = this.tokens[this.tokens.length - 1];
        return {
            type: 'EOF',
            value: '',
            position: lastToken?.position || { line: 1, column: 1, offset: 0 },
            context: {
                parenthesesDepth: 0,
                bracketDepth: 0,
                braceDepth: 0,
                inFunction: false,
                inString: false,
            },
        };
    }
}

/**
 * Create a token stream from tokens
 */
export function createTokenStream(tokens: Token[]): TokenStream {
    return new TokenStream(tokens);
}
