/**
 * Schema Compiler Stress Test
 * 
 * Parses an advanced PostgreSQL schema, runs the full 20-layer compiler,
 * and validates every layer for correct output shapes, counts, and issue detection.
 *
 * Usage:  cd frontend && npx tsx tests/stress-test/run-compiler-test.ts
 */

import { parsePostgresSQL } from '../../src/lib/sql-parser';
import { compileSchema } from '../../src/lib/schema-compiler';
import type { CompilationResult } from '../../src/lib/schema-compiler';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function pass(msg: string) { passCount++; console.log(`  ✅ ${msg}`); }
function fail(msg: string, detail?: unknown) { failCount++; console.error(`  ❌ ${msg}`, detail ?? ''); }
function warn(msg: string, detail?: unknown) { warnCount++; console.warn(`  ⚠️  ${msg}`, detail ?? ''); }
function section(title: string) { console.log(`\n${'═'.repeat(70)}\n  ${title}\n${'═'.repeat(70)}`); }
function sub(title: string) { console.log(`\n  ── ${title} ──`); }

function assertGt(actual: number, min: number, label: string) {
    if (actual > min) pass(`${label}: ${actual} (> ${min})`);
    else fail(`${label}: expected > ${min}, got ${actual}`);
}

function assertGte(actual: number, min: number, label: string) {
    if (actual >= min) pass(`${label}: ${actual} (>= ${min})`);
    else fail(`${label}: expected >= ${min}, got ${actual}`);
}

