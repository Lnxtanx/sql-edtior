import { parsePostgresSQL } from '../index';
import { tryRegexParse } from '../strategies/strategy-pattern-match';
import { tryAstParse } from '../strategies/strategy-ast-parser';
import { tokenize } from '../core/tokenizer';
import { splitStatements } from '../phases/phase-2-split';
import { createParseContext } from '../context/parse-context';

const testSQL = `CREATE TYPE geo_point AS (latitude NUMERIC(9,6), longitude NUMERIC(9,6));`;

console.log('Testing Composite Type Parsing...\n');
console.log('SQL:', testSQL);
console.log();

// Tokenize
const tokens = tokenize(testSQL);

// Split into statements
const statements = splitStatements(tokens);
console.log('Statements:', statements.length);
if (statements.length > 0) {
    console.log('Statement Type:', statements[0].type);

    // Try AST parse first (like the parser does)
    const ctx = createParseContext({});
    const astResult = tryAstParse(statements[0], ctx);
    console.log('\nAST Parse Result:');
    console.log('  Success:', astResult.success);
    console.log('  Enums:', astResult.enums?.length || 0);
    console.log('  Error:', astResult.error);

    // Try regex parse
    const ctx2 = createParseContext({});
    const regexResult = tryRegexParse(statements[0], ctx2);
    console.log('\nRegex Parse Result:');
    console.log('  Success:', regexResult.success);
    console.log('  CompositeType:', regexResult.compositeType ? 'YES' : 'NO');
    console.log('  Error:', regexResult.error);
}

// Full parse
const result = parsePostgresSQL(testSQL);
console.log('\nFull Parse Results:');
console.log('  Enums:', result.enumTypes.length);
console.log('  Composite Types:', result.compositeTypes.length);
console.log('  Warnings:', result.warnings.length);
result.warnings.forEach(w => console.log('    -', w.code, w.message.slice(0, 60)));
