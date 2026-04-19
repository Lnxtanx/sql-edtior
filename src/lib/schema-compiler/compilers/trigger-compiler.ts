/**
 * Trigger Compiler
 * 
 * Layer 11: Compiles triggers with ordering conflict detection,
 * partitioned parent trigger warnings, missing function detection, and density analysis.
 */

import type { ParsedSchema, Trigger } from '@/lib/sql-parser';
import type {
    TriggerCompilation, CompilationIssue, TriggerEntry,
    TriggerConflict, HighDensityTable,
} from '../types';

export function compileTriggers(schema: ParsedSchema): { triggers: TriggerCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build function name set — include both fully-qualified and bare names
    // Parser stores functions as "schema.name" but triggers store functionName as bare name + functionSchema
    const functionNames = new Set<string>();
    for (const fn of schema.functions) {
        functionNames.add(fn.name.toLowerCase()); // schema-qualified: "public.update_updated_at"
        // Also add bare name (after last dot) for matching trigger references
        const bareName = fn.name.includes('.') ? fn.name.split('.').pop()!.toLowerCase() : fn.name.toLowerCase();
        functionNames.add(bareName);
        // Also add schema.bareName variant
        if (fn.schema) {
            functionNames.add(`${fn.schema}.${bareName}`.toLowerCase());
        }
    }

    // Build partitioned table set
    const partitionedTables = new Set(
        schema.tables.filter(t => t.isPartitioned).map(t => t.name)
    );

    const triggers: TriggerEntry[] = schema.triggers.map(t => ({
        name: t.name,
        schema: t.schema,
        table: t.table,
        timing: t.timing,
        events: t.events,
        level: t.level,
        functionName: t.functionName || '',
        functionSchema: t.functionSchema,
        condition: t.condition,
        isConstraintTrigger: false,
        isDeferrable: false,
        isEnabled: true,
    }));

    // Ordering conflicts: multiple triggers on same table/event/timing
    const orderingConflicts: TriggerConflict[] = [];
    const triggerGroups = new Map<string, TriggerEntry[]>();

    for (const trigger of triggers) {
        for (const event of trigger.events) {
            const key = `${trigger.table}:${event}:${trigger.timing}`;
            if (!triggerGroups.has(key)) triggerGroups.set(key, []);
            triggerGroups.get(key)!.push(trigger);
        }
    }

    for (const [key, group] of triggerGroups) {
        if (group.length > 1) {
            const [table, event, timing] = key.split(':');
            orderingConflicts.push({
                table,
                event,
                timing,
                triggers: group.map(t => t.name),
                risk: `${group.length} ${timing} ${event} triggers on "${table}": execution order may be alphabetical, not guaranteed.`,
            });
            issues.push({
                id: `trigger-ordering-${key}`,
                layer: 'trigger',
                severity: 'warning',
                category: 'ordering-conflict',
                title: 'Trigger ordering conflict',
                message: `Table "${table}" has ${group.length} ${timing} ${event} triggers (${group.map(t => t.name).join(', ')}). Execution order depends on alphabetical name ordering.`,
                affectedObjects: group.map(t => ({ type: 'trigger' as const, name: t.name })),
                remediation: 'PostgreSQL fire triggers in alphabetical order. Rename triggers to control execution order if needed.',
                riskScore: 35,
            });
        }
    }

    // Partitioned parent triggers
    const partitionedParentTriggers: string[] = [];
    for (const trigger of triggers) {
        if (partitionedTables.has(trigger.table)) {
            partitionedParentTriggers.push(trigger.name);
            issues.push({
                id: `trigger-partitioned-${trigger.name}`,
                layer: 'trigger',
                severity: 'info',
                category: 'partitioned-trigger',
                title: 'Trigger on partitioned table',
                message: `Trigger "${trigger.name}" is on partitioned table "${trigger.table}". In PostgreSQL, triggers on partitioned tables fire for all partitions.`,
                affectedObjects: [
                    { type: 'trigger', name: trigger.name },
                    { type: 'table', name: trigger.table },
                ],
                riskScore: 15,
            });
        }
    }

    // Missing trigger functions — try bare name, schema.name, and functionSchema.name
    const missingTriggerFunctions: string[] = [];
    for (const trigger of triggers) {
        if (!trigger.functionName) continue;
        const fnLower = trigger.functionName.toLowerCase();
        const fnSchemaQualified = trigger.functionSchema
            ? `${trigger.functionSchema}.${fnLower}`.toLowerCase()
            : null;
        const found = functionNames.has(fnLower) ||
            (fnSchemaQualified ? functionNames.has(fnSchemaQualified) : false);
        if (!found) {
            missingTriggerFunctions.push(trigger.name);
            issues.push({
                id: `trigger-missing-func-${trigger.name}`,
                layer: 'trigger',
                severity: 'error',
                category: 'missing-trigger-function',
                title: 'Missing trigger function',
                message: `Trigger "${trigger.name}" references function "${trigger.functionName}" which is not found in this schema.`,
                affectedObjects: [{ type: 'trigger', name: trigger.name }],
                remediation: `Create the missing function: CREATE FUNCTION ${trigger.functionName}() RETURNS trigger ...`,
                riskScore: 65,
            });
        }
    }

    // Disabled triggers
    const disabledTriggers = triggers.filter(t => !t.isEnabled).map(t => t.name);

    // High density tables
    const triggerCountByTable = new Map<string, { count: number; events: Set<string> }>();
    for (const trigger of triggers) {
        if (!triggerCountByTable.has(trigger.table)) {
            triggerCountByTable.set(trigger.table, { count: 0, events: new Set() });
        }
        const entry = triggerCountByTable.get(trigger.table)!;
        entry.count++;
        trigger.events.forEach(e => entry.events.add(e));
    }

    const highDensityTables: HighDensityTable[] = [];
    for (const [table, info] of triggerCountByTable) {
        if (info.count >= 5) {
            highDensityTables.push({
                table,
                triggerCount: info.count,
                events: Array.from(info.events),
                risk: 'high',
            });
            issues.push({
                id: `trigger-high-density-${table}`,
                layer: 'trigger',
                severity: 'warning',
                category: 'high-trigger-density',
                title: 'High trigger density',
                message: `Table "${table}" has ${info.count} triggers. High trigger density affects write performance and debugging.`,
                affectedObjects: [{ type: 'table', name: table }],
                remediation: 'Consolidate triggers where possible. Consider combining logic into fewer trigger functions.',
                riskScore: 45,
            });
        } else if (info.count >= 3) {
            highDensityTables.push({
                table,
                triggerCount: info.count,
                events: Array.from(info.events),
                risk: 'medium',
            });
        }
    }

    return {
        triggers: {
            triggers,
            orderingConflicts,
            partitionedParentTriggers,
            missingTriggerFunctions,
            disabledTriggers,
            highDensityTables,
        },
        issues,
    };
}
