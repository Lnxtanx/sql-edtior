/**
 * Phase 2: Statement Splitter
 * 
 * Uses token stream to intelligently split SQL into individual statements.
 * Handles semicolons within function bodies, strings, and complex constructs.
 */

import { Token, TokenType, Position, StatementInfo, StatementType } from '../types/core-types';

/**
 * Determine statement type from token sequence
 */
function identifyStatementType(tokens: Token[]): StatementType {
    const firstKeywords: string[] = [];

    // Collect first few keywords
    for (const token of tokens) {
        if (token.type === 'KEYWORD') {
            firstKeywords.push(token.value.toUpperCase());
            if (firstKeywords.length >= 4) break;
        }
    }

    const sequence = firstKeywords.join(' ');

    // Match against known patterns
    if (sequence.startsWith('CREATE TABLE') && sequence.includes('PARTITION OF')) {
        return 'CREATE_TABLE_PARTITION';
    }
    if (sequence.startsWith('CREATE TABLE')) return 'CREATE_TABLE';
    if (sequence.startsWith('CREATE MATERIALIZED VIEW')) return 'CREATE_MATERIALIZED_VIEW';
    if (sequence.startsWith('CREATE VIEW') || sequence.startsWith('CREATE OR REPLACE VIEW')) return 'CREATE_VIEW';
    if (sequence.includes('CREATE INDEX') || sequence.includes('CREATE UNIQUE INDEX')) return 'CREATE_INDEX';
    if (sequence.startsWith('CREATE FUNCTION') || sequence.startsWith('CREATE OR REPLACE FUNCTION')) return 'CREATE_FUNCTION';
    if (sequence.startsWith('CREATE PROCEDURE') || sequence.startsWith('CREATE OR REPLACE PROCEDURE')) return 'CREATE_PROCEDURE';
    if (sequence.startsWith('CREATE TRIGGER')) return 'CREATE_TRIGGER';
    if (sequence.startsWith('CREATE POLICY')) return 'CREATE_POLICY';
    if (sequence.startsWith('CREATE TYPE') && tokens.some(t => t.value.toUpperCase() === 'ENUM')) return 'CREATE_ENUM';
    if (sequence.startsWith('CREATE TYPE')) return 'CREATE_TYPE';
    if (sequence.startsWith('CREATE DOMAIN')) return 'CREATE_DOMAIN';
    if (sequence.startsWith('CREATE SEQUENCE')) return 'CREATE_SEQUENCE';
    if (sequence.startsWith('CREATE SCHEMA')) return 'CREATE_SCHEMA';
    if (sequence.startsWith('CREATE EXTENSION')) return 'CREATE_EXTENSION';
    if (sequence.startsWith('CREATE ROLE') || sequence.startsWith('CREATE USER')) return 'CREATE_ROLE';
    if (sequence.startsWith('ALTER TABLE')) return 'ALTER_TABLE';
    if (sequence.startsWith('DROP TABLE')) return 'DROP_TABLE';
    if (sequence.startsWith('COMMENT ON')) return 'COMMENT';
    if (sequence.startsWith('GRANT')) return 'GRANT';
    if (sequence.startsWith('REVOKE')) return 'REVOKE';
    if (sequence.startsWith('SET')) return 'SET';

    return 'UNKNOWN';
}

/**
 * Extract namespace info (schema, object name, modifiers)
 */
