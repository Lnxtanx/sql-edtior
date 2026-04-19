/**
 * Core Types for PostgreSQL Parser v2
 * 
 * Fundamental type definitions used across all parser phases
 */

// =============================================================================
// Token Types
// =============================================================================

export type TokenType =
    | 'KEYWORD'
    | 'IDENTIFIER'
    | 'QUOTED_IDENTIFIER'
    | 'STRING'
    | 'DOLLAR_STRING'
    | 'NUMBER'
    | 'OPERATOR'
    | 'SYMBOL'
    | 'DELIMITER'
    | 'COMMENT'
    | 'WHITESPACE'
    | 'EOF';

export interface Position {
    line: number;
    column: number;
    offset: number;
}

export interface TokenContext {
    parenthesesDepth: number;
    bracketDepth: number;
    braceDepth: number;
    inFunction: boolean;
    inString: boolean;
    stringDelimiter?: string;
}

// =============================================================================
// Symbol Registry
// =============================================================================

export type SymbolType =
    | 'DEPENDS_ON'        // A -> Depends on -> B (e.g., View requires Table, Function uses Type)
    | 'HAS_SEQUENCE'      // Table.Column -> Uses -> Sequence
    | 'OWNS_POLICY'       // Role -> Owns -> Policy
    | 'APPLIES_TO'        // Policy -> Applies to -> Table
    | string;             // Extendable for AI/custom relationship

export interface Symbol {
    name: string;
    type: SymbolType;
    schema: string;
    fullName: string;
    object: any;
    verificationLevel: 'DEFINITIVE' | 'HEURISTIC' | 'INFERRED';
    position?: Position;
}

export interface Token {
    type: TokenType;
    value: string;
    position: Position;
    context: TokenContext;
    raw?: string; // Original text before normalization
}

// =============================================================================
// Data Type Categories
// =============================================================================

export type DataTypeCategory =
    | 'numeric'
    | 'text'
    | 'boolean'
    | 'datetime'
    | 'uuid'
    | 'json'
    | 'array'
    | 'binary'
    | 'enum'
    | 'range'
    | 'network'
    | 'geometry'
    | 'hstore'
    | 'composite'
    | 'other';

// =============================================================================
// Schema Objects
// =============================================================================

export interface Column {
    name: string;
    type: string;
    typeCategory: DataTypeCategory;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isUnique: boolean;
    isGenerated: boolean;
    generatedExpression?: string;
    /** PG 18 adds VIRTUAL generated columns. Defaults to 'STORED' for PG <18. */
    generatedType?: 'STORED' | 'VIRTUAL';
    defaultValue?: string;
    checkConstraint?: string;
    references?: ForeignKeyReference;
    comment?: string;
}

export interface ForeignKeyReference {
    schema?: string;
    table: string;
    column: string;
    onDelete?: string;
    onUpdate?: string;
}

export interface Table {
    name: string;
    schema?: string;
    columns: Column[];
    isPartitioned: boolean;
    partitionType?: 'range' | 'list' | 'hash';
    partitionKey?: string[];
    partitionOf?: string; // Parent table for child partitions
    partitionBounds?: { from?: string; to?: string; in?: string[] };
    inheritsFrom?: string;
    isTemporary: boolean;
    isUnlogged: boolean;
    checkConstraints: NamedConstraint[];
    uniqueConstraints: NamedConstraint[];
    comment?: string;
    confidence: number; // 0-1 parsing confidence
    verificationLevel?: VerificationLevel;
    rlsEnabled?: boolean;
}

export interface NamedConstraint {
    name?: string;
    columns?: string[];
    expression?: string;
}

export interface Index {
    name: string;
    schema?: string;
    table: string;
    columns: string[];
    type: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
    isUnique: boolean;
    isPartial: boolean;
    whereClause?: string;
    includeColumns: string[];
}

export interface View {
    name: string;
    schema?: string;
    isMaterialized: boolean;
    isRecursive: boolean;
    query?: string;
    columns?: string[];
    comment?: string;
    verificationLevel?: VerificationLevel;
}

export interface PostgresFunction {
    name: string;
    schema?: string;
    language: string;
    returnType?: string;
    isProcedure: boolean;
    parameters?: FunctionParameter[];
    body?: string;
    volatility?: 'VOLATILE' | 'STABLE' | 'IMMUTABLE';
}

export interface FunctionParameter {
    name?: string;
    type: string;
    mode?: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC';
    default?: string;
}

export interface Trigger {
    name: string;
    schema?: string;
    table: string;
    timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
    events: string[];
    level: 'ROW' | 'STATEMENT';
    functionName?: string;
    functionSchema?: string;
    condition?: string;
}

export interface Policy {
    name: string;
    schema?: string;
    table: string;
    command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    permissive: boolean;
    roles?: string[];
    usingExpression?: string;
    checkExpression?: string;
}

export interface Extension {
    name: string;
    version?: string;
    schema?: string;
}

export interface EnumType {
    name: string;
    schema?: string;
    values: string[];
}

export interface CompositeType {
    name: string;
    schema?: string;
    attributes: { name: string; type: string }[];
}

export interface Domain {
    name: string;
    schema?: string;
    baseType: string;
    notNull?: boolean;
    default?: string;
    checkExpression?: string;
}

export interface Sequence {
    name: string;
    schema?: string;
    dataType?: string;
    start?: number;
    increment?: number;
    minValue?: number;
    maxValue?: number;
    cycle?: boolean;
}

export interface Role {
    name: string;
    isSuperuser?: boolean;
    canLogin?: boolean;
    canCreateDb?: boolean;
    canCreateRole?: boolean;
    inherit?: boolean;
    bypassRls?: boolean;
    connectionLimit?: number;
    validUntil?: string;
    inRoles?: string[];
    roles?: string[];
    adminRoles?: string[];
}

