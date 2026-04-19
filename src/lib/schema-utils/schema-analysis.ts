// Schema Analysis - Detect issues and provide suggestions
import { ParsedSchema, Table, Column, Relationship } from '../sql-parser';

export interface SchemaIssue {
  type: 'error' | 'warning' | 'suggestion';
  category: 'missing-pk' | 'missing-fk-index' | 'circular-ref' | 'normalization' | 'naming' | 'performance' | 'security';
  table?: string;
  column?: string;
  message: string;
  suggestion?: string;
}

export interface SchemaAnalysis {
  issues: SchemaIssue[];
  score: number; // 0-100 health score
  summary: {
    errors: number;
    warnings: number;
    suggestions: number;
  };
}

// =============================================================================
// Main Analysis Function
// =============================================================================
export function analyzeSchema(schema: ParsedSchema): SchemaAnalysis {
  const issues: SchemaIssue[] = [];

  // Run all analysis checks
  issues.push(...checkMissingPrimaryKeys(schema));
  issues.push(...checkMissingForeignKeyIndexes(schema));
  issues.push(...checkCircularReferences(schema));
  issues.push(...checkNormalizationIssues(schema));
  issues.push(...checkNamingConventions(schema));
  issues.push(...checkPerformanceIssues(schema));
  issues.push(...checkSecurityIssues(schema));

  // Calculate summary
  const summary = {
    errors: issues.filter(i => i.type === 'error').length,
    warnings: issues.filter(i => i.type === 'warning').length,
    suggestions: issues.filter(i => i.type === 'suggestion').length,
  };

  // Calculate health score
  const score = calculateHealthScore(schema, issues);

  return { issues, score, summary };
}

// =============================================================================
// Check: Missing Primary Keys
// =============================================================================
function checkMissingPrimaryKeys(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const table of schema.tables) {
    const hasPrimaryKey = table.columns.some(c => c.isPrimaryKey);
    
    if (!hasPrimaryKey) {
      issues.push({
        type: 'error',
        category: 'missing-pk',
        table: table.name,
        message: `Table "${table.name}" has no primary key defined`,
        suggestion: 'Add a PRIMARY KEY constraint. Consider using a UUID or SERIAL column as the primary key.',
      });
    }
  }

  return issues;
}

// =============================================================================
// Check: Missing Indexes on Foreign Keys
// =============================================================================
function checkMissingForeignKeyIndexes(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  // Get all indexed columns
  const indexedColumns = new Set<string>();
  for (const index of schema.indexes) {
    for (const col of index.columns) {
      indexedColumns.add(`${index.table}.${col}`);
    }
  }

  // Check each FK column
  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (column.isForeignKey) {
        const colKey = `${table.name}.${column.name}`;
        
        // Primary keys are automatically indexed, skip those
        if (!column.isPrimaryKey && !indexedColumns.has(colKey)) {
          issues.push({
            type: 'warning',
            category: 'missing-fk-index',
            table: table.name,
            column: column.name,
            message: `Foreign key "${column.name}" in "${table.name}" may benefit from an index`,
            suggestion: `CREATE INDEX idx_${table.name}_${column.name} ON ${table.name}(${column.name});`,
          });
        }
      }
    }
  }

  return issues;
}

// =============================================================================
// Check: Circular References
// =============================================================================
function checkCircularReferences(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const graph = new Map<string, string[]>();

  // Build adjacency list
  for (const rel of schema.relationships) {
    if (!graph.has(rel.source.table)) {
      graph.set(rel.source.table, []);
    }
    graph.get(rel.source.table)!.push(rel.target.table);
  }

  // Find cycles using DFS
  const cycles = findCycles(graph);

  for (const cycle of cycles) {
    issues.push({
      type: 'warning',
      category: 'circular-ref',
      message: `Circular reference detected: ${cycle.join(' → ')} → ${cycle[0]}`,
      suggestion: 'Consider if this circular dependency is intentional. If not, refactor to break the cycle.',
    });
  }

  return issues;
}

function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          // Avoid duplicate cycles
          const cycleKey = [...cycle].sort().join(',');
          const isDuplicate = cycles.some(c => [...c].sort().join(',') === cycleKey);
          if (!isDuplicate) {
            cycles.push(cycle);
          }
        }
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

