
import { parsePostgresSQL } from '../index';

const sql = `
-- Base Tables
CREATE TABLE public.auth_users (id UUID PRIMARY KEY);
CREATE TABLE public.audit_logs (
    id SERIAL PRIMARY KEY, 
    table_name TEXT, 
    operation TEXT, 
    user_id UUID
);

-- Function for Trigger
CREATE FUNCTION public.log_audit() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, operation, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Depends on public.auth_users (ON table) and public.log_audit (EXECUTE FUNCTION)
CREATE TRIGGER auth_audit_trigger
AFTER INSERT OR UPDATE ON public.auth_users
FOR EACH ROW
EXECUTE FUNCTION public.log_audit();

-- Policy: Depends on public.audit_logs (ON table)
CREATE POLICY view_own_logs ON public.audit_logs
FOR SELECT
USING (user_id = current_setting('app.current_user_id')::uuid);

-- Materialized View: Depends on public.auth_users
CREATE MATERIALIZED VIEW public.active_user_stats AS
SELECT count(*) as total FROM public.auth_users;

-- Broken Object: Trigger on missing table
CREATE TRIGGER broken_trigger
AFTER DELETE ON public.missing_table
FOR EACH ROW
EXECUTE FUNCTION public.log_audit();

-- Broken Object: Policy on missing table
CREATE POLICY broken_policy ON public.missing_table2
FOR ALL
USING (true);
`;

console.log('Running Phase 3 Verification (Advanced Objects & Warnings)...');
const result = parsePostgresSQL(sql);

function checkRelationship(source: string, target: string, type: string) {
    const found = result.relationships.find(r =>
        r.source.table === source &&
        r.target.table === target &&
        (type === '*' || r.type === type)
    );

    if (found) {
        console.log(`✅ Found Rel: ${source} -> ${target} [${found.type}]`);
    } else {
        console.error(`❌ Missing Rel: ${source} -> ${target} [Expected: ${type}]`);
    }
}

function checkWarning(code: string, affectedObject: string) {
    const found = result.warnings.find(w => w.code === code && w.affectedObject === affectedObject);
    if (found) {
        console.log(`✅ Found Warning: [${code}] for ${affectedObject}`);
    } else {
        console.error(`❌ Missing Warning: [${code}] for ${affectedObject}`);
        // console.log('Available warnings:', result.warnings.map(w => ({ c: w.code, o: w.affectedObject })));
    }
}

console.log('--- Triggers ---');
// Trigger -> Table
checkRelationship('auth_audit_trigger', 'public.auth_users', 'TRIGGER_TARGET');

console.log('--- Policies ---');
checkRelationship('view_own_logs', 'public.audit_logs', 'POLICY_TARGET');

console.log('--- Materialized Views ---');
checkRelationship('public.active_user_stats', 'public.auth_users', 'VIEW_DEPENDENCY');

console.log('--- Warnings ---');
// Warns are on the source object name
checkWarning('TABLE_UNKNOWN', 'broken_trigger');
checkWarning('TABLE_UNKNOWN', 'broken_policy');

console.log('--- Done ---');
