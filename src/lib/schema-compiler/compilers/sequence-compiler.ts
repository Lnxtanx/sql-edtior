/**
 * Sequence Compiler
 * 
 * Layer 14: Compiles sequences with orphan detection,
 * shared sequence warnings, ownership analysis, and overflow risk.
 */

import type { ParsedSchema, Sequence } from '@/lib/sql-parser';
import type {
    SequenceCompilation, CompilationIssue, SequenceEntry,
} from '../types';

export function compileSequences(schema: ParsedSchema): { sequences: SequenceCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build column reference set (table.column combos that are SERIAL/IDENTITY/use sequences)
    const serialColumns = new Set<string>();
    const identityColumns = new Set<string>();
    const allColumns = new Map<string, Set<string>>();

    for (const table of schema.tables) {
        const colSet = new Set<string>();
        for (const col of table.columns) {
            colSet.add(col.name);

            // Detect serial columns by type or default value
            const colType = col.type.toLowerCase();
            if (colType.includes('serial')) {
                serialColumns.add(`${table.name}.${col.name}`);
            }
            if (col.isGenerated || (col.defaultValue && /nextval/i.test(col.defaultValue))) {
                serialColumns.add(`${table.name}.${col.name}`);
            }
        }
        allColumns.set(table.name, colSet);
    }

    // Build sequence entries
    const sequences: SequenceEntry[] = schema.sequences.map(seq => {
        // Strip schema prefix before matching convention: tablename_columnname_seq
        const bareName = seq.name.includes('.') ? seq.name.split('.').pop()! : seq.name;
        const ownerMatch = bareName.match(/^(.+?)_(.+?)_seq$/);
        const inferredTableBare = ownerMatch?.[1];
        const inferredColumn = ownerMatch?.[2];

        // Try to find matching table — check both bare name and all schema-qualified variants
        let hasOwner = false;
        let ownerTable: string | undefined;
        if (inferredTableBare && inferredColumn) {
            for (const [tableName, colSet] of allColumns) {
                const tableBareName = tableName.includes('.') ? tableName.split('.').pop()! : tableName;
                if (tableBareName === inferredTableBare && colSet.has(inferredColumn)) {
                    hasOwner = true;
                    ownerTable = tableName;
                    break;
                }
            }
        }

        // Also check if any column defaults reference this sequence by name
        if (!hasOwner) {
            const seqNameLower = seq.name.toLowerCase();
            const bareNameLower = bareName.toLowerCase();
            for (const table of schema.tables) {
                for (const col of table.columns) {
                    if (col.defaultValue) {
                        const defLower = col.defaultValue.toLowerCase();
                        if (defLower.includes(seqNameLower) || defLower.includes(bareNameLower)) {
                            hasOwner = true;
                            ownerTable = table.name;
                            break;
                        }
                    }
                    // Also check for serial columns \u2014 serial type auto-creates a sequence
                    const colType = col.type.toLowerCase();
                    if (colType.includes('serial') && !hasOwner) {
                        // Serial auto-sequence naming: tablename_columnname_seq
                        const tableBareName = table.name.includes('.') ? table.name.split('.').pop()! : table.name;
                        const expectedSeqName = `${tableBareName}_${col.name}_seq`;
                        if (bareName.toLowerCase() === expectedSeqName.toLowerCase()) {
                            hasOwner = true;
                            ownerTable = table.name;
                            break;
                        }
                    }
                }
                if (hasOwner) break;
            }
        }

        return {
            name: seq.name,
            schema: seq.schema,
            dataType: seq.dataType || 'bigint',
            start: seq.start,
            increment: seq.increment,
            minValue: seq.minValue,
            maxValue: seq.maxValue,
            isCyclic: seq.cycle || false,
            ownedByTable: ownerTable,
            ownedByColumn: hasOwner ? (inferredColumn || undefined) : undefined,
            isOrphan: false,
        };
    });

    // Detect orphan sequences (not owned by any column)
    const orphanSequences: string[] = [];
    for (const seq of sequences) {
        if (!seq.ownedByTable) {
            seq.isOrphan = true;
            orphanSequences.push(seq.name);
            // Lower severity for sequences that follow naming conventions (likely auto-created)
            const bareName = seq.name.includes('.') ? seq.name.split('.').pop()! : seq.name;
            const looksAutoCreated = /_seq$/.test(bareName) && /_/.test(bareName.replace(/_seq$/, ''));
            issues.push({
                id: `sequence-orphan-${seq.name}`,
                layer: 'sequence',
                severity: looksAutoCreated ? 'info' : 'warning',
                category: 'orphan-sequence',
                title: 'Orphan sequence',
                message: `Sequence "${seq.name}" is not owned by any column. It won't be dropped when the table is dropped.`,
                affectedObjects: [{ type: 'sequence', name: seq.name }],
                remediation: `ALTER SEQUENCE "${seq.name}" OWNED BY table.column; or DROP SEQUENCE if unused.`,
                riskScore: looksAutoCreated ? 15 : 25,
            });
        }
    }

    // Detect shared sequences (multiple columns using same sequence)
    const seqUsageCount = new Map<string, string[]>();
    for (const table of schema.tables) {
        for (const col of table.columns) {
            if (col.defaultValue) {
                const match = col.defaultValue.match(/nextval\('([^']+)'/i);
                if (match) {
                    let seqName = match[1].replace(/^"(.+)"$/, '$1').replace(/'::regclass.*$/, '');
                    // Normalize: try to match against known sequence names
                    const seqLower = seqName.toLowerCase();
                    const matchedSeq = schema.sequences.find(s =>
                        s.name.toLowerCase() === seqLower ||
                        (s.name.includes('.') && s.name.split('.').pop()!.toLowerCase() === seqLower)
                    );
                    if (matchedSeq) seqName = matchedSeq.name;
                    if (!seqUsageCount.has(seqName)) seqUsageCount.set(seqName, []);
                    seqUsageCount.get(seqName)!.push(`${table.name}.${col.name}`);
                }
            }
        }
    }

    const sharedSequences: string[] = [];
    for (const [seqName, usages] of seqUsageCount) {
        if (usages.length > 1) {
            sharedSequences.push(seqName);
            issues.push({
                id: `sequence-shared-${seqName}`,
                layer: 'sequence',
                severity: 'warning',
                category: 'shared-sequence',
                title: 'Shared sequence',
                message: `Sequence "${seqName}" is shared by ${usages.length} columns: ${usages.join(', ')}. This can cause gaps and contention.`,
                affectedObjects: [{ type: 'sequence', name: seqName }],
                remediation: 'Consider using separate sequences for each column to avoid contention and unexpected gaps.',
                riskScore: 35,
            });
        }
    }

    // Detect smallint/int overflow risk (sequences with small data types)
    for (const seq of sequences) {
        const dtype = seq.dataType?.toLowerCase() || 'bigint';
        if (dtype === 'smallint' || dtype === 'int2') {
            issues.push({
                id: `sequence-overflow-${seq.name}`,
                layer: 'sequence',
                severity: 'warning',
                category: 'sequence-overflow-risk',
                title: 'Small sequence data type',
                message: `Sequence "${seq.name}" uses smallint (max 32767). This may overflow in production.`,
                affectedObjects: [{ type: 'sequence', name: seq.name }],
                remediation: `ALTER SEQUENCE "${seq.name}" AS integer; -- or bigint for more headroom.`,
                riskScore: 40,
            });
        } else if (dtype === 'integer' || dtype === 'int4' || dtype === 'int') {
            issues.push({
                id: `sequence-overflow-${seq.name}`,
                layer: 'sequence',
                severity: 'info',
                category: 'sequence-overflow-risk',
                title: 'Integer sequence',
                message: `Sequence "${seq.name}" uses integer (max ~2.1B). Consider bigint for high-volume tables.`,
                affectedObjects: [{ type: 'sequence', name: seq.name }],
                riskScore: 15,
            });
        }
    }

    // Cyclic sequences warning
    for (const seq of sequences) {
        if (seq.isCyclic) {
            issues.push({
                id: `sequence-cyclic-${seq.name}`,
                layer: 'sequence',
                severity: 'info',
                category: 'cyclic-sequence',
                title: 'Cyclic sequence',
                message: `Sequence "${seq.name}" is CYCLIC. Values will restart, potentially causing unique constraint violations.`,
                affectedObjects: [{ type: 'sequence', name: seq.name }],
                riskScore: 20,
            });
        }
    }

    return {
        sequences: {
            sequences,
            orphanSequences,
            sharedSequences,
            totalSequences: sequences.length,
        },
        issues,
    };
}