// =============================================================================
// Check: Normalization Issues
// =============================================================================
function checkNormalizationIssues(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const table of schema.tables) {
    // Check for potential denormalization (repeated column patterns)
    const columnPatterns = findRepeatingPatterns(table.columns);
    
    for (const pattern of columnPatterns) {
      issues.push({
        type: 'suggestion',
        category: 'normalization',
        table: table.name,
        message: `Columns "${pattern.columns.join(', ')}" in "${table.name}" follow a repeating pattern`,
        suggestion: `Consider normalizing into a separate table (e.g., "${pattern.suggestedTable}") with a foreign key relationship.`,
      });
    }

    // Check for columns that might contain multiple values (arrays in non-normalized form)
    for (const column of table.columns) {
      const name = column.name.toLowerCase();
      if ((name.includes('list') || name.includes('items') || name.includes('values')) && 
          !column.type.endsWith('[]')) {
        issues.push({
          type: 'suggestion',
          category: 'normalization',
          table: table.name,
          column: column.name,
          message: `Column "${column.name}" might contain multiple values`,
          suggestion: 'Consider using a PostgreSQL array type or normalizing into a separate table.',
        });
      }
    }

    // Check for wide tables (too many columns)
    if (table.columns.length > 20) {
      issues.push({
        type: 'suggestion',
        category: 'normalization',
        table: table.name,
        message: `Table "${table.name}" has ${table.columns.length} columns which may indicate poor normalization`,
        suggestion: 'Consider splitting into multiple related tables based on logical groupings.',
      });
    }
  }

  return issues;
}

interface RepeatingPattern {
  columns: string[];
  suggestedTable: string;
}

function findRepeatingPatterns(columns: Column[]): RepeatingPattern[] {
  const patterns: RepeatingPattern[] = [];
  const columnNames = columns.map(c => c.name);

  // Look for numbered suffixes (address1, address2, address3)
  const groups = new Map<string, string[]>();
  
  for (const name of columnNames) {
    const match = name.match(/^(.+?)(\d+)$/);
    if (match) {
      const base = match[1].replace(/_$/, '');
      if (!groups.has(base)) {
        groups.set(base, []);
      }
      groups.get(base)!.push(name);
    }
  }

  for (const [base, cols] of groups) {
    if (cols.length >= 2) {
      patterns.push({
        columns: cols,
        suggestedTable: `${base}s`,
      });
    }
  }

  return patterns;
}

// =============================================================================
// Check: Naming Conventions
// =============================================================================
function checkNamingConventions(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const table of schema.tables) {
    // Check table naming
    if (/[A-Z]/.test(table.name) && /_/.test(table.name)) {
      issues.push({
        type: 'suggestion',
        category: 'naming',
        table: table.name,
        message: `Table "${table.name}" mixes naming conventions (snake_case with uppercase)`,
        suggestion: 'Use consistent snake_case naming for PostgreSQL tables.',
      });
    }

    // Check for reserved words
    const reservedWords = ['user', 'order', 'group', 'table', 'index', 'constraint', 'type'];
    if (reservedWords.includes(table.name.toLowerCase())) {
      issues.push({
        type: 'warning',
        category: 'naming',
        table: table.name,
        message: `Table "${table.name}" uses a PostgreSQL reserved word`,
        suggestion: `Rename to "${table.name}s" or use a more specific name to avoid conflicts.`,
      });
    }

    // Check column naming
    for (const column of table.columns) {
      if (/[A-Z]/.test(column.name)) {
        issues.push({
          type: 'suggestion',
          category: 'naming',
          table: table.name,
          column: column.name,
          message: `Column "${column.name}" uses uppercase letters`,
          suggestion: 'PostgreSQL converts unquoted identifiers to lowercase. Use snake_case for consistency.',
        });
      }
    }
  }

  return issues;
}

