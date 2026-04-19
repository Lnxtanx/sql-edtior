import { View } from '../../sql-parser/types/core-types';
import { SchemaSubgraph, ProjectionFlags, RenderGraph } from '../types';
import { toNodeId } from '../utils';

/**
 * Apply projection flags to a subgraph, splitting nodes by type
 * and filtering relationships to only include rendered nodes.
 */
export function applyProjection(
    subgraph: SchemaSubgraph,
    flags: ProjectionFlags
): RenderGraph {
    const tables = subgraph.tables;
    const views: View[] = [];
    const matViews: View[] = [];
    const functions: any[] = [];
    const enums: any[] = [];
    const domains: any[] = [];
    const roles: any[] = [];
    const sequences: any[] = [];
    const extensions: any[] = [];
    const policies: any[] = [];

    // Track which node IDs are included in the render set
    const renderedNodeIds = new Set<string>();

    for (const node of subgraph.nodes) {
        renderedNodeIds.add(node.id);

        if (node.type === 'TABLE') {
            // Tables are always included (already in subgraph.tables)
            continue;
        }

        if (node.type === 'VIEW' && flags.showViews) {
            views.push(node.view);
        } else if (node.type === 'MATERIALIZED_VIEW' && flags.showMaterializedViews) {
            matViews.push(node.view);
        } else if (node.type === 'FUNCTION' && flags.showFunctions) {
            functions.push(node.functionDef);
        } else if (node.type === 'ENUM' && flags.showEnums) {
            enums.push(node.enumDef);
        } else if (node.type === 'DOMAIN' && flags.showDomains) {
            domains.push(node.domainDef);
        } else if (node.type === 'ROLE' && flags.showRoles) {
            roles.push(node.roleDef);
        } else if (node.type === 'SEQUENCE' && flags.showSequences) {
            sequences.push(node.sequenceDef);
        } else if (node.type === 'EXTENSION' && flags.showExtensions) {
            extensions.push(node.extensionDef);
        } else if (node.type === 'POLICY' && flags.showPolicies) {
            policies.push(node.policyDef);
        } else {
            // Node is filtered out — remove from rendered set
            renderedNodeIds.delete(node.id);
        }
    }

    // Filter relationships to only include edges where both endpoints are rendered
    const relationships = subgraph.relationships.filter(rel => {
        const sourceId = toNodeId(rel.source.schema, rel.source.table);
        const targetId = toNodeId(rel.target.schema, rel.target.table);
        return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
    });

    return { tables, views, matViews, functions, enums, domains, roles, sequences, extensions, policies, relationships };
}
