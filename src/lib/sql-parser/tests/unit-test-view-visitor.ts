
import { parse } from 'pgsql-ast-parser';
import { extractViewDependencies } from '../core/ast-visitor';

console.log('Testing extractViewDependencies directly...');

const sqlCases = [
    {
        name: 'Simple Select',
        sql: 'SELECT * FROM public.users',
        expected: ['public.users']
    },
    {
        name: 'Join',
        sql: 'SELECT * FROM users u JOIN profiles p ON u.id = p.user_id',
        expected: ['users', 'profiles']
    },
    {
        name: 'Subquery',
        sql: 'SELECT * FROM (SELECT * FROM public.logs) sub',
        expected: ['public.logs']
    },
    {
        name: 'CTE',
        sql: 'WITH cte AS (SELECT * FROM raw_data) SELECT * FROM cte',
        expected: ['raw_data']
    }
];

for (const test of sqlCases) {
    try {
        console.log(`\nCase: ${test.name}`);
        const ast = parse(test.sql);
        // parse returns an array of statements. We take the first one.
        const stmt = ast[0];
        const deps = extractViewDependencies(stmt);
        console.log(`  Deps: ${Array.from(deps).join(', ')}`);

        const missing = test.expected.filter(e => !deps.has(e));
        if (missing.length === 0) {
            console.log('  ✅ Pass');
        } else {
            console.error('  ❌ Fail', { missing, found: Array.from(deps) });
        }
    } catch (e: any) {
        console.error(`  ❌ Error parsing: ${e.message}`);
    }
}
