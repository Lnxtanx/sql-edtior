/**
 * Parse Context & Symbol Table
 * 
 * Maintains global state during parsing for:
 * - Symbol resolution (types, tables, schemas)
 * - Dependency tracking
 * - Error collection
 */

import {
    Table,
    View,
    EnumType,
    CompositeType,
    PostgresFunction,
    Policy,
    Trigger,
    Index,
    Sequence,
    Domain,
    Extension,
    Role,
    ParserError,
    ParseOptions,
    DEFAULT_PARSE_OPTIONS,
    Symbol,
    SymbolType,
    VerificationLevel,
} from '../types/core-types';

/**
 * Dependency Graph for tracking relationships between objects
 */
export class DependencyGraph {
    private nodes: Set<string> = new Set();
    private edges: Map<string, Set<string>> = new Map();

    addNode(name: string): void {
        this.nodes.add(name);
        if (!this.edges.has(name)) {
            this.edges.set(name, new Set());
        }
    }

    addEdge(from: string, to: string): void {
        this.addNode(from);
        this.addNode(to);
        this.edges.get(from)!.add(to);
    }

    getDependencies(name: string): string[] {
        return Array.from(this.edges.get(name) || []);
    }

    getDependents(name: string): string[] {
        const dependents: string[] = [];
        for (const [node, deps] of this.edges) {
            if (deps.has(name)) {
                dependents.push(node);
            }
        }
        return dependents;
    }

    /**
     * Detect circular dependencies using DFS
     */
    findCycles(): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const path: string[] = [];

        const dfs = (node: string): void => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            for (const neighbor of this.edges.get(node) || []) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                } else if (recursionStack.has(neighbor)) {
                    // Found cycle
                    const cycleStart = path.indexOf(neighbor);
                    cycles.push(path.slice(cycleStart));
                }
            }

            path.pop();
            recursionStack.delete(node);
        };

        for (const node of this.nodes) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }

        return cycles;
    }

    /**
     * Topological sort (execution order)
     */
    topologicalSort(): string[] | null {
        const inDegree = new Map<string, number>();

        for (const node of this.nodes) {
            inDegree.set(node, 0);
        }

        for (const [, deps] of this.edges) {
            for (const dep of deps) {
                inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
            }
        }

        const queue: string[] = [];
        for (const [node, degree] of inDegree) {
            if (degree === 0) {
                queue.push(node);
            }
        }

        const result: string[] = [];
        while (queue.length > 0) {
            const node = queue.shift()!;
            result.push(node);

            for (const neighbor of this.edges.get(node) || []) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // If result doesn't contain all nodes, there's a cycle
        return result.length === this.nodes.size ? result : null;
    }
}

/**
 * Parse Context - Global state during parsing
 */
export class ParseContext {
    // Options
    options: ParseOptions;

    // Symbol registry
    private symbols: Map<string, Symbol> = new Map();

    // Collected objects
    tables: Map<string, Table> = new Map();
    views: Map<string, View> = new Map();
    enums: Map<string, EnumType> = new Map();
    compositeTypes: Map<string, CompositeType> = new Map();
    domains: Map<string, Domain> = new Map();
    functions: Map<string, PostgresFunction> = new Map();
    triggers: Map<string, Trigger> = new Map();
    indexes: Map<string, Index> = new Map();
    sequences: Map<string, Sequence> = new Map();
    policies: Map<string, Policy> = new Map();
    extensions: Map<string, Extension> = new Map();
    roles: Map<string, Role> = new Map();
    schemas: Set<string> = new Set(['public']);

    // Dependencies
    dependencies: DependencyGraph = new DependencyGraph();
    forwardReferences: Map<string, string[]> = new Map();

    // Errors and warnings
    errors: ParserError[] = [];
    warnings: ParserError[] = [];

    // Current state
    currentSchema: string = 'public';
    searchPath: string[] = ['public'];

    constructor(options: Partial<ParseOptions> = {}) {
        this.options = { ...DEFAULT_PARSE_OPTIONS, ...options };
        this.currentSchema = this.options.defaultSchema || 'public';
        this.searchPath = [this.currentSchema, 'public'];
    }

