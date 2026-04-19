/**
 * SQL Schema Formatter & Validator
 * 
 * Formats unstructured PostgreSQL schemas and detects issues
 * that may prevent ER diagram generation.
 */

export interface SchemaIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  table?: string;
  column?: string;
  suggestion?: string;
}

export interface FormatterResult {
  formattedSql: string;
  issues: SchemaIssue[];
  stats: {
    tablesFound: number;
    foreignKeysFound: number;
    enumsFound: number;
    unresolvedReferences: number;
    fixedIssues: number;
  };
  canGenerateERDiagram: boolean;
}

// PostgreSQL keywords for formatting
const PG_KEYWORDS = [
  'CREATE', 'TABLE', 'TYPE', 'ENUM', 'AS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'NOT', 'NULL', 'UNIQUE', 'DEFAULT', 'ON', 'DELETE', 'UPDATE', 'CASCADE', 'SET',
  'RESTRICT', 'NO', 'ACTION', 'CHECK', 'CONSTRAINT', 'INDEX', 'IF', 'EXISTS',
  'DROP', 'ALTER', 'ADD', 'COLUMN', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
  'INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TEXT', 'VARCHAR', 'CHAR', 'BOOLEAN',
  'BOOL', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'TIMETZ', 'INTERVAL',
  'UUID', 'JSONB', 'JSON', 'ARRAY', 'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT',
  'DOUBLE', 'PRECISION', 'MONEY', 'BYTEA', 'INET', 'CIDR', 'MACADDR',
  'WITH', 'WITHOUT', 'ZONE', 'USING', 'BTREE', 'HASH', 'GIN', 'GIST',
  'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'TRUE', 'FALSE',
  'GENERATED', 'ALWAYS', 'IDENTITY', 'SEQUENCE', 'NEXTVAL', 'PUBLIC', 'SCHEMA'
];

/**
 * Extract all table names from CREATE TABLE statements
 */
function extractTableNames(sql: string): Set<string> {
  const tableNames = new Set<string>();
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/gi;
  let match;
  
  while ((match = regex.exec(sql)) !== null) {
    const schemaName = match[1];
    const tableName = match[2];
    
    // Add table name without schema
    tableNames.add(tableName.toLowerCase());
    
    // Add with schema prefix if present
    if (schemaName) {
      tableNames.add(`${schemaName.toLowerCase()}.${tableName.toLowerCase()}`);
    }
    
    // Also add common schema prefixes for lookup
    tableNames.add(`public.${tableName.toLowerCase()}`);
    if (schemaName) {
      tableNames.add(`${schemaName.toLowerCase()}.${tableName.toLowerCase()}`);
    }
  }
  
  return tableNames;
}

/**
 * Extract all foreign key references
 */
function extractForeignKeyReferences(sql: string): Array<{
  sourceTable: string;
  sourceColumn: string;
  referencedTable: string;
  referencedSchema: string | null;
  referencedColumn: string;
  line: number;
}> {
  const references: Array<{
    sourceTable: string;
    sourceColumn: string;
    referencedTable: string;
    referencedSchema: string | null;
    referencedColumn: string;
    line: number;
  }> = [];
  
  // Find current table context
  const lines = sql.split('\n');
  let currentTable = '';
  let currentSchema = '';
  
  lines.forEach((line, lineNum) => {
    // Match CREATE TABLE with optional schema
    const tableMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/i);
    if (tableMatch) {
      currentSchema = tableMatch[1] || '';
      currentTable = tableMatch[2];
    }
    
    // Match FOREIGN KEY constraint with optional schema in reference
    const fkMatch = line.match(/CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:(\w+)\.)?(\w+)\s*\(([^)]+)\)/i);
    if (fkMatch && currentTable) {
      references.push({
        sourceTable: currentSchema ? `${currentSchema}.${currentTable}` : currentTable,
        sourceColumn: fkMatch[1].trim(),
        referencedSchema: fkMatch[2] || null,
        referencedTable: fkMatch[3],
        referencedColumn: fkMatch[4].trim(),
        line: lineNum + 1,
      });
    }
  });
  
  return references;
}

