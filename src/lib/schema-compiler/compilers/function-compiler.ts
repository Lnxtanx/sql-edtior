/**
 * Function Compiler
 * 
 * Layer 10: Compiles functions/procedures with security analysis,
 * dependency tree, volatile-in-index detection, unused function detection.
 */

import type { ParsedSchema, PostgresFunction } from '@/lib/sql-parser';
import type {
    FunctionCompilation, CompilationIssue, FunctionEntry,
    VolatileInIndex, FunctionDependency,
} from '../types';

export function compileFunctions(schema: ParsedSchema): { functions: FunctionCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build trigger-function map
    // Map both bare names and schema-qualified names for matching
    const triggerFunctions = new Map<string, string[]>();
    for (const trigger of schema.triggers) {
        if (trigger.functionName) {
            const funcName = trigger.functionName.toLowerCase();
            // Add bare name
            if (!triggerFunctions.has(funcName)) triggerFunctions.set(funcName, []);
            triggerFunctions.get(funcName)!.push(trigger.name);
            // Add schema-qualified name if schema is available
            if (trigger.functionSchema) {
                const qualifiedName = `${trigger.functionSchema}.${funcName}`.toLowerCase();
                if (!triggerFunctions.has(qualifiedName)) triggerFunctions.set(qualifiedName, []);
                triggerFunctions.get(qualifiedName)!.push(trigger.name);
            }
        }
    }

    // Build view-function references (basic heuristic: function name appears in view query)
    const viewFunctionRefs = new Map<string, string[]>();
    for (const view of schema.views) {
        if (view.query) {
            const queryLower = view.query.toLowerCase();
            for (const fn of schema.functions) {
                // Try both full name and bare name to match in view query
                const fullName = fn.name.toLowerCase();
                const bareName = fn.name.includes('.') ? fn.name.split('.').pop()!.toLowerCase() : fullName;
                if (queryLower.includes(bareName + '(') || queryLower.includes(fullName + '(')) {
                    if (!viewFunctionRefs.has(fullName)) {
                        viewFunctionRefs.set(fullName, []);
                    }
                    viewFunctionRefs.get(fullName)!.push(view.name);
                }
            }
        }
    }

    // Table reference detection in function bodies
    const tableNames = new Set(schema.tables.map(t => t.name.toLowerCase()));

    const functions: FunctionEntry[] = [];
    const procedures: FunctionEntry[] = [];
    const unsafeSecurityDefiners: string[] = [];
    const unusedFunctions: string[] = [];
    const recursiveFunctions: string[] = [];
    const functionDependencyTree: FunctionDependency[] = [];

    for (const fn of schema.functions) {
        const fnNameLower = fn.name.toLowerCase();
        const fnBareName = fn.name.includes('.') ? fn.name.split('.').pop()!.toLowerCase() : fnNameLower;
        // Match triggers by both full and bare name
        const calledByTriggers = triggerFunctions.get(fnNameLower) || triggerFunctions.get(fnBareName) || [];
        const calledByViews = viewFunctionRefs.get(fnNameLower) || [];
        const referencedTables = detectReferencedTables(fn, tableNames);
        const bodySize = fn.body?.length || 0;
        const complexity = estimateFunctionComplexity(fn);

        // Detect SECURITY DEFINER from function body or parser property
        const isSecurityDefiner = Boolean(
            (fn as any).securityDefiner ||
            (fn.body && /security\s+definer/i.test(fn.body))
        );

        const entry: FunctionEntry = {
            name: fn.name,
            schema: fn.schema,
            language: fn.language,
            returnType: fn.returnType,
            isProcedure: fn.isProcedure,
            parameters: (fn.parameters || []).map(p => ({
                name: p.name,
                type: p.type,
                mode: p.mode,
                default: p.default,
            })),
            volatility: fn.volatility || 'VOLATILE',
            securityDefiner: isSecurityDefiner,
            leakproof: false,
            parallelSafety: 'UNSAFE',
            cost: 100,
            isStrict: false,
            bodySize,
            complexity,
            referencedTables,
            calledByTriggers,
            calledByViews,
        };

        // Track unsafe security definers
        if (isSecurityDefiner) {
            unsafeSecurityDefiners.push(fn.name);
        }

        if (fn.isProcedure) {
            procedures.push(entry);
        } else {
            functions.push(entry);
        }

        // Build dependency tree edges
        for (const triggerName of calledByTriggers) {
            functionDependencyTree.push({
                caller: triggerName,
                callee: fn.name,
                dependencyType: 'trigger',
            });
        }

        for (const viewName of calledByViews) {
            functionDependencyTree.push({
                caller: viewName,
                callee: fn.name,
                dependencyType: 'view',
            });
        }

        // Detect cross-function calls
        if (fn.body) {
            for (const otherFn of schema.functions) {
                if (otherFn.name !== fn.name && fn.body.toLowerCase().includes(otherFn.name.toLowerCase() + '(')) {
                    functionDependencyTree.push({
                        caller: fn.name,
                        callee: otherFn.name,
                        dependencyType: 'direct_call',
                    });

                    // Self-referential check
                    if (otherFn.name === fn.name) {
                        recursiveFunctions.push(fn.name);
                    }
                }
            }

            // Direct self-reference
            if (fn.body.toLowerCase().includes(fn.name.toLowerCase() + '(')) {
                if (!recursiveFunctions.includes(fn.name)) {
                    recursiveFunctions.push(fn.name);
                }
            }
        }

        // Unused function detection (not called by triggers, views, or other functions)
        const fnFullLower = fn.name.toLowerCase();
        const fnBare = fn.name.includes('.') ? fn.name.split('.').pop()!.toLowerCase() : fnFullLower;
        const isCalledByAnything = calledByTriggers.length > 0 ||
            calledByViews.length > 0 ||
            functionDependencyTree.some(dep =>
                (dep.callee.toLowerCase() === fnFullLower || dep.callee.toLowerCase() === fnBare) &&
                dep.caller.toLowerCase() !== fnFullLower
            );

        if (!isCalledByAnything) {
            unusedFunctions.push(fn.name);
        }
    }

    // Volatile-in-index detection
    const volatileInIndex: VolatileInIndex[] = [];
    for (const idx of schema.indexes) {
        for (const col of idx.columns) {
            // Check if index column references a function call
            for (const fn of schema.functions) {
                if (col.toLowerCase().includes(fn.name.toLowerCase() + '(')) {
                    if (fn.volatility === 'VOLATILE') {
                        volatileInIndex.push({
                            function: fn.name,
                            index: idx.name,
                            table: idx.table,
                            risk: `Volatile function "${fn.name}" used in index "${idx.name}". Index may produce inconsistent results.`,
                        });
                    }
                }
            }
        }
    }

    // Issue generation
    for (const name of unsafeSecurityDefiners) {
        issues.push({
            id: `func-unsafe-definer-${name}`,
            layer: 'function',
            severity: 'warning',
            category: 'unsafe-security-definer',
            title: 'Unsafe SECURITY DEFINER',
            message: `Function "${name}" uses SECURITY DEFINER which runs with the owner's privileges. This can be a security risk.`,
            affectedObjects: [{ type: 'function', name }],
            remediation: 'Ensure the function validates all inputs and uses search_path explicitly.',
            riskScore: 60,
        });
    }

    for (const vii of volatileInIndex) {
        issues.push({
            id: `func-volatile-index-${vii.function}-${vii.index}`,
            layer: 'function',
            severity: 'error',
            category: 'volatile-in-index',
            title: 'Volatile function in index',
            message: vii.risk,
            affectedObjects: [
                { type: 'function', name: vii.function },
                { type: 'index', name: vii.index },
            ],
            riskScore: 75,
        });
    }

    for (const name of unusedFunctions) {
        issues.push({
            id: `func-unused-${name}`,
            layer: 'function',
            severity: 'info',
            category: 'unused-function',
            title: 'Potentially unused function',
            message: `Function "${name}" is not referenced by any trigger, view, or other function in this schema.`,
            affectedObjects: [{ type: 'function', name }],
            remediation: 'If unused, consider removing to reduce maintenance burden. It may be called from application code.',
            riskScore: 5,
        });
    }

    for (const name of recursiveFunctions) {
        issues.push({
            id: `func-recursive-${name}`,
            layer: 'function',
            severity: 'info',
            category: 'recursive-function',
            title: 'Recursive function',
            message: `Function "${name}" contains self-referential calls. Ensure proper termination conditions exist.`,
            affectedObjects: [{ type: 'function', name }],
            riskScore: 15,
        });
    }

    return {
        functions: {
            functions,
            procedures,
            unsafeSecurityDefiners,
            volatileInIndex,
            unusedFunctions,
            recursiveFunctions,
            functionDependencyTree,
        },
        issues,
    };
}