// =============================================================================
// Relationships
// =============================================================================

export type RelationshipType =
    | 'FOREIGN_KEY'
    | 'PARTITION_CHILD'
    | 'VIEW_DEPENDENCY'
    | 'TRIGGER_TARGET'
    | 'TRIGGER_FUNCTION'
    | 'POLICY_TARGET'
    | 'CALLS'
    | 'DEPENDS_ON'
    | 'OWNS_POLICY'
    | 'APPLIES_TO'
    | 'HAS_SEQUENCE'
    | 'INFERRED';

export type Cardinality = '1:1' | '1:N' | 'N:M' | 'UNKNOWN';

export interface Relationship {
    id: string;
    source: {
        schema?: string;
        table: string;
        column?: string;
    };
    target: {
        schema?: string;
        table: string;
        column?: string;
    };
    type: RelationshipType;
    cardinality?: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY' | 'UNKNOWN';
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

    /** Metadata about the reliability of this relationship */
    sourceType?: 'EXPLICIT_FK' | 'INFERRED_VIEW' | 'INFERRED_TRIGGER' | 'PARSER_MATCH';
    confidence: number; // 0.0 - 1.0
    metadata?: {
        isFuzzyMatch?: boolean;
        matchMethod?: 'regex' | 'ast';
    };
    annotations?: string[];
}

// =============================================================================
// Schema Statistics
// =============================================================================

export interface PostgresStats {
    dataTypes: Map<DataTypeCategory, number>;
    primaryKeys: number;
    foreignKeys: number;
    uniqueConstraints: number;
    checkConstraints: number;
    notNullConstraints: number;
    indexTypes: Map<string, number>;
    generatedColumns: number;
    defaultValues: number;
    partitionedTables: number;
    childPartitions: number;
    temporaryTables: number;
    inheritedTables: number;
    rlsPolicies: number;
}

// =============================================================================
// Errors & Warnings
// =============================================================================

export type ErrorLevel = 'ERROR' | 'WARNING' | 'SUGGESTION' | 'INFO';

export type ErrorCode =
    | 'PARSE_ERROR'
    | 'TOKENIZE_ERROR'
    | 'FK_UNRESOLVED'
    | 'TYPE_UNKNOWN'
    | 'TABLE_UNKNOWN'
    | 'SCHEMA_UNKNOWN'
    | 'CIRCULAR_DEPENDENCY'
    | 'DUPLICATE_NAME'
    | 'CONSTRAINT_INVALID'
    | 'SYNTAX_ERROR'
    | 'INCOMPLETE_PARSE';

export interface ParserError {
    level: ErrorLevel;
    code: ErrorCode;
    message: string;
    position?: Position;
    endPosition?: Position;
    statement?: string;
    suggestion?: string;
    recovery?: 'SKIP_TOKEN' | 'SKIP_STATEMENT' | 'SKIP_CONSTRUCT' | 'CONTINUE';
    affectedObject?: string; // e.g., "public.users"
}

export type VerificationLevel = 'DEFINITIVE' | 'HEURISTIC' | 'INFERRED';

// =============================================================================
// Statement Types
// =============================================================================

export type StatementType =
    | 'CREATE_TABLE'
    | 'CREATE_TABLE_PARTITION'
    | 'CREATE_INDEX'
    | 'CREATE_VIEW'
    | 'CREATE_MATERIALIZED_VIEW'
    | 'CREATE_FUNCTION'
    | 'CREATE_PROCEDURE'
    | 'CREATE_TRIGGER'
    | 'CREATE_POLICY'
    | 'CREATE_ENUM'
    | 'CREATE_TYPE'
    | 'CREATE_DOMAIN'
    | 'CREATE_SEQUENCE'
    | 'CREATE_SCHEMA'
    | 'CREATE_EXTENSION'
    | 'CREATE_ROLE'
    | 'ALTER_TABLE'
    | 'DROP_TABLE'
    | 'COMMENT'
    | 'GRANT'
    | 'REVOKE'
    | 'SET'
    | 'UNKNOWN';

export interface StatementInfo {
    text: string;
    type: StatementType;
    tokens: Token[];
    namespace: {
        schemaName?: string;
        objectName?: string;
        objectType?: string;
        temporary?: boolean;
        ifNotExists?: boolean;
        orReplace?: boolean;
    };
    dependencies: {
        schemas: string[];
        tables: string[];
        types: string[];
        functions: string[];
    };
    position: Position;
    confidence: number;
}

// =============================================================================
// Final Output
// =============================================================================

export interface ParsedSchema {
    tables: Table[];
    relationships: Relationship[];
    enums: Map<string, string[]>;
    enumTypes: EnumType[];
    views: View[];
    triggers: Trigger[];
    indexes: Index[];
    sequences: Sequence[];
    functions: PostgresFunction[];
    policies: Policy[];
    extensions: Extension[];
    schemas: string[];
    domains: Domain[];
    compositeTypes: CompositeType[];
    roles: Role[];
    stats: PostgresStats;
    errors: ParserError[];
    warnings: ParserError[];
    parseTime?: number;
    confidence: number; // Overall parse confidence
}

// =============================================================================
// Parse Context (shared state)
// =============================================================================

export interface ParseOptions {
    /** Include comments in output */
    includeComments?: boolean;
    /** Strict mode - fail on first error */
    strict?: boolean;
    /** Default schema when not specified */
    defaultSchema?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Maximum statements to parse (for huge files) */
    maxStatements?: number;
}

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
    includeComments: false,
    strict: false,
    defaultSchema: 'public',
    debug: false,
    maxStatements: 10000,
};
