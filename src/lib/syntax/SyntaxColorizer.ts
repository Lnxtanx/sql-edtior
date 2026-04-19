/**
 * SQL Syntax Colorizer
 * 
 * Converts raw SQL text into an array of colored spans using the existing tokenizer.
 * This provides accurate, token-based syntax highlighting for PostgreSQL.
 */

import { tokenize } from '../sql-parser/core/tokenizer';
import { Token, TokenType, Position } from '../sql-parser/types/core-types';
import { getTokenClass } from './token-classes';

/**
 * A span of colored text for rendering
 */
export interface ColorizedSpan {
    /** The text content of this span */
    text: string;

    /** CSS class(es) to apply */
    className: string;

    /** Token type for additional handling */
    type: TokenType;

    /** Starting position in the source (1-indexed) */
    start: {
        line: number;
        column: number;
        offset: number;
    };

    /** Ending position in the source (1-indexed) */
    end: {
        line: number;
        column: number;
        offset: number;
    };
}

/**
 * A line of colored spans for rendering
 */
export interface ColorizedLine {
    /** Line number (1-indexed) */
    lineNumber: number;

    /** Spans in this line */
    spans: ColorizedSpan[];

    /** Full text of the line (for reference) */
    text: string;
}

/**
 * Result of colorizing SQL
 */
export interface ColorizeResult {
    /** Lines with colored spans */
    lines: ColorizedLine[];

    /** Total number of tokens processed */
    tokenCount: number;

    /** Time taken to colorize (ms) */
    colorizeTime: number;
}

/**
 * Compute the ending position of a token based on its value
 */
function computeEndPosition(token: Token): { line: number; column: number; offset: number } {
    const lines = token.value.split('\n');
    const lastLineLength = lines[lines.length - 1].length;

    if (lines.length === 1) {
        // Single line token
        return {
            line: token.position.line,
            column: token.position.column + token.value.length,
            offset: token.position.offset + token.value.length,
        };
    } else {
        // Multi-line token (comments, dollar strings)
        return {
            line: token.position.line + lines.length - 1,
            column: lastLineLength + 1,
            offset: token.position.offset + token.value.length,
        };
    }
}

/**
 * Convert a token to a colorized span
 */
function tokenToSpan(token: Token): ColorizedSpan {
    return {
        text: token.raw || token.value,
        className: getTokenClass(token.type, token.value),
        type: token.type,
        start: {
            line: token.position.line,
            column: token.position.column,
            offset: token.position.offset,
        },
        end: computeEndPosition(token),
    };
}

/**
 * Split multi-line spans into per-line spans
 */
function splitMultiLineSpan(span: ColorizedSpan): ColorizedSpan[] {
    const lines = span.text.split('\n');

    if (lines.length === 1) {
        return [span];
    }

    const result: ColorizedSpan[] = [];
    let currentLine = span.start.line;
    let currentOffset = span.start.offset;

    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i] + (i < lines.length - 1 ? '\n' : '');
        const isFirstLine = i === 0;
        const isLastLine = i === lines.length - 1;

        result.push({
            text: lines[i], // Don't include the newline in the text
            className: span.className,
            type: span.type,
            start: {
                line: currentLine,
                column: isFirstLine ? span.start.column : 1,
                offset: currentOffset,
            },
            end: {
                line: currentLine,
                column: isFirstLine ? span.start.column + lines[i].length : lines[i].length + 1,
                offset: currentOffset + lineText.length,
            },
        });

        currentLine++;
        currentOffset += lineText.length;
    }

    return result;
}

/**
 * Colorize SQL text into an array of lines with colored spans
 */
export function colorizeSQL(sql: string): ColorizeResult {
    const startTime = performance.now();

    // Handle empty input
    if (!sql) {
        return {
            lines: [],
            tokenCount: 0,
            colorizeTime: 0,
        };
    }

    // Tokenize the SQL
    const tokens = tokenize(sql);

    // Convert tokens to spans, splitting multi-line tokens
    const allSpans: ColorizedSpan[] = [];
    for (const token of tokens) {
        if (token.type === 'EOF') continue;

        const span = tokenToSpan(token);
        const splitSpans = splitMultiLineSpan(span);
        allSpans.push(...splitSpans);
    }

    // Group spans by line
    const lineMap = new Map<number, ColorizedSpan[]>();
    const sqlLines = sql.split('\n');

    // Initialize all lines
    for (let i = 0; i < sqlLines.length; i++) {
        lineMap.set(i + 1, []);
    }

    // Assign spans to lines
    for (const span of allSpans) {
        const lineSpans = lineMap.get(span.start.line);
        if (lineSpans) {
            lineSpans.push(span);
        }
    }

    // Build the result
    const lines: ColorizedLine[] = [];
    for (let i = 0; i < sqlLines.length; i++) {
        const lineNumber = i + 1;
        const spans = lineMap.get(lineNumber) || [];

        // Sort spans by column position
        spans.sort((a, b) => a.start.column - b.start.column);

        // Fill gaps with whitespace spans
        const filledSpans = fillWhitespaceGaps(spans, sqlLines[i], lineNumber);

        lines.push({
            lineNumber,
            spans: filledSpans,
            text: sqlLines[i],
        });
    }

    const endTime = performance.now();

    return {
        lines,
        tokenCount: tokens.length - 1, // Exclude EOF
        colorizeTime: endTime - startTime,
    };
}

/**
 * Fill gaps between spans with whitespace
 */
function fillWhitespaceGaps(
    spans: ColorizedSpan[],
    lineText: string,
    lineNumber: number
): ColorizedSpan[] {
    if (spans.length === 0) {
        // Empty line or line with only whitespace
        if (lineText.length > 0) {
            return [{
                text: lineText,
                className: '',
                type: 'WHITESPACE',
                start: { line: lineNumber, column: 1, offset: 0 },
                end: { line: lineNumber, column: lineText.length + 1, offset: lineText.length },
            }];
        }
        return [];
    }

    const result: ColorizedSpan[] = [];
    let currentColumn = 1;

    for (const span of spans) {
        // Add whitespace gap if needed
        if (span.start.column > currentColumn) {
            const gapText = lineText.substring(currentColumn - 1, span.start.column - 1);
            if (gapText) {
                result.push({
                    text: gapText,
                    className: '',
                    type: 'WHITESPACE',
                    start: { line: lineNumber, column: currentColumn, offset: 0 },
                    end: { line: lineNumber, column: span.start.column, offset: 0 },
                });
            }
        }

        result.push(span);
        currentColumn = span.end.column;
    }

    // Add trailing whitespace if needed
    if (currentColumn <= lineText.length) {
        const trailingText = lineText.substring(currentColumn - 1);
        if (trailingText) {
            result.push({
                text: trailingText,
                className: '',
                type: 'WHITESPACE',
                start: { line: lineNumber, column: currentColumn, offset: 0 },
                end: { line: lineNumber, column: lineText.length + 1, offset: 0 },
            });
        }
    }

    return result;
}

/**
 * Get a simple colored HTML string for a single line (for debugging/preview)
 */
export function colorizeToHTML(sql: string): string {
    const result = colorizeSQL(sql);

    return result.lines.map(line => {
        const lineHtml = line.spans.map(span => {
            if (!span.className) {
                return escapeHtml(span.text);
            }
            return `<span class="${span.className}">${escapeHtml(span.text)}</span>`;
        }).join('');

        return lineHtml;
    }).join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
