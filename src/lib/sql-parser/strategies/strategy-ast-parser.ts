/**
 * Strategy A: AST Parser Wrapper
 * 
 * Wraps pgsql-ast-parser with error handling.
 * Falls back gracefully when AST parser fails on unsupported syntax.
 */

import { parse, Statement } from 'pgsql-ast-parser';
import {
    Token,
    Table,
    Column,
    Index,
    View,
    Trigger,
    PostgresFunction,
    Policy,
    EnumType,
    Sequence,
    Extension,
    DataTypeCategory,
    StatementInfo,
    ForeignKeyReference,
    NamedConstraint,
} from '../types/core-types';
import { ParseContext } from '../context/parse-context';
import { extractViewDependencies } from '../core/ast-visitor';

// =============================================================================
// Data Type Categorization
// =============================================================================

function categorizeDataType(typeName: string): DataTypeCategory {
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
    if (t === 'uuid') {
        return 'uuid';
    }
    if (/^(json|jsonb|json_scalar|json_table)/.test(t)) {
        return 'json';
    }
    if (t.endsWith('[]')) {
        return 'array';
    }
    if (t === 'bytea') {
        return 'binary';
    }
    if (t === 'hstore') {
        return 'hstore';
    }
    if (/range$/.test(t)) {
        return 'range';
    }
    if (/multirange$/.test(t)) {
        return 'range';
    }
    if (/^(inet|cidr|macaddr|macaddr8)/.test(t)) {
        return 'network';
    }
    if (/^(geometry|geography|point|line|lseg|box|path|polygon|circle)/.test(t)) {
        return 'geometry';
    }
    if (/^(tsvector|tsquery)/.test(t)) {
        return 'text';
    }
    if (/^(xml)/.test(t)) {
        return 'text';
    }

    return 'other';
}

// =============================================================================
// Type Extraction Helpers
// =============================================================================

function extractTypeName(dataType: any): string {
    if (!dataType) return 'unknown';
    if (typeof dataType === 'string') return dataType;

    if (dataType.kind === 'array') {
        return `${extractTypeName(dataType.arrayOf)}[]`;
    }

    if (dataType.name) {
        let typeName = dataType.name;
        if (dataType.config?.length) {
            typeName += `(${dataType.config.join(', ')})`;
        }
        return typeName;
    }

    return 'unknown';
}

function extractDefaultValue(defaultExpr: any): string | undefined {
    if (!defaultExpr) return undefined;

    if (defaultExpr.type === 'call') {
        const funcName = defaultExpr.function?.name || 'function';
        return `${funcName}()`;
    }

    if (['string', 'integer', 'numeric'].includes(defaultExpr.type)) {
        return String(defaultExpr.value);
    }

    if (defaultExpr.type === 'boolean') {
        return defaultExpr.value ? 'true' : 'false';
    }

    if (defaultExpr.type === 'keyword') {
        return defaultExpr.keyword;
    }

    return 'default';
}

// =============================================================================
// AST Statement Parsing
// =============================================================================

export interface AstParseResult {
    success: boolean;
    tables?: Table[];
    indexes?: Index[];
    views?: View[];
    triggers?: Trigger[];
    functions?: PostgresFunction[];
    policies?: Policy[];
    enums?: EnumType[];
    sequences?: Sequence[];
    extensions?: Extension[];
    schemas?: string[];
    error?: string;
}

/**
 * Try to parse a single statement using pgsql-ast-parser
 */
export function tryAstParse(
    statement: StatementInfo,
    context: ParseContext
): AstParseResult {
    try {
        // Clean the statement text
        const cleanedSql = statement.text
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();

        if (!cleanedSql) {
            return { success: true };
        }

        // Add semicolon if missing
        const sqlToParse = cleanedSql.endsWith(';') ? cleanedSql : cleanedSql + ';';

        const statements = parse(sqlToParse);
        const result: AstParseResult = { success: true };

        for (const stmt of statements) {
            parseAstStatement(stmt, context, result);
        }

        return result;
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'AST parse failed',
        };
    }
}

/**
 * Parse individual AST statement
 */
