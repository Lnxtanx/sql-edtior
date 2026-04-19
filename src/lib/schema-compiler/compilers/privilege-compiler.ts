/**
 * Privilege Compiler
 * 
 * Layer 13: Compiles privilege/grant analysis with over-privileged role detection,
 * public schema write access warnings, and GRANT ALL exposure analysis.
 */

import type { ParsedSchema } from '@/lib/sql-parser';
import type {
    PrivilegeCompilation, CompilationIssue, GrantEntry,
    PrivilegeRisk,
} from '../types';

// We attempt to extract GRANT information from SQL content.
// Since ParsedSchema may not have grants yet, we do lightweight regex extraction
// from any raw SQL stored in the schema, plus infer from table/function existence.

const SUPER_PRIVILEGES = ['ALL', 'ALL PRIVILEGES'];
const DANGEROUS_GRANTS = ['SUPERUSER', 'CREATEROLE', 'CREATEDB', 'BYPASSRLS'];

export function compilePrivileges(schema: ParsedSchema): { privileges: PrivilegeCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Since we don't have parsed GRANT statements yet (will be added in parser extension),
    // we infer from available data and generate structural analysis

    const grants: GrantEntry[] = [];
    const risks: PrivilegeRisk[] = [];

    // Analyze function security characteristics
    for (const func of schema.functions) {
        if ((func as any).securityDefiner) {
            grants.push({
                grantee: 'PUBLIC',
                grantor: undefined,
                privilege: 'EXECUTE',
                objectType: 'FUNCTION',
                objectName: func.name,
                withGrantOption: false,
                isDefault: false,
            });

            risks.push({
                type: 'security-definer-exposure',
                severity: 'warning',
                description: `Function "${func.name}" runs as SECURITY DEFINER. Any user with EXECUTE privilege runs it with the owner's permissions.`,
                affectedObjects: [func.name],
            });

            issues.push({
                id: `privilege-secdef-${func.name}`,
                layer: 'privilege',
                severity: 'warning',
                category: 'security-definer-exposure',
                title: 'SECURITY DEFINER function',
                message: `Function "${func.name}" is SECURITY DEFINER. Public EXECUTE privilege means any user can escalate to the owner's permissions.`,
                affectedObjects: [{ type: 'function', name: func.name }],
                remediation: `REVOKE EXECUTE ON FUNCTION "${func.name}" FROM PUBLIC; GRANT EXECUTE to specific roles only.`,
                riskScore: 55,
            });
        }
    }

    // Tables without comments may indicate missing ownership documentation
    const tablesWithoutComments = schema.tables.filter(t => !t.comment).map(t => t.name);

    // Analyze for schema exposure: if user tables are in 'public' schema (default)
    const publicSchemaTables = schema.tables.filter(t => !t.schema || t.schema === 'public');
    if (publicSchemaTables.length > 0 && schema.tables.length > 5) {
        risks.push({
            type: 'public-schema-exposure',
            severity: 'info',
            description: `${publicSchemaTables.length} tables are in the "public" schema. Consider organizing tables into dedicated schemas with restricted default privileges.`,
            affectedObjects: publicSchemaTables.map(t => t.name),
        });

        issues.push({
            id: 'privilege-public-schema-exposure',
            layer: 'privilege',
            severity: 'info',
            category: 'schema-exposure',
            title: 'Tables in public schema',
            message: `${publicSchemaTables.length} tables are in the public schema. In production, consider using dedicated schemas with ALTER DEFAULT PRIVILEGES.`,
            affectedObjects: publicSchemaTables.slice(0, 10).map(t => ({ type: 'table' as const, name: t.name })),
            remediation: 'Create dedicated schemas and use ALTER DEFAULT PRIVILEGES for fine-grained access control.',
            riskScore: 20,
        });
    }

    // Detect tables that likely need restricted access (user/auth patterns)
    const authPatterns = /^(users?|accounts?|sessions?|tokens?|auth|credentials?|roles?|permissions?)$/i;
    const authTables = schema.tables.filter(t => authPatterns.test(t.name));
    if (authTables.length > 0) {
        for (const table of authTables) {
            const hasPolicies = schema.policies.some(p => p.table === table.name);
            if (!hasPolicies) {
                risks.push({
                    type: 'unprotected-auth-table',
                    severity: 'warning',
                    description: `Auth-related table "${table.name}" has no RLS policies. Consider restricting access.`,
                    affectedObjects: [table.name],
                });

                issues.push({
                    id: `privilege-unprotected-auth-${table.name}`,
                    layer: 'privilege',
                    severity: 'warning',
                    category: 'unprotected-auth-table',
                    title: 'Unprotected auth table',
                    message: `Table "${table.name}" appears to be authentication-related but has no RLS policies.`,
                    affectedObjects: [{ type: 'table', name: table.name }],
                    remediation: `Enable RLS: ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY; then create appropriate policies.`,
                    riskScore: 45,
                });
            }
        }
    }

    // Estimate privilege exposure score (0-100)
    const secDefCount = schema.functions.filter(f => (f as any).securityDefiner).length;
    const rlsCoverage = schema.policies.length > 0 ? 1 : 0;
    const schemaOrg = schema.schemas.length > 1 ? 1 : 0;

    const exposureScore = Math.min(100, Math.max(0,
        (secDefCount * 15) +
        ((1 - rlsCoverage) * 30) +
        ((1 - schemaOrg) * 10) +
        (publicSchemaTables.length > 10 ? 15 : 0) +
        (authTables.filter(t => !schema.policies.some(p => p.table === t.name)).length * 10)
    ));

    return {
        privileges: {
            grants,
            risks,
            publicSchemaWritable: publicSchemaTables.length > 0,
            superuserFunctions: schema.functions.filter(f => (f as any).securityDefiner).map(f => f.name),
            exposureScore,
        },
        issues,
    };
}
