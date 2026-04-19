/**
 * RLS (Row-Level Security) Compiler
 * 
 * Layer 12: Compiles RLS policies with gap detection,
 * over-permissive policy warnings, conflict detection, and coverage analysis.
 */

import type { ParsedSchema, Policy, Table } from '@/lib/sql-parser';
import type {
    RLSCompilation, CompilationIssue, RLSPolicyEntry,
    PolicyConflict, RLSCoverage, OverPermissivePolicy,
} from '../types';

// Tables with columns that typically hold sensitive data
const SENSITIVE_COLUMN_PATTERNS = [
    /password/i, /secret/i, /token/i, /ssn/i, /salary/i,
    /credit_card/i, /bank_account/i, /social_security/i,
    /medical/i, /health/i, /dob|date_of_birth/i, /email/i,
    /phone/i, /address/i, /tax_id/i,
];

export function compileRLS(schema: ParsedSchema): { rls: RLSCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build policy entries
    const policies: RLSPolicyEntry[] = schema.policies.map(p => ({
        name: p.name,
        schema: p.schema,
        table: p.table,
        command: p.command || 'ALL',
        roles: p.roles || [],
        using: p.usingExpression,
        withCheck: p.checkExpression,
        isPermissive: p.permissive !== false,
    }));

    // Determine which tables have RLS enabled
    // We infer from policies: if a table has policies, it likely has RLS enabled
    const tablesWithPolicies = new Set(policies.map(p => p.table));

    // Detect sensitive tables (tables with PII-like column names)
    const sensitiveTables = new Set<string>();
    for (const table of schema.tables) {
        for (const col of table.columns) {
            if (SENSITIVE_COLUMN_PATTERNS.some(p => p.test(col.name))) {
                sensitiveTables.add(table.name);
                break;
            }
        }
    }

    // RLS enabled tables without policies
    const enabledWithoutPolicies: string[] = [];

    // Sensitive tables without RLS
    const sensitiveSansRLS: string[] = [];
    for (const tableName of sensitiveTables) {
        if (!tablesWithPolicies.has(tableName)) {
            sensitiveSansRLS.push(tableName);
            issues.push({
                id: `rls-sensitive-no-rls-${tableName}`,
                layer: 'rls',
                severity: 'warning',
                category: 'missing-rls',
                title: 'Sensitive table without RLS',
                message: `Table "${tableName}" contains potentially sensitive columns but has no RLS policies.`,
                affectedObjects: [{ type: 'table', name: tableName }],
                remediation: `Consider enabling RLS: ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`,
                riskScore: 50,
            });
        }
    }

    // Detect over-permissive policies
    const overPermissivePolicies: OverPermissivePolicy[] = [];
    for (const policy of policies) {
        const isOverPermissive =
            policy.command === 'ALL' &&
            (policy.roles.length === 0 || policy.roles.includes('public')) &&
            (!policy.using || policy.using.trim().toLowerCase() === 'true');
        if (isOverPermissive) {
            overPermissivePolicies.push({
                table: policy.table,
                policy: policy.name,
                reason: 'Grants ALL access with USING(true) to all roles',
                risk: 'high',
            });
            issues.push({
                id: `rls-over-permissive-${policy.name}`,
                layer: 'rls',
                severity: 'error',
                category: 'over-permissive-rls',
                title: 'Over-permissive RLS policy',
                message: `Policy "${policy.name}" on "${policy.table}" grants ALL access with USING(true) to all roles. This effectively bypasses RLS.`,
                affectedObjects: [
                    { type: 'policy', name: policy.name },
                    { type: 'table', name: policy.table },
                ],
                remediation: 'Restrict the USING clause or limit roles to specific security contexts.',
                riskScore: 75,
            });
        }
    }

    // Policy conflicts: permissive + restrictive on same table/command
    const policyConflicts: PolicyConflict[] = [];
    const policyGroupByTable = new Map<string, RLSPolicyEntry[]>();
    for (const policy of policies) {
        const key = `${policy.table}:${policy.command}`;
        if (!policyGroupByTable.has(key)) policyGroupByTable.set(key, []);
        policyGroupByTable.get(key)!.push(policy);
    }

    for (const [key, group] of policyGroupByTable) {
        const permissive = group.filter(p => p.isPermissive);
        const restrictive = group.filter(p => !p.isPermissive);

        if (permissive.length > 0 && restrictive.length > 0) {
            const [table, command] = key.split(':');
            policyConflicts.push({
                table,
                command,
                permissivePolicies: permissive.map(p => p.name),
                restrictivePolicies: restrictive.map(p => p.name),
                risk: 'Mixed permissive and restrictive policies create complex access rules. Permissive policies are OR-ed, then AND-ed with restrictive. Verify behavior carefully.',
            });
            issues.push({
                id: `rls-conflict-${key}`,
                layer: 'rls',
                severity: 'info',
                category: 'rls-conflict',
                title: 'Mixed permissive/restrictive policies',
                message: `Table "${table}" has both permissive (${permissive.map(p => p.name).join(', ')}) and restrictive (${restrictive.map(p => p.name).join(', ')}) policies for ${command}. Verify combined behavior.`,
                affectedObjects: group.map(p => ({ type: 'policy' as const, name: p.name })),
                riskScore: 25,
            });
        }
    }

    // RLS coverage analysis
    const coverage: RLSCoverage = {
        totalTables: schema.tables.length,
        tablesWithRLS: tablesWithPolicies.size,
        tablesWithoutRLS: schema.tables.length - tablesWithPolicies.size,
        coveragePercent: schema.tables.length > 0
            ? Math.round((tablesWithPolicies.size / schema.tables.length) * 100)
            : 0,
        sensitiveTables: sensitiveTables.size,
        sensitiveTablesWithRLS: [...sensitiveTables].filter(t => tablesWithPolicies.has(t)).length,
    };

    // Detect missing WITH CHECK
    for (const policy of policies) {
        if (
            (policy.command === 'INSERT' || policy.command === 'UPDATE' || policy.command === 'ALL') &&
            policy.using &&
            !policy.withCheck
        ) {
            issues.push({
                id: `rls-missing-with-check-${policy.name}`,
                layer: 'rls',
                severity: 'info',
                category: 'missing-with-check',
                title: 'Missing WITH CHECK clause',
                message: `Policy "${policy.name}" on "${policy.table}" for ${policy.command} has USING but no WITH CHECK. New/modified rows will default to USING clause for write validation.`,
                affectedObjects: [{ type: 'policy', name: policy.name }],
                remediation: 'Add an explicit WITH CHECK clause if write validation differs from read validation.',
                riskScore: 15,
            });
        }
    }

    return {
        rls: {
            policies,
            enabledWithoutPolicies,
            overPermissivePolicies,
            policyConflicts,
            sensitiveSansRLS,
            coverage,
        },
        issues,
    };
}
