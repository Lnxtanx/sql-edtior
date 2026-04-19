
import { parsePostgresSQL } from '../index';

const sql = `
-- Table definitions
CREATE TABLE public.users (id INT PRIMARY KEY);
CREATE TABLE public.profiles (user_id INT REFERENCES public.users(id));

-- View 1: Simple Select
CREATE VIEW public.user_profiles AS
SELECT u.id, p.user_id 
FROM public.users u
JOIN public.profiles p ON u.id = p.user_id;

-- View 2: Subquery in FROM
CREATE VIEW public.active_users AS
SELECT * FROM (SELECT * FROM public.users WHERE id > 0) sub;

-- View 3: CTE
CREATE VIEW public.cte_view AS
WITH stats AS (SELECT user_id FROM public.profiles)
SELECT * FROM stats 
JOIN public.users u ON stats.user_id = u.id;
`;

console.log('Running Phase 2 Verification (Dependencies)...');
const result = parsePostgresSQL(sql);

// Helper to check dependencies
function checkDependency(from: string, to: string) {
    // Check if relationship exists with correct source/target properties
    const found = result.relationships.some(r =>
        r.source.table === from &&
        r.target.table === to
    );

    if (found) {
        console.log(`✅ Found dependency: ${from} -> ${to}`);
    } else {
        console.error(`❌ Missing dependency: ${from} -> ${to}`);
    }
}

console.log('--- View 1: JOINs ---');
checkDependency('public.user_profiles', 'public.users');
checkDependency('public.user_profiles', 'public.profiles');

console.log('--- View 2: Subquery ---');
checkDependency('public.active_users', 'public.users');

console.log('--- View 3: CTE ---');
checkDependency('public.cte_view', 'public.users');
checkDependency('public.cte_view', 'public.profiles');

// Double check CTE name is NOT a dependency
const cteDep = result.relationships.find(r => r.source.table === 'public.cte_view' && r.target.table === 'stats');
if (!cteDep) {
    console.log('✅ Correctly ignored CTE "stats" as external dependency');
} else {
    console.error('❌ Incorrectly marked CTE "stats" as external dependency');
}
