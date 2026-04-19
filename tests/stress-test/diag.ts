import { parsePostgresSQL } from '../../src/lib/sql-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sql = fs.readFileSync(path.join(__dirname, 'compiler-stress-schema.sql'), 'utf-8');
const s = parsePostgresSQL(sql);

console.log('=== TABLES (first 3) ===');
s.tables.slice(0,3).forEach(t => console.log(JSON.stringify({name:t.name,schema:t.schema,partitionOf:t.partitionOf})));

console.log('=== INDEXES (first 3) ===');
s.indexes.slice(0,3).forEach(i => console.log(JSON.stringify({name:i.name,table:i.table})));

console.log('=== TRIGGERS ===');
s.triggers.forEach(t => console.log(JSON.stringify({name:t.name,functionName:t.functionName,functionSchema:t.functionSchema})));

console.log('=== FUNCTIONS ===');
s.functions.forEach(f => console.log(JSON.stringify({name:f.name,schema:f.schema})));

console.log('=== VIEWS ===');
s.views.forEach(v => console.log(JSON.stringify({name:v.name,isMaterialized:v.isMaterialized})));

console.log('=== FK refs (first 5) ===');
for (const t of s.tables) {
  for (const c of t.columns) {
    if (c.isForeignKey && c.references) {
      console.log(JSON.stringify({table:t.name,col:c.name,refTable:c.references.table}));
    }
  }
}

console.log('=== NEXTVAL defaults ===');
for (const t of s.tables) {
  for (const c of t.columns) {
    if (c.defaultValue && c.defaultValue.includes('nextval')) {
      console.log(JSON.stringify({table:t.name,col:c.name,default:c.defaultValue}));
    }
  }
}

console.log('=== PARTITIONS ===');
s.tables.filter(t => t.partitionOf).forEach(t => console.log(JSON.stringify({name:t.name,partitionOf:t.partitionOf})));

console.log('=== POLICIES ===');
s.policies.forEach(p => console.log(JSON.stringify({name:p.name,table:p.table,command:p.command,roles:p.roles})));