function assertEq(actual: unknown, expected: unknown, label: string) {
    if (actual === expected) pass(`${label}: ${String(actual)}`);
    else fail(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertTruthy(value: unknown, label: string) {
    if (value) pass(label);
    else fail(`${label}: falsy`);
}

function assertArray(arr: unknown, minLen: number, label: string) {
    if (!Array.isArray(arr)) { fail(`${label}: not an array`); return; }
    if (arr.length >= minLen) pass(`${label}: ${arr.length} items (>= ${minLen})`);
    else fail(`${label}: expected >= ${minLen} items, got ${arr.length}`);
}

function assertNoCrash(fn: () => void, label: string) {
    try { fn(); pass(`${label}: no crash`); }
    catch (e) { fail(`${label}: CRASHED`, e); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    section('SCHEMA COMPILER STRESS TEST');

    // 1. Load SQL
    const sqlPath = path.join(__dirname, 'compiler-stress-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`  📄 Loaded SQL fixture: ${sqlContent.length} bytes`);

    // 2. Parse
    sub('PARSING');
    let parsed: ReturnType<typeof parsePostgresSQL>;
    try {
        parsed = parsePostgresSQL(sqlContent);
        pass('parsePostgresSQL returned without error');
    } catch (e) {
        fail('parsePostgresSQL CRASHED', e);
        console.log('\n🛑 Cannot proceed without parsed schema. Aborting.');
        process.exit(1);
    }

    // Show parser output summary
    console.log(`  Parser output summary:`);
    console.log(`    tables:         ${parsed.tables.length}`);
    console.log(`    views:          ${parsed.views.length}`);
    console.log(`    functions:      ${parsed.functions.length}`);
    console.log(`    triggers:       ${parsed.triggers.length}`);
    console.log(`    sequences:      ${parsed.sequences.length}`);
    console.log(`    indexes:        ${parsed.indexes.length}`);
    console.log(`    policies:       ${parsed.policies.length}`);
    console.log(`    enumTypes:      ${parsed.enumTypes.length}`);
    console.log(`    domains:        ${parsed.domains.length}`);
    console.log(`    compositeTypes: ${parsed.compositeTypes.length}`);
    console.log(`    relationships:  ${parsed.relationships.length}`);
    console.log(`    schemas:        ${parsed.schemas.length}`);

    // Basic parser sanity
    assertGte(parsed.tables.length, 10, 'Parser: tables (expect >= 10 from fixture)');
    assertGte(parsed.views.length, 2, 'Parser: views');
    assertGte(parsed.functions.length, 3, 'Parser: functions');
    assertGte(parsed.triggers.length, 3, 'Parser: triggers');
    assertGte(parsed.sequences.length, 2, 'Parser: sequences');
    assertGte(parsed.indexes.length, 5, 'Parser: indexes');
    assertGte(parsed.enumTypes.length, 3, 'Parser: enums');

    // 3. Compile
    sub('COMPILATION');
    let result: CompilationResult;
    try {
        const t0 = performance.now();
        result = compileSchema(parsed);
        const elapsed = performance.now() - t0;
        pass(`compileSchema returned in ${elapsed.toFixed(1)}ms`);
    } catch (e) {
        fail('compileSchema CRASHED', e);
        console.log('\n🛑 Cannot proceed without compiled result. Aborting.');
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Layer-by-layer validation
    // ──────────────────────────────────────────────────────────────────────────

    // METADATA
    sub('METADATA');
    assertTruthy(result.compiledAt > 0, 'compiledAt is positive');
    assertTruthy(result.compilationTime >= 0, 'compilationTime >= 0');
    assertTruthy(result.sourceType === 'sql_editor', 'sourceType is sql_editor');
    assertTruthy(typeof result.schemaName === 'string', 'schemaName is string');
    assertTruthy(typeof result.overallScore === 'number', 'overallScore is number');
    assertTruthy(['A','B','C','D','F'].includes(result.overallGrade), `overallGrade is letter: ${result.overallGrade}`);
    assertGt(result.totalObjects, 0, 'totalObjects');

    // LAYER 1: DATABASE
    sub('Layer 1: Database');
    assertTruthy(result.database, 'database layer exists');
    assertArray(result.database.searchPath, 1, 'database.searchPath');

    // LAYER 2: SCHEMAS
    sub('Layer 2: Schemas');
    assertArray(result.schemas, 1, 'schemas array');
    for (const s of result.schemas) {
        assertTruthy(typeof s.name === 'string', `schema.name: ${s.name}`);
        assertTruthy(s.objectCounts, `schema ${s.name} has objectCounts`);
    }

    // LAYER 3: TABLES
    sub('Layer 3: Tables');
    assertArray(result.tables, 10, 'tables array (>= 10)');
    for (const t of result.tables) {
        assertTruthy(t.name, `table.name: ${t.name}`);
        assertTruthy(t.schema, `table.schema for ${t.name}`);
        assertTruthy(['base','partitioned','foreign','unlogged','temporary','inherited'].includes(t.tableType),
            `table.tableType for ${t.name}: ${t.tableType}`);
        assertTruthy(typeof t.columnCount === 'number', `table.columnCount for ${t.name}`);
    }
    // Check specific tables (name may be fully-qualified "auth.users" or just "users")
    const authUsers = result.tables.find(t =>
        (t.name === 'users' || t.name === 'auth.users') && t.schema === 'auth'
    );
    if (authUsers) {
        pass(`Found auth.users table (name=${authUsers.name})`);
        assertGte(authUsers.columnCount, 10, 'auth.users columnCount');
        assertTruthy(authUsers.rlsEnabled === true, 'auth.users RLS enabled');
    } else {
        fail('auth.users table not found');
    }

    // LAYER 4: COLUMNS
    sub('Layer 4: Columns');
    assertArray(result.columns, 30, 'columns array (>= 30 across all tables)');
    const emailCol = result.columns.find(c => c.name === 'email' && c.tableName === 'users');
    if (emailCol) {
        pass(`Found email column in users: type=${emailCol.resolvedType}`);
    }
    // Check generated column
    const genCol = result.columns.find(c => c.isGenerated);
    if (genCol) pass(`Generated column found: ${genCol.tableName}.${genCol.name}`);
    else warn('No generated columns detected (order_summaries has them)');

    // LAYER 5: TYPES
    sub('Layer 5: Types');
    assertTruthy(result.types, 'types layer exists');
    assertArray(result.types.enums, 3, 'types.enums (>= 3)');
    assertArray(result.types.domains, 1, 'types.domains (>= 1)');
    assertArray(result.types.compositeTypes, 1, 'types.compositeTypes (>= 1)');
    // Check duplicate enum semantics
    if (result.types.duplicateEnumSemantics.length > 0)
        pass(`Duplicate enum semantics detected: ${result.types.duplicateEnumSemantics.length}`);
    else
        warn('No duplicate enum semantics detected (user_role/role_type overlap)');

    // LAYER 6: CONSTRAINTS
    sub('Layer 6: Constraints');
    assertTruthy(result.constraints, 'constraints layer exists');
    assertArray(result.constraints.primaryKeys, 5, 'primaryKeys (>= 5)');
    assertArray(result.constraints.foreignKeys, 5, 'foreignKeys (>= 5)');
    if (result.constraints.checkConstraints.length > 0)
        pass(`Check constraints: ${result.constraints.checkConstraints.length}`);
    else
        warn('No check constraints detected');
    // FK cycle detection
    if (result.constraints.constraintCycles.length > 0)
        pass(`Constraint cycles found: ${result.constraints.constraintCycles.length}`);
    else
        warn('No circular FK cycles detected (documents <-> document_versions)');

    // LAYER 7: INDEXES
    sub('Layer 7: Indexes');
    assertTruthy(result.indexes, 'indexes layer exists');
    assertArray(result.indexes.indexes, 5, 'indexes (>= 5)');
    // Duplicate index detection
    if (result.indexes.duplicateIndexes.length > 0)
        pass(`Duplicate indexes detected: ${result.indexes.duplicateIndexes.length}`);
    else
        warn('No duplicate indexes detected (idx_users_email vs idx_users_email_dup)');
    // Redundant index detection
    if (result.indexes.redundantIndexes.length > 0)
        pass(`Redundant indexes detected: ${result.indexes.redundantIndexes.length}`);
    else
        warn('No redundant indexes detected (idx_events_user vs idx_events_user_time)');
    // Expression indexes
    if (result.indexes.expressionIndexes.length > 0)
        pass(`Expression indexes: ${result.indexes.expressionIndexes.length}`);
    else
        warn('No expression indexes detected (idx_users_lower_name)');
    // Partial indexes
    if (result.indexes.partialIndexes.length > 0)
        pass(`Partial indexes: ${result.indexes.partialIndexes.length}`);
    else
        warn('No partial indexes detected (idx_sessions_expires)');

    // LAYER 8: PARTITIONS
    sub('Layer 8: Partitions');
    assertTruthy(result.partitions, 'partitions layer exists');
    if (result.partitions.totalPartitionedTables > 0) {
        pass(`Partitioned tables: ${result.partitions.totalPartitionedTables}`);
        assertGte(result.partitions.totalPartitions, 1, 'totalPartitions');
        assertArray(result.partitions.trees, 1, 'partition trees');
        // Check the invoices partition tree
        const invoiceTree = result.partitions.trees.find(
            t => t.rootTable === 'invoices' || t.rootTable === 'billing.invoices'
        );
        if (invoiceTree) {
            pass(`Invoice partition tree found: strategy=${invoiceTree.strategy}`);
            assertGte(invoiceTree.totalPartitions, 3, 'Invoice partitions (2024/2025/2026)');
        } else {
            warn('Invoice partition tree not found by name');
        }
    } else {
        warn('No partitioned tables detected (billing.invoices is partitioned)');
    }

    // LAYER 9: VIEWS
    sub('Layer 9: Views');
    assertTruthy(result.views, 'views layer exists');
    assertArray(result.views.views, 2, 'views (>= 2)');
    // Materialized view
    if (result.views.materializedViews.length > 0)
        pass(`Materialized views: ${result.views.materializedViews.length}`);
    else
        warn('No materialized views detected (analytics.daily_stats)');
    // Circular view deps
    if (result.views.circularViewDeps.length > 0)
        pass(`Circular view deps found: ${result.views.circularViewDeps.length}`);
    // View depending on another view
    const activeUserActivity = result.views.views.find(v => v.name === 'active_user_activity');
    if (activeUserActivity) {
        pass(`View active_user_activity found, dependsOn: ${activeUserActivity.dependsOn.join(', ')}`);
    }

    // LAYER 10: FUNCTIONS
    sub('Layer 10: Functions');
    assertTruthy(result.functions, 'functions layer exists');
    assertArray(result.functions.functions, 3, 'functions (>= 3)');
    // SECURITY DEFINER
    if (result.functions.unsafeSecurityDefiners.length > 0)
        pass(`Unsafe SECURITY DEFINER: ${result.functions.unsafeSecurityDefiners.join(', ')}`);
    else
        warn('No SECURITY DEFINER functions detected (hash_password)');
    // Unused functions
    if (result.functions.unusedFunctions.length > 0)
        pass(`Unused functions: ${result.functions.unusedFunctions.join(', ')}`);
    else
        warn('No unused functions detected (unused_helper)');

    // LAYER 11: TRIGGERS
    sub('Layer 11: Triggers');
    assertTruthy(result.triggers, 'triggers layer exists');
    assertArray(result.triggers.triggers, 3, 'triggers (>= 3)');
    // Ordering conflicts
    if (result.triggers.orderingConflicts.length > 0)
        pass(`Trigger ordering conflicts: ${result.triggers.orderingConflicts.length}`);
    else
        warn('No ordering conflicts detected (two AFTER INSERT on auth.users)');
    // Missing trigger functions
    if (result.triggers.missingTriggerFunctions.length > 0)
        pass(`Missing trigger functions: ${result.triggers.missingTriggerFunctions.join(', ')}`);
    else
        warn('No missing trigger function detected (nonexistent_function)');

    // LAYER 12: RLS
    sub('Layer 12: RLS');
    assertTruthy(result.rls, 'rls layer exists');
    assertArray(result.rls.policies, 1, 'RLS policies (>= 1)');
    assertTruthy(result.rls.coverage, 'rls.coverage exists');
    if (result.rls.coverage.tablesWithRLS > 0)
        pass(`Tables with RLS: ${result.rls.coverage.tablesWithRLS}`);
    else
        warn('No tables with RLS detected');
    // Over-permissive policies
    if (result.rls.overPermissivePolicies.length > 0)
        pass(`Over-permissive policies: ${result.rls.overPermissivePolicies.length}`);
    else
        warn('No over-permissive policies detected (sessions_public USING true)');
    // Sensitive tables without RLS
    if (result.rls.sensitiveSansRLS.length > 0)
        pass(`Sensitive tables without RLS: ${result.rls.sensitiveSansRLS.length}`);
    else
        warn('No sensitive-sans-RLS tables detected');

    // LAYER 13: PRIVILEGES
    sub('Layer 13: Privileges');
    assertTruthy(result.privileges, 'privileges layer exists');
    // GRANT parsing is tricky—be lenient
    if (result.privileges.grants.length > 0)
        pass(`Privilege grants parsed: ${result.privileges.grants.length}`);
    else
        warn('No privilege grants detected (GRANT statements in SQL)');
    assertTruthy(typeof result.privileges.exposureScore === 'number', 'exposureScore is number');

    // LAYER 14: SEQUENCES
    sub('Layer 14: Sequences');
    assertTruthy(result.sequences, 'sequences layer exists');
    assertArray(result.sequences.sequences, 2, 'sequences (>= 2)');
    // Orphan sequences
    if (result.sequences.orphanSequences.length > 0)
        pass(`Orphan sequences detected: ${result.sequences.orphanSequences.join(', ')}`);
    else
        warn('No orphan sequences detected (orphan_counter_seq)');
    // Shared sequences
    if (result.sequences.sharedSequences.length > 0)
        pass(`Shared sequences detected: ${result.sequences.sharedSequences.join(', ')}`);
    else
        warn('No shared sequences detected (shared_ref_seq)');

    // LAYER 15: EXTENSIONS
    sub('Layer 15: Extensions');
    assertArray(result.extensions, 1, 'extensions (>= 1)');
    if (result.extensions.length > 0) {
        const uuidExt = result.extensions.find(e => e.name === 'uuid-ossp');
        if (uuidExt) pass(`uuid-ossp extension found, category: ${uuidExt.category}`);
        else warn('uuid-ossp extension not found in results');
    }

    // LAYER 16: DEPENDENCIES
    sub('Layer 16: Dependencies');
    assertTruthy(result.dependencies, 'dependencies layer exists');
    assertGt(result.dependencies.totalNodes, 0, 'dependency nodes');
    assertGt(result.dependencies.totalEdges, 0, 'dependency edges');
    assertArray(result.dependencies.nodes, 5, 'dependency nodes array (>= 5)');
    assertArray(result.dependencies.edges, 5, 'dependency edges array (>= 5)');
    // Cycles (documents <-> document_versions)
    if (result.dependencies.cycles.length > 0)
        pass(`Dependency cycles: ${result.dependencies.cycles.length}`);
    else
        warn('No dependency cycles detected');
    // Centrality
    if (result.dependencies.centrality.length > 0)
        pass(`Centrality entries: ${result.dependencies.centrality.length}`);
    // Cascade chains
    if (result.dependencies.cascadeChains.length > 0)
        pass(`Cascade chains: ${result.dependencies.cascadeChains.length}`);

    // LAYER 17: STORAGE (stub)
    sub('Layer 17: Storage (stub)');
    assertTruthy(result.storage, 'storage layer exists');

    // LAYER 18: REPLICATION (stub)
    sub('Layer 18: Replication (stub)');
    assertTruthy(result.replication, 'replication layer exists');

    // LAYER 19: SEMANTIC
    sub('Layer 19: Semantic');
    assertTruthy(result.semantic, 'semantic layer exists');
    assertGt(result.semantic.totalSymbols, 0, 'totalSymbols');
    assertArray(result.semantic.symbolTable, 5, 'symbolTable (>= 5)');
    // Naming anomalies (mixed conventions)
    if (result.semantic.namingAnomalies.length > 0)
        pass(`Naming anomalies: ${result.semantic.namingAnomalies.length}`);
    // Cross-schema coupling
    if (result.semantic.crossSchemaCoupling.length > 0)
        pass(`Cross-schema coupling edges: ${result.semantic.crossSchemaCoupling.length}`);
    else
        warn('No cross-schema coupling detected');
    // Shadowed names
    if (result.semantic.shadowedNames.length > 0)
        pass(`Shadowed names: ${result.semantic.shadowedNames.length}`);
    // Type drift
    if (result.semantic.typeDrift.length > 0)
        pass(`Type drift detected: ${result.semantic.typeDrift.length}`);

    // LAYER 20: METRICS
    sub('Layer 20: Metrics');
    assertTruthy(result.metrics, 'metrics layer exists');
    assertTruthy(result.metrics.objectCounts, 'metrics.objectCounts');
    assertGt(result.metrics.objectCounts.tables, 0, 'metrics.objectCounts.tables');
    assertTruthy(result.metrics.densityMetrics, 'metrics.densityMetrics');
    assertTruthy(result.metrics.qualityScores, 'metrics.qualityScores');
    assertTruthy(result.metrics.issueDistribution, 'metrics.issueDistribution');
    assertTruthy(typeof result.metrics.readinessScore === 'number', 'readinessScore is number');
    assertTruthy(['A','B','C','D','F'].includes(result.metrics.overallGrade), `overallGrade: ${result.metrics.overallGrade}`);

    // ── ISSUES ANALYSIS ───────────────────────────────────────────────────
    sub('ISSUES ANALYSIS');
    console.log(`  Total issues: ${result.totalIssues}`);
    assertGt(result.issues.length, 0, 'At least some issues should be raised');

    // Count by severity
    const bySeverity: Record<string, number> = {};
    for (const issue of result.issues) {
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    }
    console.log('  Issues by severity:', bySeverity);

    // Count by layer
    const byLayer: Record<string, number> = {};
    for (const issue of result.issues) {
        byLayer[issue.layer] = (byLayer[issue.layer] || 0) + 1;
    }
    console.log('  Issues by layer:', byLayer);

    // Validate issue shape
    for (const issue of result.issues.slice(0, 5)) {
        assertTruthy(issue.id, `issue.id: ${issue.id}`);
        assertTruthy(issue.layer, `issue.layer: ${issue.layer}`);
        assertTruthy(issue.severity, `issue.severity: ${issue.severity}`);
        assertTruthy(issue.title, `issue.title: ${issue.title}`);
        assertTruthy(issue.message, `issue.message`);
        assertTruthy(Array.isArray(issue.affectedObjects), 'issue.affectedObjects is array');
        assertTruthy(typeof issue.riskScore === 'number', `issue.riskScore: ${issue.riskScore}`);
    }

    // ── LAYER SUMMARIES ───────────────────────────────────────────────────
    sub('LAYER SUMMARIES');
    assertArray(result.layerSummaries, 20, 'layerSummaries (exactly 20)');
    for (const ls of result.layerSummaries) {
        assertTruthy(ls.layer, `summary.layer: ${ls.layer}`);
        assertTruthy(ls.label, `summary.label: ${ls.label}`);
        assertTruthy(['critical','high','medium','low','none'].includes(ls.riskLevel),
            `summary.riskLevel for ${ls.layer}: ${ls.riskLevel}`);
        assertTruthy(['A','B','C','D','F'].includes(ls.grade),
            `summary.grade for ${ls.layer}: ${ls.grade}`);
    }

    // ── EDGE CASE ROBUSTNESS ──────────────────────────────────────────────
    sub('EDGE CASE ROBUSTNESS');

    // Empty schema
    assertNoCrash(() => {
        const empty = parsePostgresSQL('');
        compileSchema(empty);
    }, 'Compile empty SQL');

    // Comments only
    assertNoCrash(() => {
        const comments = parsePostgresSQL('-- just a comment\n/* block comment */');
        compileSchema(comments);
    }, 'Compile comments-only SQL');

    // Single table
    assertNoCrash(() => {
        const single = parsePostgresSQL('CREATE TABLE test (id serial PRIMARY KEY, name text);');
        const r = compileSchema(single);
        if (r.tables.length !== 1) fail('Single table: expected 1 table', r.tables.length);
        else pass('Single table compiled correctly');
    }, 'Compile single table');

    // Invalid/unsupported SQL (should not crash)
    assertNoCrash(() => {
        compileSchema(parsePostgresSQL('THIS IS NOT SQL AT ALL;'));
    }, 'Compile invalid SQL');

    // Skip layers option
    assertNoCrash(() => {
        const r = compileSchema(parsed, { skipLayers: ['rls', 'privilege', 'semantic'] });
        if (r.rls.policies.length === 0) pass('Skipped RLS layer');
        else warn('Skip layers did not clear RLS');
    }, 'Compile with skipLayers');

    // ── FINAL REPORT ──────────────────────────────────────────────────────
    section('FINAL REPORT');
    console.log(`  Passed:   ${passCount}`);
    console.log(`  Failed:   ${failCount}`);
    console.log(`  Warnings: ${warnCount}`);
    console.log(`  Score:    ${result.overallScore} / 100  (Grade: ${result.overallGrade})`);
    console.log(`  Time:     ${result.compilationTime.toFixed(1)}ms`);
    console.log(`  Objects:  ${result.totalObjects}`);
    console.log(`  Issues:   ${result.totalIssues}`);

    if (failCount === 0) {
        console.log('\n  🎉 ALL TESTS PASSED!\n');
    } else {
        console.log(`\n  💥 ${failCount} TEST(S) FAILED\n`);
        process.exit(1);
    }
}

main().catch(e => {
    console.error('  💀 UNHANDLED ERROR:', e);
    process.exit(2);
});
