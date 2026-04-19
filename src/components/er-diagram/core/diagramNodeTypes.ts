/**
 * core/diagramNodeTypes.ts
 *
 * React Flow nodeTypes and edgeTypes registries.
 * Keeping these at module scope (outside any component) prevents React Flow
 * from treating the maps as "changed" on every render, which would cause
 * it to unmount and remount every node — a catastrophic performance bug.
 *
 * Import and pass these directly to <ReactFlow nodeTypes={nodeTypes} />.
 */

import TableNode from '../nodes/TableNode';
import ViewNode from '../nodes/ViewNode';
import GroupNode from '../nodes/GroupNode';
import FunctionNode from '../nodes/FunctionNode';
import TypeNode from '../nodes/TypeNode';
import RoleNode from '../nodes/RoleNode';
import SequenceNode from '../nodes/SequenceNode';
import ExtensionNode from '../nodes/ExtensionNode';
import PolicyNode from '../nodes/PolicyNode';
import RelationshipEdge from '../edges/RelationshipEdge';
import ResonaEdge from '../edges/ResonaEdge';
import { ResonaTableNode, ResonaGroupNode, ResonaGlobalNode } from '../nodes/resona';

export const nodeTypes = {
    tableNode: TableNode,
    viewNode: ViewNode,
    matViewNode: ViewNode,
    groupNode: GroupNode,
    functionNode: FunctionNode,
    typeNode: TypeNode,
    enumNode: TypeNode,
    domainNode: TypeNode,
    roleNode: RoleNode,
    sequenceNode: SequenceNode,
    extensionNode: ExtensionNode,
    policyNode: PolicyNode,
    resonaTableNode: ResonaTableNode,
    resonaGroupNode: ResonaGroupNode,
    resonaGlobalNode: ResonaGlobalNode,
} as const;

export const edgeTypes = {
    relationship: RelationshipEdge,
    resonaEdge: ResonaEdge,
} as const;
