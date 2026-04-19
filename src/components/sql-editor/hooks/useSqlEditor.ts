/**
 * useSqlEditor Hook
 * 
 * Manages SQL editor state including text content, parsing, formatting,
 * and schema generation.
 */

import { useState, useCallback, useEffect } from 'react';
import { parsePostgresSQL, ParsedSchema } from '@/lib/sql-parser';
import { formatAndValidateSchema, FormatterResult, getIssueSummary } from '@/lib/schema-utils/sql-formatter';
import { analyzeSchema, SchemaAnalysis } from '@/lib/schema-utils/schema-analysis';
import { buildSchemaGraph, SchemaGraph } from '@/lib/schema-workspace';
import { compileSchema } from '@/lib/schema-compiler';
import type { CompilationResult } from '@/lib/schema-compiler/types';
import { compilationCache, hashSchema } from '@/lib/schema-compiler/progressive-loading';
import { toast } from 'sonner';

export interface UseSqlEditorOptions {
    /** Controlled SQL content */
    sql: string;
    /** Merged SQL from all project files (for diagram generation) */
    mergedSql?: string;
    /** Controlled setter */
    setSql: (sql: string) => void;
    /** Callback when schema changes */
    onSchemaChange?: (schema: ParsedSchema) => void;
}

export interface UseSqlEditorReturn {
    /** Current SQL text */
    sql: string;
    /** Set SQL text */
    setSql: (sql: string) => void;
    /** Whether processing is in progress */
    isProcessing: boolean;
    /** Parsed schema (null if not parsed yet) */
    schema: ParsedSchema | null;
    /** Schema graph for workspace operations */
    graph: SchemaGraph | null;
    /** Schema analysis results */
    analysis: SchemaAnalysis | null;
    /** Schema compilation results (20-layer deep analysis) */
    compilation: CompilationResult | null;
    /** Format validation results */
    formatResult: FormatterResult | null;
    /** Format the SQL */
    handleFormat: () => void;
    /** Parse and generate schema */
    handleGenerate: () => void;
    /** Clear all content */
    handleClear: () => void;
    /** Handle paste event with formatting */
    handlePaste: (e: React.ClipboardEvent) => void;
    /** Handle keyboard shortcuts */
    handleKeyDown: (e: React.KeyboardEvent) => void;
    /** Copy SQL to clipboard */
    copyToClipboard: () => void;
}

/**
 * PostgreSQL SQL formatter for paste handling
 */