/**
 * Detect USER-DEFINED types that need to be resolved
 */
function detectUserDefinedTypes(sql: string): string[] {
  const userDefinedTypes: string[] = [];
  const regex = /\bUSER-DEFINED\b/gi;
  let match;
  
  while ((match = regex.exec(sql)) !== null) {
    userDefinedTypes.push('USER-DEFINED');
  }
  
  return userDefinedTypes;
}

/**
 * Remove warning comments from schema dumps
 */
function removeWarningComments(sql: string): string {
  // Remove lines starting with -- WARNING or similar
  return sql
    .split('\n')
    .filter(line => {
      const trimmed = line.trim().toUpperCase();
      return !(
        trimmed.startsWith('-- WARNING') ||
        trimmed.startsWith('-- THIS SCHEMA IS FOR CONTEXT') ||
        trimmed.startsWith('-- TABLE ORDER AND CONSTRAINTS MAY NOT BE VALID')
      );
    })
    .join('\n');
}

/**
 * Fix common schema issues
 */
function fixCommonIssues(sql: string): { sql: string; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = sql;
  
  // Fix ARRAY without type specification (more careful matching)
  // Match ARRAY that is followed by comma, closing paren, or DEFAULT
  // But NOT already typed like TEXT[] or integer[]
  const untypedArrayRegex = /\bARRAY\s*(?=,|\)|DEFAULT)/gi;
  if (untypedArrayRegex.test(fixed)) {
    fixed = fixed.replace(/\bARRAY\s*(?=,|\)|DEFAULT)/gi, 'TEXT[]');
    fixes.push('Replaced untyped ARRAY with TEXT[]');
  }
  
  // Fix USER-DEFINED type (replace with TEXT as placeholder)
  if (/\bUSER-DEFINED\b/i.test(fixed)) {
    fixed = fixed.replace(/\bUSER-DEFINED\b/gi, 'TEXT');
    fixes.push('Replaced USER-DEFINED types with TEXT (consider creating proper ENUMs)');
  }
  
  // Normalize whitespace
  fixed = fixed.replace(/\r\n/g, '\n');
  fixed = fixed.replace(/\t/g, '  ');
  
  return { sql: fixed, fixes };
}

/**
 * Format CREATE TABLE statements
 * This is a minimal formatter that preserves existing structure
 */
function formatCreateTable(sql: string): string {
  let formatted = sql;
  
  // Don't aggressively reformat - just clean up and normalize
  
  // Normalize line endings
  formatted = formatted.replace(/\r\n/g, '\n');
  
  // Uppercase only standalone PostgreSQL keywords (not inside identifiers or schema names)
  // Be careful not to uppercase schema names like 'storage' in 'storage.buckets'
  PG_KEYWORDS.forEach(keyword => {
    // Only match keywords that are:
    // 1. At start of line or after whitespace/punctuation
    // 2. Followed by whitespace/punctuation or end of line
    // 3. NOT preceded by a dot (to avoid matching schema.TABLE)
    const regex = new RegExp(`(?<![.\\w])\\b${keyword}\\b(?![.])`, 'gi');
    formatted = formatted.replace(regex, keyword);
  });
  
  // Ensure statements are separated by blank lines
  formatted = formatted.replace(/;\s*\n\s*CREATE/gi, ';\n\nCREATE');
  
  // Clean up multiple blank lines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  formatted = formatted.trim();
  
  return formatted;
}

/**
 * Validate schema for ER diagram generation
 */
