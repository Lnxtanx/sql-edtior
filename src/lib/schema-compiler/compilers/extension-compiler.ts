/**
 * Extension Compiler
 * 
 * Layer 15: Compiles PostgreSQL extensions with critical extension detection,
 * schema placement analysis, version tracking, and dependency awareness.
 */

import type { ParsedSchema, Extension } from '@/lib/sql-parser';
import type {
    ExtensionCompilation, CompilationIssue,
} from '../types';

// Well-known critical extensions
const CRITICAL_EXTENSIONS: Record<string, { category: string; description: string }> = {
    'pgcrypto': { category: 'security', description: 'Cryptographic functions' },
    'pg_trgm': { category: 'search', description: 'Trigram matching for similarity search' },
    'postgis': { category: 'spatial', description: 'Geographic object support' },
    'uuid-ossp': { category: 'utility', description: 'UUID generation functions' },
    'pg_stat_statements': { category: 'monitoring', description: 'Query statistics tracking' },
    'hstore': { category: 'data-type', description: 'Key-value store type' },
    'citext': { category: 'data-type', description: 'Case-insensitive text type' },
    'ltree': { category: 'data-type', description: 'Hierarchical tree-like data type' },
    'pg_partman': { category: 'partitioning', description: 'Partition management' },
    'timescaledb': { category: 'time-series', description: 'Time-series database extension' },
    'pg_cron': { category: 'scheduling', description: 'Job scheduling inside PostgreSQL' },
    'pgaudit': { category: 'security', description: 'Audit logging for PostgreSQL' },
    'plpgsql': { category: 'language', description: 'PL/pgSQL procedural language' },
    'plpython3u': { category: 'language', description: 'PL/Python3 untrusted' },
    'pljava': { category: 'language', description: 'PL/Java procedural language' },
    'pg_repack': { category: 'maintenance', description: 'Online table reorganization' },
    'pg_hint_plan': { category: 'performance', description: 'Query plan hints' },
    'tablefunc': { category: 'utility', description: 'Crosstab and normal_rand functions' },
    'fuzzystrmatch': { category: 'search', description: 'Fuzzy string matching' },
    'unaccent': { category: 'search', description: 'Text search dictionary for unaccenting' },
    'btree_gist': { category: 'index', description: 'GiST index operator classes for B-tree' },
    'btree_gin': { category: 'index', description: 'GIN index operator classes for B-tree' },
    'intarray': { category: 'data-type', description: 'Integer array functions and operators' },
};

// Extensions that should not be in public schema
const SCHEMA_SENSITIVE_EXTENSIONS = new Set([
    'pgcrypto', 'pgaudit', 'pg_stat_statements', 'pg_cron',
]);

export function compileExtensions(schema: ParsedSchema): { extensions: ExtensionCompilation[]; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    const extensions: ExtensionCompilation[] = schema.extensions.map(ext => {
        const knownInfo = CRITICAL_EXTENSIONS[ext.name.toLowerCase()];
        return {
            name: ext.name,
            schema: ext.schema || 'public',
            version: ext.version,
            category: knownInfo?.category || 'unknown',
            description: knownInfo?.description || '',
            isCritical: !!knownInfo,
        };
    });

    // Detect extensions in public schema that should be in a dedicated schema
    const misplacedExtensions: string[] = [];
    for (const ext of extensions) {
        if (
            SCHEMA_SENSITIVE_EXTENSIONS.has(ext.name.toLowerCase()) &&
            (ext.schema === 'public' || !ext.schema)
        ) {
            misplacedExtensions.push(ext.name);
            issues.push({
                id: `extension-schema-${ext.name}`,
                layer: 'extension',
                severity: 'info',
                category: 'misplaced-extension',
                title: 'Extension in public schema',
                message: `Extension "${ext.name}" is installed in the public schema. Consider a dedicated schema for security-sensitive extensions.`,
                affectedObjects: [{ type: 'extension', name: ext.name }],
                remediation: `CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION "${ext.name}" SCHEMA extensions;`,
                riskScore: 15,
            });
        }
    }

    // Detect untrusted language extensions
    const untrustedLanguages: string[] = [];
    for (const ext of extensions) {
        if (/^pl.+u$/i.test(ext.name)) {
            untrustedLanguages.push(ext.name);
            issues.push({
                id: `extension-untrusted-${ext.name}`,
                layer: 'extension',
                severity: 'warning',
                category: 'untrusted-language',
                title: 'Untrusted language extension',
                message: `Extension "${ext.name}" is an untrusted language. Functions in this language have unrestricted access to the operating system.`,
                affectedObjects: [{ type: 'extension', name: ext.name }],
                remediation: 'Ensure only trusted users can create functions in this language. Use REVOKE USAGE on the language from PUBLIC.',
                riskScore: 55,
            });
        }
    }

    // Detect type usage that implies missing extensions
    const suggestedExtensions: string[] = [];
    const columnTypes = new Set<string>();
    for (const table of schema.tables) {
        for (const col of table.columns) {
            columnTypes.add(col.type.toLowerCase());
        }
    }

    const extensionNames = new Set(extensions.map(e => e.name.toLowerCase()));

    // Check if using UUID but missing uuid-ossp
    if (columnTypes.has('uuid') && !extensionNames.has('uuid-ossp') && !extensionNames.has('pgcrypto')) {
        suggestedExtensions.push('uuid-ossp or pgcrypto');
        issues.push({
            id: 'extension-suggest-uuid',
            layer: 'extension',
            severity: 'info',
            category: 'suggested-extension',
            title: 'UUID type without generator',
            message: 'UUID columns found but neither uuid-ossp nor pgcrypto extensions are present. UUID generation may be done externally.',
            affectedObjects: [],
            riskScore: 5,
        });
    }

    // Check if using geometry/geography but missing PostGIS
    if ((columnTypes.has('geometry') || columnTypes.has('geography')) && !extensionNames.has('postgis')) {
        suggestedExtensions.push('postgis');
        issues.push({
            id: 'extension-suggest-postgis',
            layer: 'extension',
            severity: 'warning',
            category: 'suggested-extension',
            title: 'Spatial columns without PostGIS',
            message: 'Geometry/geography columns found but PostGIS extension is not present.',
            affectedObjects: [],
            riskScore: 30,
        });
    }

    // Check if using citext but missing extension
    if (columnTypes.has('citext') && !extensionNames.has('citext')) {
        suggestedExtensions.push('citext');
    }

    // Count by category
    const categoryCounts = new Map<string, number>();
    for (const ext of extensions) {
        categoryCounts.set(ext.category, (categoryCounts.get(ext.category) || 0) + 1);
    }

    return {
        extensions,
        issues,
    };
}
