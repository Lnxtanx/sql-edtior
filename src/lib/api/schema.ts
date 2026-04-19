// =============================================================================
// Schema API Client
// Frontend schema parsing, analysis, and export API calls
// =============================================================================

import { post, get } from './client';
import type { TableData } from '../sql-parser';

// =============================================================================
// Types
// =============================================================================

export interface ParsedSchema {
    tables: TableData[];
    enums: Record<string, string[]>;
    extensions: string[];
}

export interface SchemaIssue {
    type: 'error' | 'warning' | 'suggestion';
    category: string;
    table?: string;
    column?: string;
    message: string;
    suggestion?: string;
}

export interface SchemaAnalysis {
    score: number;
    issues: SchemaIssue[];
    summary: {
        tables: number;
        columns: number;
        relationships: number;
        indexes: number;
        errors: number;
        warnings: number;
        suggestions: number;
    };
}

export type ExportFormat = 
    | 'postgresql'
    | 'prisma'
    | 'drizzle'
    | 'dbml'
    | 'markdown'
    | 'typescript';

export interface ExportResult {
    format: ExportFormat;
    content: string;
    filename: string;
}

export interface SupportedFormats {
    formats: {
        id: ExportFormat;
        name: string;
        extension: string;
    }[];
}

// =============================================================================
// Schema API Functions
// =============================================================================

/**
 * Parse SQL to structured schema
 */
export async function parseSchema(sql: string): Promise<ParsedSchema> {
    return post<ParsedSchema>('/api/schema/parse', { sql });
}

/**
 * Analyze schema for issues and improvements
 */
export async function analyzeSchema(params: {
    sql?: string;
    tables?: TableData[];
}): Promise<SchemaAnalysis> {
    return post<SchemaAnalysis>('/api/schema/analyze', params);
}

/**
 * Export schema to a specific format
 */
export async function exportSchema(
    format: ExportFormat,
    params: {
        sql?: string;
        tables?: TableData[];
        enums?: Record<string, string[]>;
    }
): Promise<ExportResult> {
    return post<ExportResult>(`/api/schema/export/${format}`, params);
}

/**
 * Get list of supported export formats
 */
export async function getSupportedFormats(): Promise<SupportedFormats> {
    return get<SupportedFormats>('/api/schema/formats');
}
