import { useState, useCallback, useEffect } from 'react';
import { Table, Column, DataTypeCategory, parsePostgresSQL } from '@/lib/sql-parser';
import { generateTableSQL } from '@/lib/schema-utils/schema-generators';

export type EditorMode = 'visual' | 'sql';

export const POSTGRES_TYPES = [
    'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR(255)', 'TEXT', 'CHAR(1)',
    'BOOLEAN',
    'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'INTERVAL',
    'UUID',
    'JSON', 'JSONB',
    'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION', 'MONEY',
    'BYTEA',
    'INET', 'CIDR', 'MACADDR',
    'TEXT[]', 'INTEGER[]', 'UUID[]',
];

export function createEmptyColumn(): Column {
    return {
        name: '',
        type: 'VARCHAR(255)',
        typeCategory: 'text' as DataTypeCategory,
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isGenerated: false,
    };
}

export function useTableEditor(table: Table | null, onSave: (table: Table) => void, onClose: () => void) {
    const [editedTable, setEditedTable] = useState<Table | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [editorMode, setEditorMode] = useState<EditorMode>('visual');
    const [sqlCode, setSqlCode] = useState<string>('');
    const [sqlError, setSqlError] = useState<string | null>(null);

    // Generate SQL from table whenever editedTable changes
    const generateSqlFromTable = useCallback((tbl: Table): string => {
        return generateTableSQL(tbl);
    }, []);

    // Parse SQL to table
    const parseTableFromSql = useCallback((sql: string): { table: Table | null; error: string | null } => {
        try {
            const parsed = parsePostgresSQL(sql);
            if (parsed.errors.length > 0) {
                return { table: null, error: parsed.errors.join('; ') };
            }
            if (parsed.tables.length === 0) {
                return { table: null, error: 'No valid CREATE TABLE statement found' };
            }
            return { table: parsed.tables[0], error: null };
        } catch (err: any) {
            return { table: null, error: err.message || 'Failed to parse SQL' };
        }
    }, []);

    useEffect(() => {
        if (table) {
            const clonedTable = JSON.parse(JSON.stringify(table)); // Deep clone
            setEditedTable(clonedTable);
            setErrors([]);
            setSqlError(null);
            setEditorMode('visual');

            // Defer the expensive SQL generation to not block the mount animation
            setTimeout(() => {
                setSqlCode(generateSqlFromTable(clonedTable));
            }, 50);
        }
    }, [table, generateSqlFromTable]);

    // Sync SQL code when switching from visual to SQL mode
    const handleModeChange = useCallback((mode: EditorMode) => {
        if (mode === 'sql' && editedTable) {
            // Update SQL from current visual state
            setSqlCode(generateSqlFromTable(editedTable));
            setSqlError(null);
        } else if (mode === 'visual' && sqlCode) {
            // Parse SQL and update visual state
            const { table: parsedTable, error } = parseTableFromSql(sqlCode);
            if (error) {
                setSqlError(error);
                return; // Don't switch if there's an error
            }
            if (parsedTable) {
                setEditedTable(parsedTable);
                setSqlError(null);
            }
        }
        setEditorMode(mode);
    }, [editedTable, sqlCode, generateSqlFromTable, parseTableFromSql]);

    // Handle SQL code changes
    const handleSqlChange = useCallback((newSql: string) => {
        setSqlCode(newSql);
        // Live validation
        const { error } = parseTableFromSql(newSql);
        setSqlError(error);
    }, [parseTableFromSql]);

    const handleTableNameChange = useCallback((name: string) => {
        if (!editedTable) return;
        setEditedTable({ ...editedTable, name });
    }, [editedTable]);

    const handleColumnChange = useCallback((index: number, field: keyof Column, value: any) => {
        if (!editedTable) return;

        const newColumns = [...editedTable.columns];
        newColumns[index] = { ...newColumns[index], [field]: value };

        // Auto-set nullable to false if primary key
        if (field === 'isPrimaryKey' && value === true) {
            newColumns[index].nullable = false;
        }

        // Handle FK reference setup
        if (field === 'isForeignKey' && value === false) {
            delete newColumns[index].references;
        }

        setEditedTable({ ...editedTable, columns: newColumns });
    }, [editedTable]);

    const handleReferenceChange = useCallback((index: number, refTable: string, refColumn: string) => {
        if (!editedTable) return;

        const newColumns = [...editedTable.columns];
        newColumns[index] = {
            ...newColumns[index],
            references: {
                table: refTable,
                column: refColumn,
            },
        };
        setEditedTable({ ...editedTable, columns: newColumns });
    }, [editedTable]);

    const addColumn = useCallback(() => {
        if (!editedTable) return;
        setEditedTable({
            ...editedTable,
            columns: [...editedTable.columns, createEmptyColumn()],
        });
    }, [editedTable]);

    const removeColumn = useCallback((index: number) => {
        if (!editedTable) return;
        const newColumns = editedTable.columns.filter((_, i) => i !== index);
        setEditedTable({ ...editedTable, columns: newColumns });
    }, [editedTable]);

    const moveColumn = useCallback((from: number, to: number) => {
        if (!editedTable || to < 0 || to >= editedTable.columns.length) return;
        const newColumns = [...editedTable.columns];
        const [moved] = newColumns.splice(from, 1);
        newColumns.splice(to, 0, moved);
        setEditedTable({ ...editedTable, columns: newColumns });
    }, [editedTable]);

    const validate = useCallback((): boolean => {
        const newErrors: string[] = [];

        if (!editedTable) return false;

        if (!editedTable.name.trim()) {
            newErrors.push('Table name is required');
        }

        if (editedTable.columns.length === 0) {
            newErrors.push('Table must have at least one column');
        }

        for (const col of editedTable.columns) {
            if (!col.name.trim()) {
                newErrors.push('All columns must have a name');
                break;
            }
        }

        // Check for duplicate column names
        const colNames = editedTable.columns.map(c => c.name.toLowerCase());
        const duplicates = colNames.filter((name, idx) => colNames.indexOf(name) !== idx);
        if (duplicates.length > 0) {
            newErrors.push(`Duplicate column names: ${[...new Set(duplicates)].join(', ')}`);
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    }, [editedTable]);

    const handleSave = useCallback(() => {
        // If in SQL mode, parse SQL first
        if (editorMode === 'sql') {
            const { table: parsedTable, error } = parseTableFromSql(sqlCode);
            if (error) {
                setSqlError(error);
                return;
            }
            if (parsedTable && validate()) {
                onSave(parsedTable);
                onClose();
            }
        } else {
            if (validate() && editedTable) {
                onSave(editedTable);
                onClose();
            }
        }
    }, [editorMode, sqlCode, parseTableFromSql, validate, editedTable, onSave, onClose]);

    return {
        editedTable,
        errors,
        editorMode,
        sqlCode,
        sqlError,
        handleModeChange,
        handleSqlChange,
        handleTableNameChange,
        handleColumnChange,
        handleReferenceChange,
        addColumn,
        removeColumn,
        moveColumn,
        handleSave
    };
}