function validateForERDiagram(sql: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const tableNames = extractTableNames(sql);
  const fkReferences = extractForeignKeyReferences(sql);
  
  // Check for unresolved foreign key references
  fkReferences.forEach(fk => {
    const refTableLower = fk.referencedTable.toLowerCase();
    const refSchema = fk.referencedSchema?.toLowerCase() || '';
    
    // Extract source table's schema if it has one
    const sourceSchema = fk.sourceTable.includes('.') 
      ? fk.sourceTable.split('.')[0].toLowerCase() 
      : '';
    
    // Build possible table name variants to check
    const possibleNames = [
      refTableLower,
      `public.${refTableLower}`,
    ];
    
    // If FK has explicit schema, add that
    if (refSchema) {
      possibleNames.push(`${refSchema}.${refTableLower}`);
    }
    
    // If source table has a schema and FK doesn't specify one,
    // the FK likely refers to a table in the same schema
    if (sourceSchema && !refSchema) {
      possibleNames.push(`${sourceSchema}.${refTableLower}`);
    }
    
    // Check if any variant exists in the table names
    const tableExists = possibleNames.some(name => tableNames.has(name));
    
    if (!tableExists) {
      const fullRefName = refSchema 
        ? `${refSchema}.${fk.referencedTable}` 
        : (sourceSchema ? `${sourceSchema}.${fk.referencedTable}` : fk.referencedTable);
      issues.push({
        type: 'error',
        code: 'FK_UNRESOLVED',
        message: `Foreign key references non-existent table: ${fullRefName}`,
        line: fk.line,
        table: fk.sourceTable,
        column: fk.sourceColumn,
        suggestion: `Ensure table "${fullRefName}" is defined before this reference, or remove the foreign key constraint`,
      });
    }
  });
  
  // Check for USER-DEFINED types (after fixes are applied, this shouldn't trigger)
  const lines = sql.split('\n');
  lines.forEach((line, idx) => {
    if (/\bUSER-DEFINED\b/i.test(line)) {
      const tableMatch = line.match(/(\w+)\s+USER-DEFINED/i);
      issues.push({
        type: 'warning',
        code: 'USER_DEFINED_TYPE',
        message: 'USER-DEFINED type detected - this needs to be replaced with an actual type',
        line: idx + 1,
        column: tableMatch?.[1],
        suggestion: 'Replace USER-DEFINED with an ENUM type or appropriate PostgreSQL type',
      });
    }
  });
  
  // Check for untyped ARRAY (more specific regex to avoid false positives)
  lines.forEach((line, idx) => {
    // Match ARRAY that is NOT followed by [, comma, ), or already has been converted to TEXT[]
    if (/\bARRAY\s*(?:,|\)|$)/i.test(line) && !/TEXT\[\]/i.test(line)) {
      issues.push({
        type: 'warning',
        code: 'UNTYPED_ARRAY',
        message: 'ARRAY without element type specification',
        line: idx + 1,
        suggestion: 'Specify array element type, e.g., TEXT[] or INTEGER[]',
      });
    }
  });
  
  // Check for circular dependencies
  const dependencyMap = new Map<string, Set<string>>();
  fkReferences.forEach(fk => {
    const source = fk.sourceTable.toLowerCase();
    const target = fk.referencedSchema 
      ? `${fk.referencedSchema.toLowerCase()}.${fk.referencedTable.toLowerCase()}`
      : fk.referencedTable.toLowerCase();
    
    if (!dependencyMap.has(source)) {
      dependencyMap.set(source, new Set());
    }
    dependencyMap.get(source)!.add(target);
  });
  
  // Simple cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(table: string, path: string[] = []): string[] | null {
    if (recursionStack.has(table)) {
      return [...path, table];
    }
    if (visited.has(table)) {
      return null;
    }
    
    visited.add(table);
    recursionStack.add(table);
    
    const deps = dependencyMap.get(table) || new Set();
    for (const dep of deps) {
      const cycle = hasCycle(dep, [...path, table]);
      if (cycle) return cycle;
    }
    
    recursionStack.delete(table);
    return null;
  }
  
  for (const table of dependencyMap.keys()) {
    visited.clear();
    recursionStack.clear();
    const cycle = hasCycle(table);
    if (cycle) {
      issues.push({
        type: 'warning',
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        suggestion: 'Consider refactoring to break the circular dependency',
      });
      break; // Only report first cycle found
    }
  }
  
  // Check for duplicate table definitions
  const tableOccurrences = new Map<string, number>();
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/gi;
  let match;
  
  while ((match = tableRegex.exec(sql)) !== null) {
    const schema = match[1] || 'public';
    const tableName = match[2].toLowerCase();
    const fullName = `${schema.toLowerCase()}.${tableName}`;
    tableOccurrences.set(fullName, (tableOccurrences.get(fullName) || 0) + 1);
  }
  
  tableOccurrences.forEach((count, table) => {
    if (count > 1) {
      issues.push({
        type: 'error',
        code: 'DUPLICATE_TABLE',
        message: `Table "${table}" is defined ${count} times`,
        table,
        suggestion: 'Remove duplicate table definitions',
      });
    }
  });
  
  return issues;
}