function extractNamespace(tokens: Token[], stmtType: StatementType): StatementInfo['namespace'] {
    const result: StatementInfo['namespace'] = {};

    // Track modifiers
    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        if (token.type !== 'KEYWORD') {
            i++;
            continue;
        }

        const val = token.value.toUpperCase();

        if (val === 'TEMPORARY' || val === 'TEMP') {
            result.temporary = true;
            i++;
            continue;
        }

        if (val === 'IF' && tokens[i + 1]?.value.toUpperCase() === 'NOT' &&
            tokens[i + 2]?.value.toUpperCase() === 'EXISTS') {
            result.ifNotExists = true;
            i += 3;
            continue;
        }

        if (val === 'OR' && tokens[i + 1]?.value.toUpperCase() === 'REPLACE') {
            result.orReplace = true;
            i += 2;
            continue;
        }

        // After CREATE, TABLE, FUNCTION, etc. comes the name
        if (['TABLE', 'VIEW', 'INDEX', 'FUNCTION', 'PROCEDURE', 'TRIGGER',
            'POLICY', 'TYPE', 'DOMAIN', 'SEQUENCE', 'SCHEMA', 'EXTENSION'].includes(val)) {
            result.objectType = val;

            // Look for name after object type
            let j = i + 1;
            while (j < tokens.length && tokens[j].type !== 'IDENTIFIER' &&
                tokens[j].type !== 'QUOTED_IDENTIFIER') {
                j++;
            }

            if (j < tokens.length) {
                const nameToken = tokens[j];

                // Check for schema.name pattern
                if (tokens[j + 1]?.value === '.' && tokens[j + 2]) {
                    result.schemaName = nameToken.value;
                    result.objectName = tokens[j + 2].value;
                } else {
                    result.objectName = nameToken.value;
                }
            }
            break;
        }

        i++;
    }

    return result;
}

/**
 * Extract dependencies (referenced schemas, tables, types, functions)
 */
function extractDependencies(tokens: Token[]): StatementInfo['dependencies'] {
    const deps: StatementInfo['dependencies'] = {
        schemas: [],
        tables: [],
        types: [],
        functions: [],
    };

    const seen = new Set<string>();

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // REFERENCES table(col) - Foreign key
        if (token.value.toUpperCase() === 'REFERENCES' && tokens[i + 1]) {
            let tableName = tokens[i + 1].value;

            // Handle schema.table
            if (tokens[i + 2]?.value === '.' && tokens[i + 3]) {
                const schemaName = tableName;
                tableName = `${schemaName}.${tokens[i + 3].value}`;
                if (!deps.schemas.includes(schemaName)) {
                    deps.schemas.push(schemaName);
                }
            }

            if (!seen.has(tableName)) {
                deps.tables.push(tableName);
                seen.add(tableName);
            }
        }

        // PARTITION OF parent_table
        if (token.value.toUpperCase() === 'OF' &&
            i > 0 && tokens[i - 1]?.value.toUpperCase() === 'PARTITION') {
            if (tokens[i + 1]) {
                let tableName = tokens[i + 1].value;
                if (tokens[i + 2]?.value === '.' && tokens[i + 3]) {
                    tableName = `${tableName}.${tokens[i + 3].value}`;
                }
                if (!seen.has(tableName)) {
                    deps.tables.push(tableName);
                    seen.add(tableName);
                }
            }
        }

        // INHERITS (parent)
        if (token.value.toUpperCase() === 'INHERITS' && tokens[i + 1]?.value === '(') {
            let j = i + 2;
            while (j < tokens.length && tokens[j].value !== ')') {
                if (tokens[j].type === 'IDENTIFIER' || tokens[j].type === 'QUOTED_IDENTIFIER') {
                    let tableName = tokens[j].value;
                    if (tokens[j + 1]?.value === '.' && tokens[j + 2]) {
                        tableName = `${tableName}.${tokens[j + 2].value}`;
                        j += 2;
                    }
                    if (!seen.has(tableName)) {
                        deps.tables.push(tableName);
                        seen.add(tableName);
                    }
                }
                j++;
            }
        }

        // EXECUTE FUNCTION or EXECUTE PROCEDURE
        if (token.value.toUpperCase() === 'EXECUTE' && tokens[i + 1]) {
            const next = tokens[i + 1];
            if (next.value.toUpperCase() === 'FUNCTION' || next.value.toUpperCase() === 'PROCEDURE') {
                if (tokens[i + 2]) {
                    let funcName = tokens[i + 2].value;
                    if (tokens[i + 3]?.value === '.' && tokens[i + 4]) {
                        funcName = `${funcName}.${tokens[i + 4].value}`;
                    }
                    deps.functions.push(funcName);
                }
            }
        }

        // Schema-qualified identifier (schema.object)
        if ((token.type === 'IDENTIFIER' || token.type === 'QUOTED_IDENTIFIER') &&
            tokens[i + 1]?.value === '.' &&
            (tokens[i + 2]?.type === 'IDENTIFIER' || tokens[i + 2]?.type === 'QUOTED_IDENTIFIER')) {
            const schemaName = token.value;
            if (!deps.schemas.includes(schemaName) && schemaName.toLowerCase() !== 'public') {
                deps.schemas.push(schemaName);
            }
        }
    }

    return deps;
}