function detectReferencedTables(fn: PostgresFunction, tableNames: Set<string>): string[] {
    if (!fn.body) return [];
    const refs: string[] = [];
    const bodyLower = fn.body.toLowerCase();

    for (const tableName of tableNames) {
        // Look for table references in FROM, JOIN, INSERT INTO, UPDATE, DELETE FROM patterns
        const patterns = [
            new RegExp(`\\bfrom\\s+${tableName}\\b`, 'i'),
            new RegExp(`\\bjoin\\s+${tableName}\\b`, 'i'),
            new RegExp(`\\binsert\\s+into\\s+${tableName}\\b`, 'i'),
            new RegExp(`\\bupdate\\s+${tableName}\\b`, 'i'),
            new RegExp(`\\bdelete\\s+from\\s+${tableName}\\b`, 'i'),
        ];

        if (patterns.some(p => p.test(fn.body!))) {
            refs.push(tableName);
        }
    }

    return refs;
}

function estimateFunctionComplexity(fn: PostgresFunction): FunctionEntry['complexity'] {
    if (!fn.body) return 'simple';

    const body = fn.body.toLowerCase();
    let score = 0;

    // Parameter count
    score += (fn.parameters?.length || 0) > 5 ? 2 : (fn.parameters?.length || 0) > 2 ? 1 : 0;

    // Body complexity indicators
    if (body.includes('loop')) score += 2;
    if (body.includes('for ')) score += 1;
    if (body.includes('while ')) score += 2;
    if (body.includes('exception')) score += 1;
    if (body.includes('cursor')) score += 2;
    if (body.includes('dynamic')) score += 2;
    if ((body.match(/if\s/g) || []).length > 3) score += 1;
    if (body.length > 2000) score += 2;
    else if (body.length > 500) score += 1;

    if (score >= 5) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
}
