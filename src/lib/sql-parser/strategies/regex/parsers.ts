
import {
    Table,
    Column,
    Index,
    View,
    Trigger,
    PostgresFunction,
    FunctionParameter,
    Policy,
    EnumType,
    CompositeType,
    Domain,
    Extension,
    Sequence,
    Role,
} from '../../types/core-types';
import { ParseContext } from '../../context/parse-context';
import { PATTERNS, categorizeDataType } from './patterns';

export interface RegexParseResult {
    success: boolean;
    table?: Table;
    view?: View;
    index?: Index;
    policy?: Policy;
    function?: PostgresFunction;
    trigger?: Trigger;
    enum?: EnumType;
    compositeType?: CompositeType;
    domain?: Domain;
    extension?: Extension;
    sequence?: Sequence;
    role?: Role;
    schema?: string;
    confidence: number;
    error?: string;
}

export function parseCreateTableRegex(sql: string, context: ParseContext): RegexParseResult {
    // Check for partition child first
    const partOfMatch = sql.match(PATTERNS.partitionOf);
    if (partOfMatch) {
        return parsePartitionOfTable(sql, partOfMatch, context);
    }

    // Regular table
    const tableMatch = sql.match(PATTERNS.createTable);
    if (!tableMatch) {
        return { success: false, confidence: 0, error: 'Could not match CREATE TABLE' };
    }

    const schemaName = tableMatch[1];
    const tableName = tableMatch[2];
    const fullName = context.qualifyName(tableName, schemaName);

    const table: Table = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        columns: [],
        isPartitioned: false,
        isTemporary: /TEMP(?:ORARY)?/i.test(sql),
        isUnlogged: /UNLOGGED/i.test(sql),
        checkConstraints: [],
        uniqueConstraints: [],
        confidence: 0.8,
    };

    // Check for PARTITION BY
    const partitionMatch = sql.match(PATTERNS.partitionBy);
    if (partitionMatch) {
        table.isPartitioned = true;
        table.partitionType = partitionMatch[1].toLowerCase() as any;
        table.partitionKey = partitionMatch[2].split(',').map(s => s.trim().replace(/"/g, ''));
    }

    // Extract column definitions
    const columnsStart = sql.indexOf('(');
    if (columnsStart > 0) {
        const columns = extractColumnDefinitions(sql.slice(columnsStart), context);
        table.columns = columns;
    }

    // Register in context
    context.tables.set(fullName, table);
    context.defineSymbol(tableName, 'table', table, schemaName, 'HEURISTIC');

    table.verificationLevel = 'HEURISTIC';
    return { success: true, table, confidence: 0.8 };
}

function parsePartitionOfTable(
    sql: string,
    match: RegExpMatchArray,
    context: ParseContext
): RegexParseResult {
    const childSchema = match[1];
    const childName = match[2];
    const parentSchema = match[3];
    const parentName = match[4];
    const bounds = match[5];

    const childFullName = context.qualifyName(childName, childSchema);
    const parentFullName = context.qualifyName(parentName, parentSchema);

    const table: Table = {
        name: childFullName,
        schema: childSchema || context.currentSchema,
        columns: [], // Inherit from parent
        isPartitioned: false,
        partitionOf: parentFullName,
        isTemporary: false,
        isUnlogged: false,
        checkConstraints: [],
        uniqueConstraints: [],
        confidence: 0.9,
        verificationLevel: 'HEURISTIC',
    };

    // Parse bounds
    if (bounds.toUpperCase().startsWith('FROM')) {
        const fromToMatch = bounds.match(/FROM\s*\(([^)]+)\)\s*TO\s*\(([^)]+)\)/i);
        if (fromToMatch) {
            table.partitionBounds = {
                from: fromToMatch[1].trim(),
                to: fromToMatch[2].trim(),
            };
        }
    } else if (bounds.toUpperCase().startsWith('IN')) {
        const inMatch = bounds.match(/IN\s*\(([^)]+)\)/i);
        if (inMatch) {
            table.partitionBounds = {
                in: inMatch[1].split(',').map(s => s.trim()),
            };
        }
    }

    // Track dependency on parent
    context.addDependency(childFullName, parentFullName);
    context.tables.set(childFullName, table);
    context.defineSymbol(childName, 'table', table, childSchema, 'HEURISTIC');

    return { success: true, table, confidence: 0.9 };
}