/**
 * Split token stream into individual statements
 */
export function splitStatements(tokens: Token[]): StatementInfo[] {
    const statements: StatementInfo[] = [];
    let currentTokens: Token[] = [];
    let startPosition: Position = { line: 1, column: 1, offset: 0 };

    // Track nesting for proper splitting
    let parenDepth = 0;
    let inDollarString = false;

    for (const token of tokens) {
        if (token.type === 'EOF') break;

        // Track parenthesis depth
        if (token.value === '(') parenDepth++;
        if (token.value === ')') parenDepth = Math.max(0, parenDepth - 1);

        // Track dollar strings
        if (token.type === 'DOLLAR_STRING') {
            currentTokens.push(token);
            continue;
        }

        // Statement delimiter (semicolon at depth 0)
        if (token.value === ';' && parenDepth === 0 && !inDollarString) {
            if (currentTokens.length > 0) {
                const stmtType = identifyStatementType(currentTokens);
                const namespace = extractNamespace(currentTokens, stmtType);
                const dependencies = extractDependencies(currentTokens);

                statements.push({
                    text: joinTokensSmartly(currentTokens),
                    type: stmtType,
                    tokens: currentTokens,
                    namespace,
                    dependencies,
                    position: startPosition,
                    confidence: 1.0,
                });

                currentTokens = [];
            }
            continue;
        }

        // Start tracking position for new statement
        if (currentTokens.length === 0) {
            startPosition = token.position;
        }

        currentTokens.push(token);
    }

    // Handle final statement without trailing semicolon
    if (currentTokens.length > 0) {
        const stmtType = identifyStatementType(currentTokens);
        const namespace = extractNamespace(currentTokens, stmtType);
        const dependencies = extractDependencies(currentTokens);

        statements.push({
            text: joinTokensSmartly(currentTokens),
            type: stmtType,
            tokens: currentTokens,
            namespace,
            dependencies,
            position: startPosition,
            confidence: 0.9, // Slightly lower confidence for no semicolon
        });
    }

    return statements;
}

/**
 * Join tokens smartly, not adding spaces around punctuation
 * Preserves newlines after line comments so comment removal regex works correctly
 */
function joinTokensSmartly(tokens: Token[]): string {
    let result = '';
    const noSpaceBefore = new Set(['.', ',', ')', ']', '::', ';']);
    const noSpaceAfter = new Set(['.', '(', '[', '::']);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const value = token.raw || token.value;
        const prev = i > 0 ? (tokens[i - 1].raw || tokens[i - 1].value) : null;
        const prevToken = i > 0 ? tokens[i - 1] : null;

        // After a line comment (--), we need a newline so comment removal works
        if (prevToken && prevToken.type === 'COMMENT' && prevToken.value.startsWith('--')) {
            result += '\n';
        } else if (i > 0 && !noSpaceBefore.has(value) && !noSpaceAfter.has(prev!)) {
            result += ' ';
        }

        result += value;
    }

    return result;
}