function parseAstStatement(
    stmt: Statement,
    context: ParseContext,
    result: AstParseResult
): void {
    const stmtAny = stmt as any;

    switch (stmt.type) {
        case 'create table':
            parseCreateTable(stmtAny, context, result);
            break;

        case 'create enum':
            parseCreateEnum(stmtAny, context, result);
            break;

        case 'create view':
            parseCreateView(stmtAny, context, result);
            break;

        case 'create materialized view':
            parseCreateView(stmtAny, context, result, true);
            break;

        case 'create index':
            parseCreateIndex(stmtAny, context, result);
            break;

        case 'create sequence':
            parseCreateSequence(stmtAny, context, result);
            break;

        case 'create function':
            parseCreateFunction(stmtAny, context, result);
            break;

        default:
            // Handle other statement types as needed
            if (stmtAny.type === 'create trigger') {
                parseCreateTrigger(stmtAny, context, result);
            } else if (stmtAny.type === 'create schema') {
                parseCreateSchema(stmtAny, result);
            } else if (stmtAny.type === 'create extension') {
                parseCreateExtension(stmtAny, result);
            } else if (stmtAny.type === 'create policy') {
                parseCreatePolicy(stmtAny, context, result);
            }
    }
}

// =============================================================================
// Individual Statement Parsers
// =============================================================================

function parseCreateTable(
    stmt: any,
    context: ParseContext,
    result: AstParseResult
): void {
    const tableName = stmt.name?.name || 'unknown_table';
    const schemaName = stmt.name?.schema;
    const fullName = context.qualifyName(tableName, schemaName);

    const table: Table = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        columns: [],
        isPartitioned: !!stmt.partition,
        partitionType: stmt.partition?.type?.toLowerCase(),
        partitionKey: stmt.partition?.columns?.map((c: any) => c.name || c),
        isTemporary: stmt.temporary === true,
        isUnlogged: stmt.unlogged === true,
        inheritsFrom: stmt.inherits?.[0]?.name,
        checkConstraints: [],
        uniqueConstraints: [],
        confidence: 1.0,
        verificationLevel: 'DEFINITIVE',
    };

    const pkCols = new Set<string>();
    const ukCols = new Set<string>();

    // Process columns
    for (const col of stmt.columns || []) {
        if (col.kind === 'column') {
            const column = parseColumn(col, pkCols, ukCols, context);
            table.columns.push(column);
        } else if (col.kind === 'constraint') {
            parseTableConstraint(col, table, pkCols, ukCols, context);
        }
    }

    // Process standalone constraints
    for (const constraint of stmt.constraints || []) {
        parseTableConstraint(constraint, table, pkCols, ukCols, context);
    }

    // Apply PK/UK flags
    for (const colName of pkCols) {
        const col = table.columns.find(c => c.name === colName);
        if (col) {
            col.isPrimaryKey = true;
            col.nullable = false;
        }
    }

    for (const colName of ukCols) {
        const col = table.columns.find(c => c.name === colName);
        if (col) {
            col.isUnique = true;
        }
    }

    // Register in context
    context.tables.set(fullName, table);
    context.defineSymbol(tableName, 'table', table, schemaName, 'DEFINITIVE');

    result.tables = result.tables || [];
    result.tables.push(table);
}

function parseColumn(
    col: any,
    pkCols: Set<string>,
    ukCols: Set<string>,
    context: ParseContext
): Column {
    const typeName = extractTypeName(col.dataType);

    const column: Column = {
        name: col.name?.name || col.name || 'unknown',
        type: typeName,
        typeCategory: categorizeDataType(typeName),
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isGenerated: !!col.generated,
        generatedType: col.generated
            ? (col.generated.stored === false ? 'VIRTUAL' : 'STORED')
            : undefined,
        defaultValue: extractDefaultValue(col.default),
    };

    // Process column constraints
    for (const constraint of col.constraints || []) {
        switch (constraint.type) {
            case 'not null':
                column.nullable = false;
                break;
            case 'null':
                column.nullable = true;
                break;
            case 'primary key':
                column.isPrimaryKey = true;
                column.nullable = false;
                pkCols.add(column.name);
                break;
            case 'unique':
                column.isUnique = true;
                ukCols.add(column.name);
                break;
            case 'check':
                column.checkConstraint = 'CHECK';
                break;
            case 'reference':
                column.isForeignKey = true;
                column.references = parseReference(constraint, context);
                break;
        }
    }

    return column;
}

function parseReference(constraint: any, context: ParseContext): ForeignKeyReference {
    const refSchema = constraint.foreignTable?.schema;
    const refTableName = constraint.foreignTable?.name || 'unknown';
    const refTableFull = refSchema ? `${refSchema}.${refTableName}` : refTableName;

    // Track dependency
    context.addDependency('current', refTableFull);

    return {
        schema: refSchema,
        table: refTableFull,
        column: constraint.foreignColumns?.[0]?.name || 'id',
        onDelete: constraint.onDelete,
        onUpdate: constraint.onUpdate,
    };
}

