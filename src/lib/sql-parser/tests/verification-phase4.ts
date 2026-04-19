
import { parsePostgresSQL } from '../index';

const sql = `
-- 1. Quoted Identifiers & Case Sensitivity
CREATE TABLE public."MixedCaseTable" (id INT);
CREATE TABLE public.mixedcasetable (id INT); -- Should be separate table

-- 2. Search Path
CREATE SCHEMA myschema;
CREATE TABLE myschema.hidden_table (id INT);
SET search_path TO myschema, public;
CREATE TABLE visible_table (id INT); -- Should be in myschema
CREATE VIEW view_search_path AS SELECT * FROM hidden_table; -- Should resolve to myschema.hidden_table

-- 3. Trigger Function Dependency
CREATE FUNCTION public.my_trigger_func() RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER my_trigger
AFTER INSERT ON public."MixedCaseTable"
FOR EACH ROW
EXECUTE FUNCTION public.my_trigger_func();

-- 4. Partitioning
CREATE TABLE parent_table (id INT) PARTITION BY RANGE (id);
CREATE TABLE child_partition PARTITION OF parent_table FOR VALUES FROM (1) TO (10);
`;

console.log('Running Phase 4 Verification (Reliability & Identity)...');
const result = parsePostgresSQL(sql);

function checkTable(name: string, shouldExist: boolean) {
    const table = result.tables.find(t => t.name === name);
    if (shouldExist) {
        if (table) console.log(`✅ Found Table: ${name}`);
        else console.error(`❌ Missing Table: ${name}`);
    } else {
        if (!table) console.log(`✅ Table Not Found (Correct): ${name}`);
        else console.error(`❌ Found Table (Should Not Exist): ${name}`);
    }
}

function checkSchema(tableName: string, expectedSchema: string) {
    const table = result.tables.find(t => t.name === (expectedSchema ? `${expectedSchema}.${tableName}` : tableName));
    // For this test, we assume the parser sets schema property correctly
    if (table && table.schema === expectedSchema) {
        console.log(`✅ Table ${tableName} in correct schema: ${expectedSchema}`);
    } else {
        console.error(`❌ Table ${tableName} schema mismatch. Expected: ${expectedSchema}, Found: ${table?.schema} (Fullname: ${table?.name})`);
    }
}

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

console.log('--- Quoted Identifiers ---');
checkTable('public.MixedCaseTable', true);
checkTable('public.mixedcasetable', true);

console.log('--- Search Path ---');
// 'visible_table' created after SET search_path TO myschema... should be in myschema
checkSchema('visible_table', 'myschema');
// view_search_path -> hidden_table (should resolve to myschema.hidden_table)
// The view itself is in public (default) or myschema? CREATE VIEW w/o schema uses search path?
// Usually yes. Let's assume it puts it in myschema too matching postgres behavior.
// But mostly we care about the dependency resolution.
checkRelationship('myschema.view_search_path', 'myschema.hidden_table', 'VIEW_DEPENDENCY');

console.log('--- Trigger Function ---');
// Trigger -> Function
// We expect a relationship to the function now, derived from context dependencies check or explicit type
// Ideally explicit type TRIGGER_FUNCTION, but seeing as we default to deps...
// Actually, phase 4 plan said: "Emit a DEPENDENCY or TRIGGER_FUNCTION relationship"
// So we expect to find *something*
checkRelationship('my_trigger', 'public.my_trigger_func', 'TRIGGER_FUNCTION'); // Or generic DEPENDENCY

console.log('--- Partitioning ---');
checkRelationship('myschema.child_partition', 'myschema.parent_table', 'PARTITION_CHILD');

console.log('--- Debug Dump ---');
console.log('Tables:', result.tables.map(t => t.name));
console.log('Relationships:', result.relationships.map(r => `${r.source.table} -> ${r.target.table} [${r.type}]`));

console.log('--- Done ---');