export function parseCreateViewRegex(sql: string, context: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createView);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE VIEW' };
    }

    const isMaterialized = !!match[1];
    const schemaName = match[2];
    const viewName = match[3];

    const fullName = context.qualifyName(viewName, schemaName);

    const view: View = {
        name: fullName,
        schema: schemaName || context.currentSchema,
        isMaterialized,
        isRecursive: /RECURSIVE/i.test(sql),
        verificationLevel: 'HEURISTIC',
    };

    return { success: true, view, confidence: 0.9 };
}

function extractColumnDefinitions(sql: string, context: ParseContext): Column[] {
    const columns: Column[] = [];

    // Find the balanced parentheses content
    let depth = 0;
    let start = -1;
    let end = -1;

    for (let i = 0; i < sql.length; i++) {
        if (sql[i] === '(') {
            if (depth === 0) start = i + 1;
            depth++;
        } else if (sql[i] === ')') {
            depth--;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }

    if (start < 0 || end < 0) return columns;

    const content = sql.slice(start, end);

    // Split by commas (respecting parentheses)
    const parts: string[] = [];
    let current = '';
    depth = 0;

    for (const char of content) {
        if (char === '(') depth++;
        else if (char === ')') depth--;

        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) parts.push(current.trim());

    // Parse each part
    for (const part of parts) {
        // Skip table-level constraints
        if (/^\s*(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|CONSTRAINT)/i.test(part)) {
            continue;
        }

        const column = parseColumnDefinition(part, context);
        if (column) {
            columns.push(column);
        }
    }

    return columns;
}

function parseColumnDefinition(def: string, context: ParseContext): Column | null {
    // Match: column_name TYPE [constraints...]
    const match = def.match(/^\s*"?(\w+)"?\s+([A-Za-z][A-Za-z0-9_(),.[\]\s]+?)(?:\s+((?:PRIMARY|NOT|NULL|UNIQUE|CHECK|DEFAULT|REFERENCES|GENERATED|CONSTRAINT).*))?$/i);

    if (!match) return null;

    const name = match[1];
    let type = match[2].trim();
    const constraints = match[3] || '';

    // Handle array types
    if (type.match(/\[\s*\]$/)) {
        type = type.replace(/\[\s*\]$/, '[]');
    }

    const column: Column = {
        name,
        type,
        typeCategory: categorizeDataType(type),
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isGenerated: false,
    };

    // Parse constraints
    if (PATTERNS.primaryKey.test(constraints)) {
        column.isPrimaryKey = true;
        column.nullable = false;
    }

    if (PATTERNS.notNull.test(constraints)) {
        column.nullable = false;
    }

    if (PATTERNS.unique.test(constraints)) {
        column.isUnique = true;
    }

    // Generated column (PG 18: STORED or VIRTUAL)
    const generatedMatch = constraints.match(PATTERNS.generatedColumn);
    if (generatedMatch) {
        column.isGenerated = true;
        column.generatedExpression = generatedMatch[1];
        column.generatedType = generatedMatch[2].toUpperCase() as 'STORED' | 'VIRTUAL';
    }

    // Default value
    const defaultMatch = constraints.match(PATTERNS.default);
    if (defaultMatch) {
        column.defaultValue = defaultMatch[1].trim();
    }

    // Foreign key reference
    const refMatch = constraints.match(PATTERNS.references);
    if (refMatch) {
        column.isForeignKey = true;
        const refSchema = refMatch[1];
        const refTable = refMatch[2];
        const refColumn = refMatch[3];
        const refTableFull = refSchema ? `${refSchema}.${refTable}` : refTable;

        column.references = {
            schema: refSchema,
            table: refTableFull,
            column: refColumn,
            onDelete: refMatch[4]?.replace(/\s+/g, ' '),
            onUpdate: refMatch[5]?.replace(/\s+/g, ' '),
        };

        // Track dependency
        context.addForwardReference('current', refTableFull);
    }

    // Check constraint
    const checkMatch = constraints.match(PATTERNS.check);
    if (checkMatch) {
        column.checkConstraint = checkMatch[1];
    }

    return column;
}

export function parseCreatePolicyRegex(sql: string, context: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createPolicy);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE POLICY' };
    }

    const policyName = match[1];
    const schemaName = match[2];
    const tableName = match[3];
    const permissive = (match[4] || 'PERMISSIVE').toUpperCase() !== 'RESTRICTIVE';
    const command = match[5].toUpperCase() as any;

    const fullTableName = context.qualifyName(tableName, schemaName);

    // Track table dependency
    context.addDependency(policyName, fullTableName);

    const policy: Policy = {
        name: policyName,
        schema: schemaName || context.currentSchema,
        table: fullTableName,
        command,
        permissive,
    };

    // Extract USING and WITH CHECK
    const usingMatch = sql.match(PATTERNS.policyUsing);
    if (usingMatch) {
        policy.usingExpression = usingMatch[1];
        policy.checkExpression = usingMatch[2];
    }

    context.policies.set(policyName, policy);

    return { success: true, policy, confidence: 0.85 };
}