function parseTableConstraint(
    constraint: any,
    table: Table,
    pkCols: Set<string>,
    ukCols: Set<string>,
    context: ParseContext
): void {
    const constraintName = constraint.constraintName?.name || constraint.constraintName;

    switch (constraint.type) {
        case 'primary key':
            for (const col of constraint.columns || []) {
                pkCols.add(col.name || col);
            }
            break;

        case 'unique':
            const uniqueCols = (constraint.columns || []).map((c: any) => c.name || c);
            for (const col of uniqueCols) {
                ukCols.add(col);
            }
            table.uniqueConstraints.push({
                name: constraintName,
                columns: uniqueCols,
            });
            break;

        case 'check':
            table.checkConstraints.push({
                name: constraintName,
                expression: 'CHECK',
            });
            break;

        case 'foreign key':
            const fkColumns = constraint.localColumns || constraint.columns || [];
            const refColumns = constraint.foreignColumns || [];
            const refSchema = constraint.foreignTable?.schema;
            const refTableName = constraint.foreignTable?.name || 'unknown';
            const refTableFull = refSchema ? `${refSchema}.${refTableName}` : refTableName;

            for (let i = 0; i < fkColumns.length; i++) {
                const fkColName = fkColumns[i].name || fkColumns[i];
                const tableCol = table.columns.find(c => c.name === fkColName);
                if (tableCol) {
                    tableCol.isForeignKey = true;
                    tableCol.references = {
                        schema: refSchema,
                        table: refTableFull,
                        column: refColumns[i]?.name || refColumns[i] || 'id',
                        onDelete: constraint.onDelete,
                        onUpdate: constraint.onUpdate,
                    };
                }
            }

            // Track dependency
            context.addDependency(table.name, refTableFull);
            break;
    }
}

function parseCreateEnum(stmt: any, context: ParseContext, result: AstParseResult): void {
    const enumName = stmt.name?.name || 'unknown_enum';
    const schemaName = stmt.name?.schema;
    const fullName = context.qualifyName(enumName, schemaName);
    const values = (stmt.values || []).map((v: any) => v.value || v);

    const enumType: EnumType = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        values,
    };

    result.enums = result.enums || [];
    result.enums.push(enumType);
}

function parseCreateView(stmt: any, context: ParseContext, result: AstParseResult, isMaterialized = false): void {
    const viewName = stmt.name?.name || 'unknown_view';
    const schemaName = stmt.name?.schema;
    const fullName = context.qualifyName(viewName, schemaName);

    const view: View = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        isMaterialized: isMaterialized || stmt.materialized === true,
        isRecursive: stmt.recursive === true,
        verificationLevel: 'DEFINITIVE',
    };

    // Extract dependencies from the view query
    const dependencies = extractViewDependencies(stmt.query);

    for (const dep of dependencies) {
        context.addDependency(fullName, dep);
    }

    result.views = result.views || [];
    result.views.push(view);
}

function parseCreateIndex(stmt: any, context: ParseContext, result: AstParseResult): void {
    const indexName = stmt.name?.name || 'unknown_index';
    const tableName = stmt.on?.name || 'unknown_table';
    const tableSchema = stmt.on?.schema;
    const fullTableName = context.qualifyName(tableName, tableSchema);

    // TODO: Verify if index name should be schema qualified. Usually indexes live in schema.
    // stmt.name might have schema.
    const indexSchema = stmt.name?.schema;
    const fullIndexName = context.qualifyName(indexName, indexSchema);

    const index: Index = {
        name: indexName, // Keeping short name but maybe should be fullIndexName? Pattern match kept short name.
        table: fullTableName,
        columns: (stmt.expressions || []).map((e: any) => e.name || e.column?.name || 'unknown'),
        type: (stmt.using || 'btree').toLowerCase() as any,
        isUnique: stmt.unique === true,
        isPartial: !!stmt.where,
        whereClause: stmt.where ? 'WHERE clause' : undefined,
        includeColumns: (stmt.include || []).map((c: any) => c.name || c),
    };

    result.indexes = result.indexes || [];
    result.indexes.push(index);
}

