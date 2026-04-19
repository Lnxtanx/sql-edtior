import { parsePostgresSQL } from '../index';

const testSQL = `
-- Test composite type
CREATE TYPE geo_point AS (latitude NUMERIC(9,6), longitude NUMERIC(9,6));

-- Test domain
CREATE DOMAIN valid_email AS VARCHAR(255) CHECK (VALUE ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$');
CREATE DOMAIN positive_numeric AS NUMERIC(15, 2) CHECK (VALUE > 0);
`;

console.log('Testing Composite Types and Domains...\n');

const result = parsePostgresSQL(testSQL);

console.log('Composite Types:', result.compositeTypes.length);
result.compositeTypes.forEach(ct => console.log('  ', JSON.stringify(ct)));

console.log('\nDomains:', result.domains.length);
result.domains.forEach(d => console.log('  ', JSON.stringify(d)));

console.log('\nErrors:', result.errors.length);
result.errors.forEach(err => console.log('  ', err.code, '-', err.message.slice(0, 60)));
