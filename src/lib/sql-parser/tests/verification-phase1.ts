
import { parsePostgresSQL } from '../index';
import { VerificationLevel } from '../types/core-types';

const sql = `
-- Table 1: Exact match collision test
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    name TEXT
);

CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT
);

-- Table 2: Regex test (using unlogged which AST handles, but let's see if we can trigger regex or AST)
-- Actually AST handles UNLOGGED.
-- Let's use a View which favors Regex first
CREATE VIEW public.user_summary AS SELECT count(*) FROM public.users;
`;

console.log('Running Phase 1 Verification...');

const result = parsePostgresSQL(sql);

// 1. Check Table Identity
const t1 = result.tables.find(t => t.name === 'public.users');
const t2 = result.tables.find(t => t.name === 'auth.users');

if (t1 && t2) {
    console.log('✅ Schema-safe identity working: Found both public.users and auth.users');
} else {
    console.error('❌ Schema-safe identity FAILED: Missing one or both tables', { t1: !!t1, t2: !!t2 });
}

// 2. Check Verification Levels
// Tables use AST (Strategy A) -> DEFINITIVE
// Views use Regex (Strategy C - Regex First) -> HEURISTIC

// We need to inspect the symbol table, but ParseResult doesn't expose it directly.
// However, we can check the 'verification' property if we added it to public types?
// Wait, 'verification' is on Symbol, not Table interface yet?
// helping core-types.ts: Symbol interface has it. Table interface does not?
// Let's check core-types.ts again.

// In Step 37, I added 'verification' to Symbol. I did NOT add it to Table.
// But the test script can't access context symbols unless I expose them or check internal behavior.
// Actually, I can't easily check verification level from `ParsedSchema` output unless I added it there too.
// I did NOT add it to `ParsedSchema`.
// So validation of verification level is hard from outside without exposing it.

// Correct fix: Add verificationLevel to Table/View interface in core-types.ts or just rely on console logs for now?
// I should add it to the Table interface for UI consumption anyway! The plan said "UI Visualization support".

if (t1?.verificationLevel === 'DEFINITIVE') {
    console.log('✅ Table verification level correct: DEFINITIVE');
} else {
    console.error('❌ Table verification level FAILED', t1?.verificationLevel);
}

// Check View (found via regex fallback or AST? 'CREATE VIEW' is in regexFirstTypes, so likely regex)
// Wait, if regex succeeds, it sets HEURISTIC.
// But we need to find the view first.
const v1 = result.views.find(v => v.name === 'public.user_summary');
if (v1) {
    if (v1.verificationLevel === 'HEURISTIC' || v1.verificationLevel === 'DEFINITIVE') {
        console.log(`✅ View found with level: ${v1.verificationLevel}`);
    } else {
        console.error('❌ View verification level missing/invalid', v1.verificationLevel);
    }
} else {
    console.error('❌ View NOT found');
}