function parseCreateSequence(stmt: any, context: ParseContext, result: AstParseResult): void {
    const seqName = stmt.name?.name || 'unknown_sequence';
    const schemaName = stmt.name?.schema;
    const fullName = context.qualifyName(seqName, schemaName);

    const sequence: Sequence = {
        name: fullName,
        schema: schemaName || context.currentSchema,
    };

    result.sequences = result.sequences || [];
    result.sequences.push(sequence);
}

function parseCreateFunction(stmt: any, context: ParseContext, result: AstParseResult): void {
    const funcName = stmt.name?.name || 'unknown_function';
    const schemaName = stmt.name?.schema;
    const fullName = context.qualifyName(funcName, schemaName);

    // Extract volatility from AST
    let volatility: 'VOLATILE' | 'STABLE' | 'IMMUTABLE' | undefined;
    if (stmt.volatility) {
        const vol = String(stmt.volatility).toUpperCase();
        if (vol === 'IMMUTABLE' || vol === 'STABLE' || vol === 'VOLATILE') {
            volatility = vol;
        }
    }

    // Extract body from AST (dollar-quoted)
    const body = stmt.body || stmt.code || undefined;

    // Extract security definer
    const securityDefiner = stmt.security === 'definer' || stmt.securityDefiner === true;

    // Extract parameters from AST args
    const parameters: { name?: string; type: string; mode?: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC'; default?: string }[] = [];
    if (Array.isArray(stmt.args)) {
        for (const arg of stmt.args) {
            parameters.push({
                name: arg.name,
                type: arg.type?.name || arg.dataType?.name || String(arg.type || 'unknown'),
                mode: arg.mode?.toUpperCase() as any,
                default: arg.default ? String(arg.default) : undefined,
            });
        }
    }

    const func: PostgresFunction = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        language: stmt.language || 'sql',
        returnType: stmt.returns?.name,
        isProcedure: stmt.procedure === true,
        body: typeof body === 'string' ? body : undefined,
        volatility,
        parameters: parameters.length > 0 ? parameters : undefined,
    };

    // Store securityDefiner as extra property (not in interface)
    if (securityDefiner) {
        (func as any).securityDefiner = true;
    }

    result.functions = result.functions || [];
    result.functions.push(func);
}

function parseCreateTrigger(stmt: any, context: ParseContext, result: AstParseResult): void {
    const triggerName = stmt.name?.name || 'unknown_trigger';
    const tableName = stmt.on?.name || 'unknown_table';
    const tableSchema = stmt.on?.schema;
    const fullTableName = context.qualifyName(tableName, tableSchema);

    // Track table dependency
    if (tableName !== 'unknown_table') {
        context.addDependency(triggerName, fullTableName);
    }

    const funcName = stmt.execute?.name;
    const funcSchema = stmt.execute?.schema;
    if (funcName) {
        const fullFuncName = context.qualifyName(funcName, funcSchema);
        // Track function dependency
        context.addDependency(triggerName, fullFuncName);
    }

    const trigger: Trigger = {
        name: triggerName,
        table: fullTableName,
        timing: (stmt.when || 'AFTER').toUpperCase() as any,
        events: stmt.events || ['UNKNOWN'],
        level: stmt.forEach === 'row' ? 'ROW' : 'STATEMENT',
        functionName: funcName,
        functionSchema: funcSchema,
    };

    result.triggers = result.triggers || [];
    result.triggers.push(trigger);
}

function parseCreateSchema(stmt: any, result: AstParseResult): void {
    const schemaName = stmt.name?.name || stmt.name || 'unknown_schema';

    result.schemas = result.schemas || [];
    result.schemas.push(schemaName);
}

function parseCreateExtension(stmt: any, result: AstParseResult): void {
    const extName = stmt.extension?.name || stmt.name || 'unknown_extension';

    const extension: Extension = {
        name: extName,
    };

    result.extensions = result.extensions || [];
    result.extensions.push(extension);
}

function parseCreatePolicy(stmt: any, context: ParseContext, result: AstParseResult): void {
    const policyName = stmt.name?.name || 'unknown_policy';
    const tableName = stmt.on?.name || 'unknown_table';
    const tableSchema = stmt.on?.schema;
    const fullTableName = context.qualifyName(tableName, tableSchema);

    // Track table dependency
    if (tableName !== 'unknown_table') {
        context.addDependency(policyName, fullTableName);
    }

    const policy: Policy = {
        name: policyName,
        table: fullTableName,
        command: (stmt.for || 'ALL').toUpperCase() as any,
        permissive: stmt.restrictive !== true,
    };

    result.policies = result.policies || [];
    result.policies.push(policy);
}