    /**
     * Get fully qualified name
     * Note: Does NOT enforce lowercase. Caller must handle normalization.
     */
    qualifyName(name: string, schema?: string): string {
        if (name.includes('.')) return name;
        const s = schema || this.currentSchema;
        return `${s}.${name}`;
    }

    /**
     * Register a symbol (table, type, etc.)
     */
    defineSymbol(
        name: string,
        type: SymbolType,
        object: any,
        schema?: string,
        verificationLevel: VerificationLevel = 'DEFINITIVE'
    ): void {
        const s = schema || this.currentSchema;
        // Store as fully qualified only
        const fullName = this.qualifyName(name, s);

        const symbol: Symbol = {
            name,
            type,
            schema: s,
            fullName,
            object,
            verificationLevel,
        };

        this.symbols.set(fullName, symbol);
        this.dependencies.addNode(fullName);
        console.log(`Defined symbol: ${fullName} (${type}, schema: ${symbol.schema})`);
    }

    /**
     * Resolve a symbol by name using search path
     * Search Path Default: [currentSchema, 'public']
     */
    resolveSymbol(name: string, searchSchemes?: string[]): Symbol | null {
        // 1. Fully qualified name
        if (name.includes('.')) {
            return this.symbols.get(name) || null;
        }

        // 2. Unqualified - use search path
        // Use provided schemes OR context search path
        const path = searchSchemes || this.searchPath;

        // Remove duplicates from path while preserving order
        const uniquePath = Array.from(new Set(path));

        for (const schema of uniquePath) {
            const fullName = `${schema}.${name}`;
            if (this.symbols.has(fullName)) {
                return this.symbols.get(fullName)!;
            }
        }

        return null;
    }

    /**
     * Check if a symbol exists
     */
    hasSymbol(name: string, searchSchemes?: string[]): boolean {
        return this.resolveSymbol(name, searchSchemes) !== null;
    }

    /**
     * Resolve a table by name
     */
    resolveTable(name: string): Table | null {
        const symbol = this.resolveSymbol(name);
        if (symbol && symbol.type === 'table') {
            return symbol.object as Table;
        }
        return null;
    }

    /**
     * Add a dependency from one object to another
     */
    addDependency(from: string, to: string): void {
        // We assume 'from' is already fully qualified or in current context
        // 'to' might be unqualified
        const fromSymbol = this.resolveSymbol(from);
        const toSymbol = this.resolveSymbol(to);

        const fromName = fromSymbol ? fromSymbol.fullName : this.qualifyName(from);
        const toName = toSymbol ? toSymbol.fullName : this.qualifyName(to);

        this.dependencies.addEdge(fromName, toName);
    }

    /**
     * Track a forward reference (used before defined)
     */
    addForwardReference(from: string, to: string): void {
        const fromSymbol = this.resolveSymbol(from);
        const fromName = fromSymbol ? fromSymbol.fullName : this.qualifyName(from);

        const refs = this.forwardReferences.get(fromName) || [];
        refs.push(to);
        this.forwardReferences.set(fromName, refs);
    }

    /**
     * Check for unresolved forward references
     */
    getUnresolvedReferences(): { from: string; to: string }[] {
        const unresolved: { from: string; to: string }[] = [];

        for (const [from, refs] of this.forwardReferences) {
            for (const ref of refs) {
                if (!this.hasSymbol(ref)) {
                    unresolved.push({ from, to: ref });
                } else {
                    // Resolve it now
                    const resolved = this.resolveSymbol(ref);
                    if (resolved) {
                        this.dependencies.addEdge(from, resolved.fullName);
                    }
                }
            }
        }

        return unresolved;
    }

    /**
     * Add an error
     */
    addError(error: ParserError): void {
        this.errors.push(error);
    }

    /**
     * Add a warning
     */
    addWarning(warning: ParserError): void {
        this.warnings.push(warning);
    }

    /**
     * Register a schema
     */
    addSchema(name: string): void {
        this.schemas.add(name);
    }

    /**
     * Set current schema context
     */
    setCurrentSchema(name: string): void {
        this.currentSchema = name;
        this.addSchema(name);
    }
}

/**
 * Create a fresh parse context
 */
export function createParseContext(options?: Partial<ParseOptions>): ParseContext {
    return new ParseContext(options);
}