/**
 * Main formatting and validation function
 */
export function formatAndValidateSchema(rawSql: string): FormatterResult {
  const issues: SchemaIssue[] = [];
  let formattedSql = rawSql;
  let fixedCount = 0;
  
  // Step 1: Remove warning comments
  formattedSql = removeWarningComments(formattedSql);
  
  // Step 2: Fix common issues
  const { sql: fixedSql, fixes } = fixCommonIssues(formattedSql);
  formattedSql = fixedSql;
  fixedCount = fixes.length;
  
  fixes.forEach(fix => {
    issues.push({
      type: 'info',
      code: 'AUTO_FIX',
      message: fix,
    });
  });
  
  // Step 3: Format the SQL
  formattedSql = formatCreateTable(formattedSql);
  
  // Step 4: Validate for ER diagram generation
  const validationIssues = validateForERDiagram(formattedSql);
  issues.push(...validationIssues);
  
  // Calculate stats
  const tableNames = extractTableNames(formattedSql);
  const fkReferences = extractForeignKeyReferences(formattedSql);
  const enumMatches = formattedSql.match(/CREATE\s+TYPE\s+\w+\s+AS\s+ENUM/gi) || [];
  
  const unresolvedRefs = validationIssues.filter(i => i.code === 'FK_UNRESOLVED').length;
  const hasBlockingErrors = issues.some(i => i.type === 'error');
  
  return {
    formattedSql,
    issues,
    stats: {
      tablesFound: tableNames.size,
      foreignKeysFound: fkReferences.length,
      enumsFound: enumMatches.length,
      unresolvedReferences: unresolvedRefs,
      fixedIssues: fixedCount,
    },
    canGenerateERDiagram: !hasBlockingErrors,
  };
}

/**
 * Quick format function (format only, no validation)
 */
export function quickFormatSQL(sql: string): string {
  let formatted = removeWarningComments(sql);
  const { sql: fixed } = fixCommonIssues(formatted);
  return formatCreateTable(fixed);
}

/**
 * Get a summary of issues for display
 */
export function getIssueSummary(issues: SchemaIssue[]): {
  errors: number;
  warnings: number;
  info: number;
  summary: string;
} {
  const errors = issues.filter(i => i.type === 'error').length;
  const warnings = issues.filter(i => i.type === 'warning').length;
  const info = issues.filter(i => i.type === 'info').length;
  
  let summary = '';
  if (errors > 0) {
    summary = `${errors} error${errors > 1 ? 's' : ''} found that may prevent ER diagram generation`;
  } else if (warnings > 0) {
    summary = `${warnings} warning${warnings > 1 ? 's' : ''} found - diagram may have issues`;
  } else if (info > 0) {
    summary = `${info} auto-fix${info > 1 ? 'es' : ''} applied`;
  } else {
    summary = 'Schema is valid for ER diagram generation';
  }
  
  return { errors, warnings, info, summary };
}
