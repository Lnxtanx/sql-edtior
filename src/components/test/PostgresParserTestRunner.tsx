/**
 * Test Runner Component for PostgreSQL Parser
 * 
 * This component runs all tests and displays results visually.
 * Access it by importing and rendering in the app.
 */

import React, { useState, useEffect } from 'react';
import { runAllTests, TEST_SCHEMAS } from '@/lib/sql-parser.test';
import { parsePostgresSQL } from '@/lib/sql-parser';
import { formatAndValidateSchema } from '@/lib/schema-utils/sql-formatter';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

export function PostgresParserTestRunner() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [formatResult, setFormatResult] = useState<any>(null);

  const runTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const testResults = runAllTests();
      setResults(testResults);
      setIsRunning(false);
    }, 100);
  };

  const testSchema = () => {
    if (!selectedSchema) return;
    const schema = TEST_SCHEMAS[selectedSchema as keyof typeof TEST_SCHEMAS];
    if (schema) {
      const parsed = parsePostgresSQL(schema);
      const formatted = formatAndValidateSchema(schema);
      setParseResult(parsed);
      setFormatResult(formatted);
    }
  };

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PostgreSQL Parser Test Suite</h1>
      
      {/* Test Runner */}
      <div className="mb-8">
        <button
          onClick={runTests}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        {results.length > 0 && (
          <div className="mt-4">
            <div className={`text-lg font-semibold ${passedCount === totalCount ? 'text-green-600' : 'text-orange-600'}`}>
              {passedCount}/{totalCount} tests passed
            </div>
            
            <div className="mt-4 space-y-2">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded border ${result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                      {result.passed ? '✓' : '✗'}
                    </span>
                    <span className="font-medium">{result.name}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{result.details}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Individual Schema Tester */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-bold mb-4">Test Individual Schema</h2>
        
        <div className="flex gap-4 mb-4">
          <select 
            value={selectedSchema}
            onChange={(e) => setSelectedSchema(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Select a schema...</option>
            {Object.keys(TEST_SCHEMAS).map(name => (
              <option key={name} value={name}>{name.replace(/_SQL$/, '').replace(/_/g, ' ')}</option>
            ))}
          </select>
          
          <button
            onClick={testSchema}
            disabled={!selectedSchema}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Parse & Format
          </button>
        </div>
        
        {parseResult && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Parse Result</h3>
              <div className="bg-gray-100 p-3 rounded text-sm max-h-80 overflow-auto">
                <div>Tables: {parseResult.tables.length}</div>
                <div>Relationships: {parseResult.relationships.length}</div>
                <div>Enums: {parseResult.enums.size}</div>
                <div>Indexes: {parseResult.indexes.length}</div>
                <div>Views: {parseResult.views.length}</div>
                <div>Errors: {parseResult.errors.length}</div>
                {parseResult.errors.length > 0 && (
                  <div className="text-red-600 mt-2">
                    {parseResult.errors.join(', ')}
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Format Result</h3>
              <div className="bg-gray-100 p-3 rounded text-sm max-h-80 overflow-auto">
                <div>Can Generate ER: {formatResult.canGenerateERDiagram ? 'Yes' : 'No'}</div>
                <div>Tables Found: {formatResult.stats.tablesFound}</div>
                <div>Foreign Keys: {formatResult.stats.foreignKeysFound}</div>
                <div>Issues: {formatResult.issues.length}</div>
                {formatResult.issues.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formatResult.issues.map((issue: any, i: number) => (
                      <div key={i} className={`text-xs ${issue.type === 'error' ? 'text-red-600' : issue.type === 'warning' ? 'text-orange-600' : 'text-blue-600'}`}>
                        [{issue.type}] {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PostgresParserTestRunner;
