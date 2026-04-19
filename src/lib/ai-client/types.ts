/**
 * Shared types for the AI client system.
 * Single source of truth — no duplicates elsewhere.
 */

// ── Conversation ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: import('./artifacts/types').ArtifactItem[];
  modelUsed?: string | null;
  createdAt?: string;
  // Per-request execution data (attached to assistant messages)
  usage?: {
    creditsUsed: number;
    tokensUsed: { input: number; output: number };
    iterations: number;
    toolsUsed: string[];
  };
  executionTrace?: {
    steps: import('@/components/ai-panel/hooks/useAIAgent').AgentStep[];
    planSteps: PlanStep[];
    intent: string | null;
  };
}

// ── SSE Event payloads ─────────────────────────────────────────────────────────

export interface IntentEvent {
  primary:    string;
  secondary?: string[];
  confidence: number;
  tableHints?: string[];
  hasSQL?:    boolean;
}

export interface PlanStep {
  id:          string;
  tool:        string;
  description: string;
  status:      'pending' | 'running' | 'done' | 'error';
  depends_on?: string[];
}

export interface PlanEvent {
  steps: PlanStep[];
}

export interface PlanUpdateEvent {
  id:     string;
  status: PlanStep['status'];
  /** Tool name (present in ReAct mode — emitted with status=running) */
  tool?:  string;
  /** Human label for the tool (same as tool name in ReAct mode) */
  label?: string;
}

export interface ToolCallEvent {
  id:      string;
  name:    string;
  input?:  Record<string, unknown>;
}

export interface ToolResultEvent {
  id:        string;
  name:      string;
  success:   boolean;
  summary?:  string;
  latencyMs?: number;
}

export interface SQLValidationEvent {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export interface DeltaEvent {
  text: string;
}

export interface DoneEvent {
  usage?: {
    inputTokens?:  number;
    outputTokens?: number;
  };
  iterations?: number;
  toolsUsed?:  string[];
  intent?:     string;
  model?: {
    requested?: string;
    used?: string;
  };
  credits?: {
    used?: number;
  };
}

export interface ContextMetaEvent {
  tokens_estimated: number;
  context_limit:    number;
  context_pct:      number;
  iteration:        number;
}

export interface QuotaUpdateEvent {
  credits_used:      number;
  credits_remaining: number;
  daily_remaining?:  number;
  monthly_pct?:      number;
}

export interface AgentErrorEvent {
  message: string;
  code?:   string;
}

export interface ProposedFileChangeEvent {
  /** Unique change ID */
  changeId: string;
  /** File node ID */
  nodeId: string;
  fileName: string;
  /** Original content before the AI's change */
  originalContent?: string;
  /** The AI's proposed new content */
  proposedContent?: string;
  /** Human-readable summary */
  summary: string;
  /** Which tool generated this change */
  sourceTool:
    | 'workspace_create_file'
    | 'workspace_patch_file'
    | 'workspace_apply_diff'
    | 'workspace_update_file'
    | 'workspace_revert_to_version';
}

export interface ClarificationEvent {
  /** Question to ask the user */
  question: string;
  /** Optional context about why this is needed */
  context?: string;
  /** Suggested answers */
  suggestions?: string[];
}

export interface TodoUpdateEvent {
  /** Full TODO list state */
  items: {
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'done' | 'skipped';
  }[];
}

export interface SqlGenerationEvent {
  /** SQL being streamed character by character */
  sql: string;
  /** Whether streaming is complete */
  complete: boolean;
}

// ── Unified SSE event discriminated union ─────────────────────────────────────

export type AgentEvent =
  | { type: 'chat_id';         chatId: string }
  | { type: 'intent';          data: IntentEvent }
  | { type: 'thinking';        text: string }
  | { type: 'thinking_chunk';  text: string }
  | { type: 'thinking_clear' }
  | { type: 'plan';            data: PlanEvent }
  | { type: 'plan_update';   data: PlanUpdateEvent }
  | { type: 'tool_call';     data: ToolCallEvent }
  | { type: 'tool_result';   data: ToolResultEvent }
  | { type: 'sql_validation';data: SQLValidationEvent }
  | { type: 'delta';         text: string }
  | { type: 'artifact';      data: import('./artifacts/types').ArtifactItem }
  | { type: 'done';          data: DoneEvent }
  | { type: 'quota_update';  data: QuotaUpdateEvent }
  | { type: 'quota_exceeded';data: AgentErrorEvent }
  | { type: 'agent_timeout'; data: AgentErrorEvent }
  | { type: 'error';         data: AgentErrorEvent }
  | { type: 'context_meta';  data: ContextMetaEvent }
  | { type: 'proposed_file_change'; data: ProposedFileChangeEvent }
  | { type: 'clarification'; data: ClarificationEvent }
  | { type: 'todo_update';   data: TodoUpdateEvent }
  | { type: 'sql_generation';data: SqlGenerationEvent }
  | { type: 'warning';       data: { message: string; code?: string } }
  | { type: 'stopped';       data: { message: string; partialResults?: string } };

// ── Request base ───────────────────────────────────────────────────────────────

export interface AgentRequest {
  message:       string;
  connectionId?: string | null;
  history:       ChatMessage[];
  sessionId:     string;
  chatId?:       string;
  synthesisModel?: string;
  projectId?:    string;       // active project (for workspace file tools)
  currentSQL?:   string;       // SQL currently open in editor
}
