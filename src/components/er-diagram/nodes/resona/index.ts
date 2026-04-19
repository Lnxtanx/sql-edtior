/**
 * Resona AI Nodes — barrel export
 *
 * Three scopes:
 * - ResonaTableNode  — per-table AI chat (connected via edge)
 * - ResonaGroupNode  — per-schema/group AI chat (connected via edge)
 * - ResonaGlobalNode — whole-schema AI chat (standalone, no edge)
 */

export { default as ResonaTableNode } from './ResonaTableNode';
export { default as ResonaGroupNode } from './ResonaGroupNode';
export { default as ResonaGlobalNode } from './ResonaGlobalNode';
export { default as ResonaNodeShell } from './ResonaNodeShell';
export { default as ResonaChatBody } from './ResonaChatBody';

export type { ResonaTableNodeData } from './ResonaTableNode';
export type { ResonaGroupNodeData } from './ResonaGroupNode';
export type { ResonaGlobalNodeData } from './ResonaGlobalNode';
