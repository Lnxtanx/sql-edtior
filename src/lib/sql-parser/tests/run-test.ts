/**
 * Quick Test Runner for Complex Schema
 * Run with: npx tsx src/lib/sql-parser/tests/run-test.ts
 */

import { runComplexSchemaTest } from './complex-schema.test';

console.log('Starting Complex Schema Test...\n');
const { results, schema } = runComplexSchemaTest();

// Exit with error code if any tests failed
const failedCount = results.filter(r => !r.passed).length;
process.exit(failedCount > 0 ? 1 : 0);