export function parseCreateEnumRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createEnum);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE TYPE ... ENUM' };
    }

    const schemaName = match[1];
    const enumName = match[2];
    const valuesStr = match[3];

    // Handle context if available, else fallback
    const fullName = context ? context.qualifyName(enumName, schemaName) : (schemaName ? `${schemaName}.${enumName}` : enumName);

    // Parse values
    const values = valuesStr
        .split(',')
        .map(v => v.trim().replace(/^'|'$/g, ''))
        .filter(v => v);

    const enumType: EnumType = {
        name: fullName,
        schema: schemaName || (context ? context.currentSchema : undefined),
        values,
    };

    return { success: true, enum: enumType, confidence: 0.95 };
}

export function parseCreateTypeRegex(sql: string, context?: ParseContext): RegexParseResult {
    // Skip if this is an ENUM type (handled by parseCreateEnumRegex)
    if (/AS\s+ENUM\s*\(/i.test(sql)) {
        return { success: false, confidence: 0, error: 'ENUM type - use parseCreateEnumRegex' };
    }

    // Check for composite type
    const match = sql.match(PATTERNS.createCompositeType);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE TYPE' };
    }

    const schemaName = match[1];
    const typeName = match[2];
    const attributesStr = match[3];

    const fullName = context ? context.qualifyName(typeName, schemaName) : (schemaName ? `${schemaName}.${typeName}` : typeName);

    // Parse attributes
    const attributes = attributesStr
        .split(',')
        .map(attr => {
            const parts = attr.trim().split(/\s+/);
            return {
                name: parts[0]?.replace(/"/g, '') || 'unknown',
                type: parts.slice(1).join(' ') || 'unknown',
            };
        });

    const compositeType: CompositeType = {
        name: fullName,
        schema: schemaName || (context ? context.currentSchema : undefined),
        attributes,
    };

    return { success: true, compositeType, confidence: 0.85 };
}

export function parseCreateFunctionRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createFunction);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE FUNCTION' };
    }

    const schemaName = match[1];
    const funcName = match[2];
    const paramsStr = match[3];
    const returnType = match[4];

    const fullName = context ? context.qualifyName(funcName, schemaName) : (schemaName ? `${schemaName}.${funcName}` : funcName);

    // Extract language
    const langMatch = sql.match(/LANGUAGE\s+(\w+)/i);
    const language = langMatch ? langMatch[1] : 'sql';

    // Extract volatility
    let volatility: 'VOLATILE' | 'STABLE' | 'IMMUTABLE' | undefined;
    if (/\bIMMUTABLE\b/i.test(sql)) volatility = 'IMMUTABLE';
    else if (/\bSTABLE\b/i.test(sql)) volatility = 'STABLE';
    else if (/\bVOLATILE\b/i.test(sql)) volatility = 'VOLATILE';

    // Extract SECURITY DEFINER
    const securityDefiner = /\bSECURITY\s+DEFINER\b/i.test(sql);

    // Extract function body (dollar-quoted: $$ ... $$ or $tag$ ... $tag$)
    let body: string | undefined;
    const bodyMatch = sql.match(/\$([^$]*)\$([\s\S]*?)\$\1\$/);
    if (bodyMatch) {
        body = bodyMatch[2].trim();
    }

    // Parse parameters
    const parameters: FunctionParameter[] = [];
    if (paramsStr) {
        const paramParts = splitParams(paramsStr);
        for (const part of paramParts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const param = parseParamStr(trimmed);
            if (param) parameters.push(param);
        }
    }

    const func: PostgresFunction = {
        name: fullName,
        schema: schemaName || (context ? context.currentSchema : undefined),
        language,
        returnType,
        isProcedure: /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE/i.test(sql),
        body,
        volatility,
        parameters: parameters.length > 0 ? parameters : undefined,
    };

    // Store securityDefiner as an extra property (not in interface but accessible via cast)
    if (securityDefiner) {
        (func as any).securityDefiner = true;
    }

    return { success: true, function: func, confidence: 0.75 };
}

