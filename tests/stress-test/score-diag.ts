import { parsePostgresSQL } from '../../src/lib/sql-parser';
import { compileSchema } from '../../src/lib/schema-compiler';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = fs.readFileSync(path.join(__dirname, 'compiler-stress-schema.sql'), 'utf-8');
const p = parsePostgresSQL(sql);
const r = compileSchema(p);
const m = r.metrics;

console.log('\n=== QUALITY SCORES ===');
for (const [k, v] of Object.entries(m.qualityScores)) {
    console.log(`  ${k}: ${(v as any).value}/100 (${(v as any).status})`);
}

console.log('\n=== DENSITY METRICS ===');
for (const [k, v] of Object.entries(m.densityMetrics)) {
    console.log(`  ${k}: ${(v as any).value} ${(v as any).unit} (${(v as any).status})`);
}

console.log('\n=== ISSUE DISTRIBUTION ===');
console.log(`  errors: ${m.issueDistribution.bySeverity.error}`);
console.log(`  warnings: ${m.issueDistribution.bySeverity.warning}`);
console.log(`  info: ${m.issueDistribution.bySeverity.info}`);
console.log(`  total: ${m.issueDistribution.totalIssues}`);

// Count suggestions
const suggestions = r.issues.filter(i => i.severity === 'suggestion').length;
console.log(`  suggestions: ${suggestions}`);

console.log('\n=== READINESS SCORE ===');
console.log(`  Score: ${m.readinessScore}/100  Grade: ${m.overallGrade}`);

// Show errors list
console.log('\n=== ERRORS (severity=error) ===');
r.issues.filter(i => i.severity === 'error').forEach(i => console.log(`  [${i.layer}] ${i.title}: ${i.message.substring(0, 100)}`));

// Show warnings list
console.log('\n=== WARNINGS (severity=warning) ===');
r.issues.filter(i => i.severity === 'warning').forEach(i => console.log(`  [${i.layer}] ${i.title}: ${i.message.substring(0, 100)}`));

// Show functions info
console.log('\n=== FUNCTIONS ===');
console.log(`  functions: ${r.functions.functions.length}`);
console.log(`  securityDefiners: ${r.functions.unsafeSecurityDefiners}`);
console.log(`  unused: ${r.functions.unusedFunctions}`);
for (const f of r.functions.functions) {
    console.log(`  ${f.name}: body=${!!f.body}, volatility=${f.volatility}, secDefiner=${f.securityDefiner}, calledByTriggers=${f.calledByTriggers.length}`);
}
