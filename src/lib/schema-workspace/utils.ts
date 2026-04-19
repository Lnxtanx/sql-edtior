/**
 * Schema Workspace Utilities
 */

/**
 * Generate a unique node ID from schema and table name.
 * Default schema is 'public'.
 */
export function toNodeId(schema: string | undefined, name: string): string {
    // If name is already qualified (contains a dot), return as-is
    // This handles cases where parsers produce qualified names (e.g. from SET search_path)
    // but don't set the schema field on the object
    if (name.includes('.')) return name;
    const s = schema || 'public';
    return `${s}.${name}`;
}

/**
 * Parse a node ID back into schema and table name.
 */
export function parseNodeId(id: string): { schema: string; name: string } {
    const parts = id.split('.');
    if (parts.length === 1) {
        return { schema: 'public', name: parts[0] };
    }
    // Handle cases where table name might contain dots (unlikely but possible with quotes)
    // For now, assume simple schema.table format
    return { schema: parts[0], name: parts.slice(1).join('.') };
}
