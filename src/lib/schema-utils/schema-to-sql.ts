/**
 * Schema to SQL Generator
 * 
 * Converts introspected database schema objects back to SQL DDL.
 * Used when pulling schema from a remote database.
 */

export interface IntrospectedColumn {
    name: string;
    type: string;
    udt_type?: string;
    nullable: boolean;
    default_value?: string | null;
    max_length?: number | null;
    is_primary_key?: boolean;
    comment?: string | null;
}

export interface IntrospectedConstraint {
    name: string;
    type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';
    columns: string[];
    definition?: string;
    references_table?: string;
    references_columns?: string[];
    on_delete?: string;
    on_update?: string;
}

export interface IntrospectedTable {
    name: string;
    columns: IntrospectedColumn[];
    constraints?: IntrospectedConstraint[];
    indexes?: Array<{
        name: string;
        columns: string[];
        is_unique: boolean;
        method?: string;
    }>;
    comment?: string | null;
}

export interface IntrospectedSchema {
    tables: IntrospectedTable[];
    enums?: Array<{ name: string; values: string[] }>;
    metadata?: {
        schemaName?: string;
        introspectedAt?: string;
        tableCount?: number;
    };
}

/**
 * Convert introspected schema to SQL DDL
 */
export function schemaToSql(schema: IntrospectedSchema): string {
    const lines: string[] = [];
    const schemaName = schema.metadata?.schemaName || 'public';

    // Header comment
    lines.push('-- ============================================');
    lines.push(`-- Schema pulled from database`);
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Tables: ${schema.tables?.length || 0}`);
    lines.push('-- ============================================');
    lines.push('');

    // Generate ENUMs first
    if (schema.enums && schema.enums.length > 0) {
        lines.push('-- ENUMS');
        lines.push('-- ----------------------------------------');
        for (const enumDef of schema.enums) {
            const values = enumDef.values.map(v => `'${v}'`).join(', ');
            lines.push(`CREATE TYPE ${enumDef.name} AS ENUM (${values});`);
        }
        lines.push('');
    }

    // Generate tables
    if (schema.tables) {
        lines.push('-- TABLES');
        lines.push('-- ----------------------------------------');
        lines.push('');

        for (const table of schema.tables) {
            lines.push(tableToSql(table, schemaName));
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Convert a single table to CREATE TABLE statement
 */
function tableToSql(table: IntrospectedTable, schemaName: string): string {
    const lines: string[] = [];
    const tableName = schemaName !== 'public' ? `${schemaName}.${table.name}` : table.name;

    // Table comment
    if (table.comment) {
        lines.push(`-- ${table.comment}`);
    }

    lines.push(`CREATE TABLE ${tableName} (`);

    const columnDefs: string[] = [];

    // Columns
    for (const col of table.columns) {
        columnDefs.push(columnToSql(col));
    }

    // Inline constraints (primary key, unique)
    if (table.constraints) {
        for (const constraint of table.constraints) {
            const constraintSql = constraintToSql(constraint);
            if (constraintSql) {
                columnDefs.push(constraintSql);
            }
        }
    }

    lines.push('    ' + columnDefs.join(',\n    '));
    lines.push(');');

    // Indexes (after table)
    if (table.indexes) {
        for (const idx of table.indexes) {
            const columns = ensureArray(idx.columns);
            if (!idx.is_unique || !isPrimaryKeyIndex(idx, table.constraints)) {
                const unique = idx.is_unique ? 'UNIQUE ' : '';
                const method = idx.method && idx.method !== 'btree' ? ` USING ${idx.method}` : '';
                lines.push(`CREATE ${unique}INDEX ${idx.name} ON ${tableName}${method} (${columns.join(', ')});`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Convert column to SQL definition
 */
function columnToSql(col: IntrospectedColumn): string {
    let sql = `${col.name} ${mapDataType(col)}`;

    // NOT NULL
    if (!col.nullable) {
        sql += ' NOT NULL';
    }

    // DEFAULT
    if (col.default_value !== null && col.default_value !== undefined) {
        sql += ` DEFAULT ${col.default_value}`;
    }

    return sql;
}

/**
 * Map introspected data type back to SQL type
 */
function mapDataType(col: IntrospectedColumn): string {
    // Use udt_type if available for custom types
    const baseType = col.udt_type || col.type;

    // Handle common type mappings
    switch (baseType.toLowerCase()) {
        case 'int4':
            return 'INT';
        case 'int8':
            return 'BIGINT';
        case 'int2':
            return 'SMALLINT';
        case 'float4':
            return 'REAL';
        case 'float8':
            return 'DOUBLE PRECISION';
        case 'bool':
            return 'BOOLEAN';
        case 'varchar':
            return col.max_length ? `VARCHAR(${col.max_length})` : 'VARCHAR';
        case 'character varying':
            return col.max_length ? `VARCHAR(${col.max_length})` : 'VARCHAR';
        case 'bpchar':
            return col.max_length ? `CHAR(${col.max_length})` : 'CHAR';
        case 'timestamptz':
            return 'TIMESTAMP WITH TIME ZONE';
        case 'timestamp':
            return 'TIMESTAMP';
        case 'timetz':
            return 'TIME WITH TIME ZONE';
        case 'serial':
            return 'SERIAL';
        case 'bigserial':
            return 'BIGSERIAL';
        case 'smallserial':
            return 'SMALLSERIAL';
        default:
            return col.type.toUpperCase();
    }
}

/**
 * Convert constraint to SQL definition
 */
function constraintToSql(constraint: IntrospectedConstraint): string | null {
    const columns = ensureArray(constraint.columns);
    const refColumns = ensureArray(constraint.references_columns);

    switch (constraint.type) {
        case 'PRIMARY KEY':
            return `PRIMARY KEY (${columns.join(', ')})`;
        case 'UNIQUE':
            return `UNIQUE (${columns.join(', ')})`;
        case 'CHECK':
            return constraint.definition ? `CHECK (${constraint.definition})` : null;
        case 'FOREIGN KEY':
            let fk = `FOREIGN KEY (${columns.join(', ')}) REFERENCES ${constraint.references_table}`;
            if (refColumns.length > 0) {
                fk += ` (${refColumns.join(', ')})`;
            }
            if (constraint.on_delete) {
                fk += ` ON DELETE ${constraint.on_delete}`;
            }
            if (constraint.on_update) {
                fk += ` ON UPDATE ${constraint.on_update}`;
            }
            return fk;
        default:
            return null;
    }
}

/**
 * Check if index is just the primary key index
 */
function isPrimaryKeyIndex(
    idx: { columns: string[] | string; is_unique: boolean },
    constraints?: IntrospectedConstraint[]
): boolean {
    if (!constraints) return false;
    const pk = constraints.find(c => c.type === 'PRIMARY KEY');
    if (!pk) return false;

    const idxCols = ensureArray(idx.columns);
    const pkCols = ensureArray(pk.columns);

    return idxCols.length === pkCols.length &&
        idxCols.every(c => pkCols.includes(c));
}

/**
 * Helper to ensure we have an array of strings
 */
function ensureArray(val: string | string[] | undefined | null): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    // If string looks like a JSON array "[...]", parse it?
    // Or if it's "col1, col2", split it
    if (typeof val === 'string') {
        if (val.startsWith('[') && val.endsWith(']')) {
            try { return JSON.parse(val); } catch (e) { /* ignore */ }
        }
        return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [String(val)];
}