/** Split function parameters respecting nested parens (e.g. DEFAULT values) */
function splitParams(str: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of str) {
        if (ch === '(') { depth++; current += ch; }
        else if (ch === ')') { depth--; current += ch; }
        else if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
        else { current += ch; }
    }
    if (current.trim()) parts.push(current);
    return parts;
}

/** Parse a single parameter string like "IN name type DEFAULT value" */
function parseParamStr(str: string): FunctionParameter | null {
    const tokens = str.trim().split(/\s+/);
    if (tokens.length === 0) return null;

    let mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC' | undefined;
    let idx = 0;
    const first = tokens[0].toUpperCase();
    if (['IN', 'OUT', 'INOUT', 'VARIADIC'].includes(first)) {
        mode = first as any;
        idx++;
    }

    // Could be "name type" or just "type"
    if (idx >= tokens.length) return null;

    let name: string | undefined;
    let type: string;
    const defaultIdx = tokens.findIndex((t, i) => i >= idx && t.toUpperCase() === 'DEFAULT');

    if (defaultIdx > idx + 1 || (defaultIdx === -1 && tokens.length > idx + 1)) {
        // Has name and type
        name = tokens[idx];
        const typeEnd = defaultIdx > 0 ? defaultIdx : tokens.length;
        type = tokens.slice(idx + 1, typeEnd).join(' ');
    } else {
        // Just type
        const typeEnd = defaultIdx > 0 ? defaultIdx : tokens.length;
        type = tokens.slice(idx, typeEnd).join(' ');
    }

    let defaultVal: string | undefined;
    if (defaultIdx >= 0) {
        defaultVal = tokens.slice(defaultIdx + 1).join(' ');
    }

    return { name, type, mode, default: defaultVal };
}

export function parseCreateTriggerRegex(sql: string, context: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createTrigger);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE TRIGGER' };
    }

    const triggerName = match[1];
    const timing = match[2].toUpperCase().replace(/\s+/g, ' ') as any;
    const events = [match[3], match[4]].filter(Boolean).map(e => e.toUpperCase());
    const tableSchema = match[5];
    const tableName = match[6];

    const fullTableName = context.qualifyName(tableName, tableSchema);

    // Track table dependency
    context.addDependency(triggerName, fullTableName);

    // Extract function name
    const execMatch = sql.match(PATTERNS.executeFunction);
    const funcName = execMatch?.[2];
    const funcSchema = execMatch?.[1];

    if (funcName) {
        const fullFuncName = context.qualifyName(funcName, funcSchema);
        context.addDependency(triggerName, fullFuncName);
    }

    const trigger: Trigger = {
        name: triggerName,
        table: fullTableName,
        timing,
        events,
        level: /FOR\s+EACH\s+ROW/i.test(sql) ? 'ROW' : 'STATEMENT',
        functionName: funcName,
        functionSchema: funcSchema,
    };

    context.triggers.set(triggerName, trigger);

    return { success: true, trigger, confidence: 0.85 };
}

export function parseCreateExtensionRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createExtension);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE EXTENSION' };
    }

    const extension: Extension = {
        name: match[1],
    };

    return { success: true, extension, confidence: 1.0 };
}

export function parseCreateSchemaRegex(sql: string): RegexParseResult {
    const match = sql.match(PATTERNS.createSchema);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE SCHEMA' };
    }

    return { success: true, schema: match[1], confidence: 1.0 };
}

export function parseCreateSequenceRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createSequence);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE SEQUENCE' };
    }

    const schemaName = match[1];
    const seqName = match[2];
    const fullName = context ? context.qualifyName(seqName, schemaName) : (schemaName ? `${schemaName}.${seqName}` : seqName);

    const sequence: Sequence = {
        name: fullName,
        schema: schemaName || (context ? context.currentSchema : undefined),
    };

    return { success: true, sequence, confidence: 0.95 };
}