function formatPostgresSQL(sql: string): string {
    let formatted = sql;
    formatted = formatted.replace(/\r\n/g, '\n');
    formatted = formatted.replace(/;\s*/g, ';\n\n');
    formatted = formatted.replace(/CREATE\s+TABLE\s+(\w+)\s*\(/gi, 'CREATE TABLE $1 (\n  ');
    formatted = formatted.replace(/CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM\s*\(/gi, 'CREATE TYPE $1 AS ENUM (');
    formatted = formatted.replace(/,(?![^(]*\))/g, ',\n  ');
    formatted = formatted.replace(/\n\s*\);/g, '\n);');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    return formatted.trim();
}

/**
 * Hook for managing SQL editor state
 */
export function useSqlEditor(options: UseSqlEditorOptions): UseSqlEditorReturn {
    const {
        sql,
        mergedSql,
        setSql,
        onSchemaChange,
    } = options;

    const [isProcessing, setIsProcessing] = useState(false);
    const [schema, setSchema] = useState<ParsedSchema | null>(null);
    const [graph, setGraph] = useState<SchemaGraph | null>(null);
    const [analysis, setAnalysis] = useState<SchemaAnalysis | null>(null);
    const [compilation, setCompilation] = useState<CompilationResult | null>(null);
    const [formatResult, setFormatResult] = useState<FormatterResult | null>(null);

    // Run analysis and compilation when schema changes
    useEffect(() => {
        if (schema && schema.tables.length > 0) {
            const result = analyzeSchema(schema);
            setAnalysis(result);

            // Build schema graph
            const schemaGraph = buildSchemaGraph(schema, schema.parseTime || 0);
            setGraph(schemaGraph);

            // Run schema compilation (20-layer deep analysis)
            // Use hash-based caching to avoid redundant work
            try {
                const schemaHash = hashSchema(schema);
                const cached = compilationCache.get(schemaHash);
                
                let compilationResult: CompilationResult;
                
                if (cached) {
                    // Reuse cached result
                    compilationResult = cached.fullResult!;
                } else {
                    // Compile and cache
                    compilationResult = compileSchema(schema);
                    compilationCache.set(compilationResult);
                }
                
                setCompilation(compilationResult);
            } catch (err) {
                console.warn('Schema compilation failed:', err);
                setCompilation(null);
            }
        } else {
            setAnalysis(null);
            setGraph(null);
            setCompilation(null);
        }
    }, [schema]);

    // Format SQL
    const handleFormat = useCallback(() => {
        if (!sql.trim()) return;

        const result = formatAndValidateSchema(sql);
        setSql(result.formattedSql);
        setFormatResult(result);

        const summary = getIssueSummary(result.issues);

        if (result.canGenerateERDiagram) {
            if (summary.warnings > 0) {
                toast.warning('Schema formatted with warnings', {
                    description: summary.summary,
                });
            } else {
                toast.success('Schema formatted successfully', {
                    description: `${result.stats.tablesFound} tables, ${result.stats.foreignKeysFound} foreign keys`,
                });
            }
        } else {
            toast.error('Schema has errors', {
                description: summary.summary,
            });
        }
    }, [sql, setSql]);

    // Parse and generate schema
    const handleGenerate = useCallback(() => {
        setIsProcessing(true);

        // Use merged SQL if available (multiple files), otherwise use current file SQL
        const sqlToGenerate = (mergedSql && mergedSql.trim()) ? mergedSql : sql;

        // Pre-validate schema
        const validationResult = formatAndValidateSchema(sqlToGenerate);
        setFormatResult(validationResult);

        if (!validationResult.canGenerateERDiagram) {
            setIsProcessing(false);
            toast.error('Cannot generate ER diagram', {
                description: `${validationResult.issues.filter(i => i.type === 'error').length} errors need to be fixed first`,
            });
            return;
        }

        // Parse asynchronously to allow UI update
        queueMicrotask(() => {
            const parsed = parsePostgresSQL(validationResult.formattedSql);
            setSchema(parsed);
            onSchemaChange?.(parsed);
            setIsProcessing(false);

            if (parsed.tables.length === 0 && validationResult.stats.tablesFound > 0) {
                toast.warning('No tables parsed', {
                    description: 'The schema may have syntax issues. Try using Format & Validate first.',
                });
            }
        });
    }, [sql, mergedSql, onSchemaChange]);

    // Clear all content
    const handleClear = useCallback(() => {
        setSql('');
        const emptySchema: ParsedSchema = {
            tables: [],
            relationships: [],
            enums: new Map(),
            enumTypes: [],
            views: [],
            triggers: [],
            indexes: [],
            sequences: [],
            functions: [],
            roles: [],
            policies: [],
            extensions: [],
            schemas: [],
            domains: [],
            compositeTypes: [],
            stats: {
                dataTypes: new Map(),
                primaryKeys: 0,
                foreignKeys: 0,
                uniqueConstraints: 0,
                checkConstraints: 0,
                notNullConstraints: 0,
                indexTypes: new Map(),
                generatedColumns: 0,
                defaultValues: 0,
                partitionedTables: 0,
                childPartitions: 0,
                temporaryTables: 0,
                inheritedTables: 0,
                rlsPolicies: 0,
            },
            errors: [],
            warnings: [],
            confidence: 1.0,
        };
        setSchema(emptySchema);
        onSchemaChange?.(emptySchema);
        setFormatResult(null);
        setAnalysis(null);
        setGraph(null);
        setCompilation(null);
    }, [setSql, onSchemaChange]);

    // Handle paste with formatting
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const formattedSQL = formatPostgresSQL(pastedText);
        setSql(formattedSQL);
    }, [setSql]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleGenerate();
        }
    }, [handleGenerate]);

    // Copy to clipboard
    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(sql);
        toast.success('Copied to clipboard');
    }, [sql]);

    return {
        sql,
        setSql,
        isProcessing,
        schema,
        graph,
        analysis,
        compilation,
        formatResult,
        handleFormat,
        handleGenerate,
        handleClear,
        handlePaste,
        handleKeyDown,
        copyToClipboard,
    };
}
