/**
 * AI Client — public API
 * Import from '@/lib/ai-client' for types and agents.
 */

// Types
export type {
  ChatMessage,
  AgentRequest,
  AgentEvent,
  IntentEvent,
  PlanStep,
  PlanEvent,
  PlanUpdateEvent,
  ToolCallEvent,
  ToolResultEvent,
  SQLValidationEvent,
  DeltaEvent,
  DoneEvent,
  ContextMetaEvent,
  QuotaUpdateEvent,
  AgentErrorEvent,
  ProposedFileChangeEvent,
  ClarificationEvent,
  TodoUpdateEvent,
  SqlGenerationEvent,
} from './types';

// Artifact types + helpers
export type { ArtifactItem, ArtifactKind, DiffLine, DiffChunk, DiffResult } from './artifacts/types';
export { buildArtifact, resolveArtifactKind }     from './artifacts/types';
export { wrapTextAsMarkdown, extractCodeBlocks, stripMarkdown } from './artifacts/markdown';
export { diffSQL, artifactToDiff, applyArtifact } from './artifacts/diff';

// Agents
export { streamSQLEditorAgent }  from './sql-editor/agent';
export type { SQLEditorAgentRequest } from './sql-editor/agent';

export { streamERDiagramAgent }  from './er-diagram/agent';
export type { ERDiagramAgentRequest, ERDiagramScope } from './er-diagram/agent';

// Prompt enhancer
export { enhancePrompt }         from './prompt-enhancer';
export type { EnhancePromptResult } from './prompt-enhancer';