export function parseCreateDomainRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createDomain);
    if (match) {
        const schemaName = match[1];
        const domainName = match[2];
        const baseType = match[3];
        const fullName = context ? context.qualifyName(domainName, schemaName) : (schemaName ? `${schemaName}.${domainName}` : domainName);

        const domain: Domain = {
            name: fullName,
            schema: schemaName || (context ? context.currentSchema : undefined),
            baseType,
            notNull: /NOT\s+NULL/i.test(sql),
        };

        // Extract CHECK constraint
        const checkMatch = sql.match(/CHECK\s*\((.+?)\)/i);
        if (checkMatch) {
            domain.checkExpression = checkMatch[1];
        }

        // Extract DEFAULT
        const defaultMatch = sql.match(/DEFAULT\s+([^\s]+)/i);
        if (defaultMatch) {
            domain.default = defaultMatch[1];
        }

        if (context) {
            context.domains.set(domainName, domain);
        }

        return { success: true, domain, confidence: 0.9 };
    }

    // Try a simpler pattern if normal match fails
    const simpleMatch = sql.match(/CREATE\s+DOMAIN\s+(?:\"?(\w+)\"?\.)?\"?(\w+)\"?\s+(?:AS\s+)?([A-Za-z][A-Za-z0-9_(),\s]*)/i);
    if (!simpleMatch) {
        return { success: false, confidence: 0, error: 'Could not match CREATE DOMAIN' };
    }

    const schemaName = simpleMatch[1];
    const domainName = simpleMatch[2];
    const baseType = simpleMatch[3];
    const fullName = context ? context.qualifyName(domainName, schemaName) : (schemaName ? `${schemaName}.${domainName}` : domainName);

    const domain: Domain = {
        name: fullName,
        schema: schemaName || (context ? context.currentSchema : undefined),
        baseType
    };

    if (context) {
        context.domains.set(domainName, domain);
    }

    return {
        success: true,
        domain,
        confidence: 0.8
    };
}

export function parseCreateIndexRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createIndex);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE INDEX' };
    }

    const isUnique = !!match[1];
    const indexName = match[2];
    const schemaName = match[3];
    const tableName = match[4];
    const indexType = (match[5] || 'btree').toLowerCase() as any;
    const columnsStr = match[6];

    const fullIndexName = context ? context.qualifyName(indexName, schemaName) : (schemaName ? `${schemaName}.${indexName}` : indexName);
    const fullTableName = context ? context.qualifyName(tableName, schemaName) : (schemaName ? `${schemaName}.${tableName}` : tableName);

    // Parse columns
    const columns = columnsStr
        .split(',')
        .map(c => c.trim().replace(/"/g, '').split(/\s+/)[0])
        .filter(c => c);

    const index: Index = {
        name: indexName,
        table: fullTableName,
        columns,
        type: indexType,
        isUnique,
        isPartial: /WHERE/i.test(sql),
        includeColumns: [],
    };

    // Check for INCLUDE
    const includeMatch = sql.match(/INCLUDE\s*\(([^)]+)\s*\)/i);
    if (includeMatch) {
        index.includeColumns = includeMatch[1]
            .split(',')
            .map(c => c.trim().replace(/"/g, ''));
    }

    // Track dependency
    if (context) {
        context.addDependency(indexName, fullTableName);
    }

    return { success: true, index, confidence: 0.9 };
}

export function parseCreateRoleRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.createRole);
    if (!match) {
        return { success: false, confidence: 0, error: 'Could not match CREATE ROLE' };
    }

    const roleName = match[2];
    const upperSql = sql.toUpperCase();

    const role: Role = {
        name: roleName,
        isSuperuser: upperSql.includes('SUPERUSER') && !upperSql.includes('NOSUPERUSER'),
        canLogin: upperSql.includes('LOGIN') && !upperSql.includes('NOLOGIN'),
        canCreateDb: upperSql.includes('CREATEDB') && !upperSql.includes('NOCREATEDB'),
        canCreateRole: upperSql.includes('CREATEROLE') && !upperSql.includes('NOCREATEROLE'),
        inherit: upperSql.includes('INHERIT') && !upperSql.includes('NOINHERIT'),
        bypassRls: upperSql.includes('BYPASSRLS') && !upperSql.includes('NOBYPASSRLS'),
    };

    if (context) {
        context.roles.set(roleName, role);
    }

    return { success: true, role, confidence: 0.95 };
}

export function parseAlterTableRegex(sql: string, context?: ParseContext): RegexParseResult {
    const match = sql.match(PATTERNS.enableRls);
    if (match) {
        const schemaName = match[1];
        const tableName = match[2];
        const fullName = context ? context.qualifyName(tableName, schemaName) : (schemaName ? `${schemaName}.${tableName}` : tableName);

        if (context) {
            const table = context.tables.get(fullName);
            if (table) {
                table.rlsEnabled = true;
            }
        }

        // Technically successful, but no new object to return
        return { success: true, confidence: 0.9 };
    }

    return { success: false, confidence: 0, error: 'Could not match supported ALTER TABLE commands' };
}