// =============================================================================
// Check: Performance Issues
// =============================================================================
function checkPerformanceIssues(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const table of schema.tables) {
    // Check for JSONB columns without indexes
    const jsonbColumns = table.columns.filter(c => c.type.toLowerCase() === 'jsonb');
    const jsonbIndexed = schema.indexes.filter(i => 
      i.table === table.name && 
      i.type === 'gin' &&
      i.columns.some(c => jsonbColumns.some(jc => jc.name === c))
    );

    for (const jsonbCol of jsonbColumns) {
      const hasIndex = jsonbIndexed.some(i => i.columns.includes(jsonbCol.name));
      if (!hasIndex) {
        issues.push({
          type: 'suggestion',
          category: 'performance',
          table: table.name,
          column: jsonbCol.name,
          message: `JSONB column "${jsonbCol.name}" in "${table.name}" has no GIN index`,
          suggestion: `CREATE INDEX idx_${table.name}_${jsonbCol.name} ON ${table.name} USING gin (${jsonbCol.name});`,
        });
      }
    }

    // Check for TEXT columns that might need full-text search
    const textColumns = table.columns.filter(c => 
      c.type.toLowerCase() === 'text' && 
      (c.name.includes('description') || c.name.includes('content') || c.name.includes('body'))
    );

    for (const textCol of textColumns) {
      issues.push({
        type: 'suggestion',
        category: 'performance',
        table: table.name,
        column: textCol.name,
        message: `TEXT column "${textCol.name}" might benefit from full-text search`,
        suggestion: `Consider adding a GIN index: CREATE INDEX idx_${table.name}_${textCol.name}_fts ON ${table.name} USING gin (to_tsvector('english', ${textCol.name}));`,
      });
    }

    // Check for missing timestamp indexes on large tables
    const timestampCols = table.columns.filter(c => 
      c.type.toLowerCase().includes('timestamp') &&
      (c.name.includes('created') || c.name.includes('updated'))
    );

    for (const tsCol of timestampCols) {
      const hasIndex = schema.indexes.some(i => 
        i.table === table.name && 
        i.columns.includes(tsCol.name)
      );

      if (!hasIndex && table.columns.length > 5) {
        issues.push({
          type: 'suggestion',
          category: 'performance',
          table: table.name,
          column: tsCol.name,
          message: `Timestamp column "${tsCol.name}" in "${table.name}" might benefit from an index for range queries`,
          suggestion: `CREATE INDEX idx_${table.name}_${tsCol.name} ON ${table.name}(${tsCol.name});`,
        });
      }
    }
  }

  return issues;
}

// =============================================================================
// Check: Security Issues
// =============================================================================
function checkSecurityIssues(schema: ParsedSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  // Check for tables that might store sensitive data without RLS
  const sensitiveTablePatterns = ['user', 'account', 'profile', 'credential', 'secret', 'token', 'session', 'payment', 'card', 'billing'];
  
  for (const table of schema.tables) {
    const isSensitive = sensitiveTablePatterns.some(p => table.name.toLowerCase().includes(p));
    
    if (isSensitive) {
      const hasPolicy = schema.policies.some(p => p.table === table.name);
      
      if (!hasPolicy) {
        issues.push({
          type: 'suggestion',
          category: 'security',
          table: table.name,
          message: `Table "${table.name}" may contain sensitive data but has no RLS policies`,
          suggestion: `Consider enabling Row Level Security: ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`,
        });
      }
    }

    // Check for password columns stored as plain text
    for (const column of table.columns) {
      const name = column.name.toLowerCase();
      if ((name.includes('password') || name.includes('secret') || name.includes('token')) &&
          (column.type.toLowerCase().includes('varchar') || column.type.toLowerCase() === 'text')) {
        issues.push({
          type: 'warning',
          category: 'security',
          table: table.name,
          column: column.name,
          message: `Column "${column.name}" may store sensitive data`,
          suggestion: 'Ensure this column stores hashed/encrypted values, not plaintext. Consider using pgcrypto.',
        });
      }
    }
  }

  return issues;
}

// =============================================================================
// Calculate Health Score
// =============================================================================
function calculateHealthScore(schema: ParsedSchema, issues: SchemaIssue[]): number {
  if (schema.tables.length === 0) return 100;

  let score = 100;

  // Deduct points based on issue severity
  for (const issue of issues) {
    switch (issue.type) {
      case 'error':
        score -= 15;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'suggestion':
        score -= 2;
        break;
    }
  }

  // Bonus points for good practices
  const tablesWithPK = schema.tables.filter(t => t.columns.some(c => c.isPrimaryKey)).length;
  const pkRatio = tablesWithPK / schema.tables.length;
  score += pkRatio * 5;

  // Bonus for having indexes
  if (schema.indexes.length > 0) {
    score += Math.min(schema.indexes.length * 2, 10);
  }

  // Bonus for having RLS policies
  if (schema.policies.length > 0) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
