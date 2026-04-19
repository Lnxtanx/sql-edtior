/**
 * useAIAgent
 * Manages AI agent state for the SQL editor AI panel.
 * Connects to /api/sql-editor/agent via SSE streaming.
 *
 * Surfaces all SSE events including thinking, tool calls, plan steps
 * for a Cursor-like multi-step execution display.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  ChatMessage,
  AgentEvent,
  ArtifactItem,
  DoneEvent,
  PlanStep,
  ToolCallEvent,
  ToolResultEvent,
  QuotaUpdateEvent,
  buildArtifact,
} from '@/lib/ai-client';
import { streamSQLEditorAgent } from '@/lib/ai-client';
import { getProjectLatestChat } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';

// ── Public types ───────────────────────────────────────────────────────────────

export interface UseAIAgentOptions {
  connectionId?: string | null;
  projectId?:    string | null;
  currentSQL?:   string | null;
  compilationResult?: Record<string, unknown> | null;
  schemaGraph?: Record<string, unknown> | null;
  onApplySQL?:   (sql: string) => void;
  onFileCreated?: (fileInfo: { fileName: string; fileId?: string; parent_id?: string }) => void;
  /** Called when AI modifies an existing file — provides before/after content for diff/accept-reject */
  onFileModified?: (fileInfo: {
    nodeId: string;
    fileName: string;
    originalContent: string;
    proposedContent: string;
    originalVersion?: number;
    newVersion?: number;
    toolName: string;
  }) => void;
  scope?: 'global' | 'table' | 'group';
  contextName?: string | null;
}

/** A single step shown in the Cursor-like execution trace */
export interface AgentStep {
  id:        string;
  type:      'thinking' | 'tool_call' | 'tool_result' | 'plan_step' | 'sql_validation';
  label:     string;
  detail?:   string;
  status:    'running' | 'done' | 'error';
  latencyMs?: number;
}

export interface PerRequestUsage {
  creditsUsed: number;
  tokensUsed: { input: number; output: number };
  iterations: number;
  toolsUsed: string[];
}

export interface AIAgentState {
  loading:    boolean;
  error:      string | null;
  text:       string;              // accumulated delta text
  artifacts:  ArtifactItem[];
  done:       DoneEvent | null;
  history:    ChatMessage[];
  chatId:     string | null;

  // Cursor-like execution trace
  intent:     string | null;       // classified intent
  steps:      AgentStep[];         // all execution steps (thinking, tools, validations)
  planSteps:  PlanStep[];          // plan DAG nodes with status
  quota:      QuotaUpdateEvent | null;

  // TODO list (live progress tracking)
  todoList: import('@/lib/ai-client').TodoUpdateEvent | null;

  // Streaming SQL preview (during generation)
  streamingSQL: string;

  // Active clarification request
  clarification: import('@/lib/ai-client').ClarificationEvent | null;

  // Warnings during execution
  warnings: { message: string; code?: string }[];

  // Agent stopped state
  stopped: { message: string; partialResults?: string } | null;

  // Context window usage (updated per iteration via context_meta events)
  contextTokens: number;   // estimated tokens currently in context
  contextLimit:  number;   // model's total context window
  contextPct:    number;   // 0-100 percentage used

  // Live thinking text streaming in real-time (cleared when committed or final answer)
  liveThinking: string;
}

export interface UseAIAgentReturn {
  prompt:      string;
  setPrompt:   (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  state:       AIAgentState;
  send:        (message: string) => void;
  abort:       () => void;
  clear:       () => void;
  startNewChat: () => void;
  loadChat: (chatId: string, history: ChatMessage[]) => void;
  applySQL:    (sql: string) => void;

  // Clarification answer
  answerClarification: (answer: string) => void;

  // Clear streaming SQL (call after send)
  clearStreamingSQL: () => void;

  // Direct state access (for parent components)
  setState: React.Dispatch<React.SetStateAction<AIAgentState>>;
}

// ── Stable session ID (per browser tab) ───────────────────────────────────────

function createSessionId(): string {
  return crypto.randomUUID();
}

const INITIAL_STATE: AIAgentState = {
  loading:   false,
  error:     null,
  text:      '',
  artifacts: [],
  done:      null,
  history:   [],
  chatId:    null,
  intent:    null,
  steps:     [],
  planSteps: [],
  quota:     null,
  todoList:  null,
  contextTokens: 0,
  contextLimit:  128_000,
  contextPct:    0,
  streamingSQL: '',
  clarification: null,
  warnings:  [],
  stopped:   null,
  liveThinking: '',
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAIAgent({
  connectionId,
  projectId,
  currentSQL,
  compilationResult,
  schemaGraph,
  onApplySQL,
  onFileCreated,
  onFileModified,
  scope,
  contextName,
}: UseAIAgentOptions): UseAIAgentReturn {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [state,  setState]  = useState<AIAgentState>({
    ...INITIAL_STATE,
    chatId: createSessionId(),
  });

  const abortRef     = useRef<(() => void) | null>(null);
  const textRef      = useRef('');
  const artifactsRef = useRef<ArtifactItem[]>([]);
  const stepsRef     = useRef<AgentStep[]>([]);
  const planStepsRef = useRef<PlanStep[]>([]);
  // intentRef tracks the latest classified intent for use inside the done handler.
  // Cannot use state.intent there — handleEvent useCallback has [] deps so state
  // is frozen at initial render (stale closure).
  const intentRef    = useRef<string | null>(null);
  const creditsAtStartRef = useRef(0);
  // Track active tool calls so we can match tool_result to tool_call
  const activeToolsRef = useRef<Map<string, string>>(new Map()); // id → tool name
  // Live thinking text accumulated during a single LLM streaming call
  const liveThinkingRef = useRef('');

  // ── send ───────────────────────────────────────────────────────────────────
  const send = useCallback((message: string) => {
    if (!message.trim()) return;

    if (!connectionId && !projectId) {
      toast.error('Open a project or select a database connection first');
      return;
    }

    abortRef.current?.();

    // Capture current quota before reset
    const currentCreditsUsed = state.quota?.credits_used ?? 0;

    // Reset accumulators
    textRef.current       = '';
    artifactsRef.current  = [];
    stepsRef.current      = [];
    planStepsRef.current  = [];
    activeToolsRef.current.clear();
    liveThinkingRef.current = '';
    creditsAtStartRef.current = currentCreditsUsed;

    const userMsg: ChatMessage = { role: 'user', content: message };

    setState(prev => ({
      ...INITIAL_STATE,
      history: [...prev.history, userMsg],
      loading: true,
      chatId: prev.chatId ?? createSessionId(),
      quota: prev.quota,
      // Preserve context window model limit across turns (resets pct to 0 until first meta event)
      contextLimit: prev.contextLimit,
    }));

    const abort = streamSQLEditorAgent(
      {
        message,
        connectionId,
        chatId:     state.chatId ?? undefined,
        projectId:  projectId ?? undefined,
        currentSQL: currentSQL ?? undefined,
        compilationResult: compilationResult ?? undefined,
        schemaGraph: schemaGraph ?? undefined,
        synthesisModel: selectedModel,
        history:    [...state.history, userMsg],
        sessionId:  state.chatId ?? createSessionId(),
        scope,
        contextName,
      },
      (event: AgentEvent) => handleEvent(event, userMsg),
      (err: Error) => {
        setState(prev => ({ ...prev, loading: false, error: err.message }));
        toast.error('AI failed: ' + err.message);
      }
    );

    abortRef.current = abort;
  }, [connectionId, projectId, currentSQL, compilationResult, schemaGraph, selectedModel, state.chatId, state.history]);

  // ── event handler ──────────────────────────────────────────────────────────
  const handleEvent = useCallback((event: AgentEvent, userMsg: ChatMessage) => {
    switch (event.type) {

      case 'chat_id':
        setState(prev => ({ ...prev, chatId: event.chatId }));
        break;

      // ── Intent classified ─────────────────────────────────────────────────
      case 'intent':
        intentRef.current = event.data.primary;
        setState(prev => ({ ...prev, intent: event.data.primary }));
        break;

      // ── Live thinking chunk (real-time, during LLM stream) ───────────────
      case 'thinking_chunk': {
        liveThinkingRef.current += event.text;
        setState(prev => ({ ...prev, liveThinking: liveThinkingRef.current }));
        break;
      }

      // ── Thinking committed (tool-call iteration ended) ────────────────────
      case 'thinking': {
        // Strip <thinking> tags if present
        const cleanText = event.text.replace(/<\/?thinking>/g, '').trim();
        // Clear live thinking — it's now committed as a step
        liveThinkingRef.current = '';
        if (!cleanText) {
          setState(prev => ({ ...prev, liveThinking: '' }));
          break;
        }

        const step: AgentStep = {
          id:     `thinking-${Date.now()}`,
          type:   'thinking',
          label:  'Thinking…',
          detail: cleanText,
          status: 'done',
        };
        stepsRef.current = [...stepsRef.current, step];
        setState(prev => ({ ...prev, steps: stepsRef.current, liveThinking: '' }));
        break;
      }

      // ── Live thinking cleared (final answer — text becomes delta) ─────────
      case 'thinking_clear': {
        liveThinkingRef.current = '';
        setState(prev => ({ ...prev, liveThinking: '' }));
        break;
      }

      // ── Plan received ─────────────────────────────────────────────────────
      case 'plan':
        planStepsRef.current = event.data.steps;
        setState(prev => ({ ...prev, planSteps: planStepsRef.current }));
        break;

      // ── Plan step status update ───────────────────────────────────────────
      case 'plan_update': {
        const existing = planStepsRef.current.find(s => s.id === event.data.id);
        if (existing) {
          // Legacy: planner sent a plan event first — just update status
          planStepsRef.current = planStepsRef.current.map(s =>
            s.id === event.data.id ? { ...s, status: event.data.status } : s
          );
        } else if (event.data.status === 'running' && event.data.tool) {
          // ReAct mode: no plan event was sent — create plan step on the fly
          const newStep: PlanStep = {
            id:          event.data.id,
            tool:        event.data.tool,
            description: formatToolLabel(event.data.label ?? event.data.tool),
            status:      'running',
          };
          planStepsRef.current = [...planStepsRef.current, newStep];
        } else {
          // ReAct done/error for a step we know about — update status
          planStepsRef.current = planStepsRef.current.map(s =>
            s.id === event.data.id ? { ...s, status: event.data.status } : s
          );
        }
        setState(prev => ({ ...prev, planSteps: planStepsRef.current }));
        break;
      }

      // ── Tool call starting ────────────────────────────────────────────────
      case 'tool_call': {
        const tc = event.data as ToolCallEvent;
        activeToolsRef.current.set(tc.id, tc.name);
        const step: AgentStep = {
          id:     `tool-${tc.id}`,
          type:   'tool_call',
          label:  formatToolLabel(tc.name),
          detail: tc.input ? formatToolInput(tc.name, tc.input) : undefined,
          status: 'running',
        };
        stepsRef.current = [...stepsRef.current, step];
        setState(prev => ({ ...prev, steps: stepsRef.current }));
        break;
      }

      // ── Tool result returned ──────────────────────────────────────────────
      case 'tool_result': {
        const tr = event.data as ToolResultEvent & {
          file_name?: string; file_id?: string; node_id?: string; parent_id?: string;
          message?: string; original_content?: string; proposed_content?: string;
          original_version?: number;
        };
        // Update the matching tool_call step to done/error
        stepsRef.current = stepsRef.current.map(s =>
          s.id === `tool-${tr.id}`
            ? { ...s, status: tr.success ? 'done' : 'error', latencyMs: tr.latencyMs, detail: tr.summary || s.detail }
            : s
        );
        setState(prev => ({ ...prev, steps: stepsRef.current }));

        // Invalidate file cache when workspace tools modify files
        const workspaceTools = [
          'workspace_create_file',
          'workspace_update_file',
          'workspace_patch_file',
          'workspace_apply_diff',
          'workspace_batch_edit',
          'workspace_revert_to_version',
          'workspace_delete_node',
          'workspace_create_folder',
        ];
        if (tr.name && workspaceTools.includes(tr.name) && tr.success) {
          queryClient.invalidateQueries({ queryKey: queryKeys.files.all });

          // Notify when a file is successfully created
          if (tr.name === 'workspace_create_file' && onFileCreated) {
            onFileCreated({
              fileName: tr.file_name || 'Untitled',
              fileId: tr.file_id || tr.node_id,
              parent_id: tr.parent_id,
            });
          }

          // Notify when AI modifies an existing file — provides before/after for diff/accept-reject
          const writeTools = ['workspace_update_file', 'workspace_patch_file', 'workspace_apply_diff'];
          if (tr.name && writeTools.includes(tr.name) && tr.original_content !== undefined && tr.proposed_content !== undefined) {
            onFileModified?.({
              nodeId: tr.node_id || tr.file_id || '',
              fileName: tr.file_name || 'Unknown file',
              originalContent: tr.original_content,
              proposedContent: tr.proposed_content,
              originalVersion: tr.original_version,
              newVersion: (event.data as Record<string, unknown>).version_number as number | undefined,
              toolName: tr.name,
            });
          }
        }
        break;
      }

      // ── SQL Validation result ─────────────────────────────────────────────
      case 'sql_validation': {
        const { valid, errors, warnings } = event.data;
        const step: AgentStep = {
          id:     `validation-${Date.now()}`,
          type:   'sql_validation',
          label:  valid ? 'SQL validated ✓' : `SQL validation failed (${errors.length} error${errors.length !== 1 ? 's' : ''})`,
          detail: [...errors, ...warnings.map(w => `⚠ ${w}`)].join('\n') || undefined,
          status: valid ? 'done' : 'error',
        };
        stepsRef.current = [...stepsRef.current, step];
        setState(prev => ({ ...prev, steps: stepsRef.current }));
        break;
      }

      // ── Streaming text delta ──────────────────────────────────────────────
      case 'delta':
        textRef.current += event.text;
        setState(prev => ({ ...prev, text: textRef.current }));
        break;

      // ── Artifact emitted ──────────────────────────────────────────────────
      case 'artifact':
        artifactsRef.current = [...artifactsRef.current, event.data];
        setState(prev => ({ ...prev, artifacts: artifactsRef.current }));
        break;

      // ── Done ──────────────────────────────────────────────────────────────
      case 'done': {
        // Use credits.used from the done event directly — the server computes the
        // exact total for this run. Do NOT use state.quota (stale closure: handleEvent
        // has [] deps so state is frozen at the initial render value, always null).
        const creditsUsed = event.data.credits?.used ?? 0;
        const finalAssistantMsg: ChatMessage = {
          role: 'assistant',
          content: textRef.current,
          usage: {
            creditsUsed,
            tokensUsed: {
              input: event.data.usage?.inputTokens ?? 0,
              output: event.data.usage?.outputTokens ?? 0,
            },
            iterations: event.data.iterations ?? 0,
            toolsUsed: event.data.toolsUsed ?? [],
          },
          executionTrace: {
            steps: [...stepsRef.current],
            planSteps: [...planStepsRef.current],
            // Use intentRef (updated in-flight) not state.intent (stale closure)
            intent: intentRef.current,
          },
        };
        // Clear buffers instantly to prevent duplicate rendering in UI (once history message appears)
        textRef.current = '';
        stepsRef.current = [];
        planStepsRef.current = [];
        liveThinkingRef.current = '';

        setState(prev => ({
          ...prev,
          loading: false,
          text:    '',
          done:    event.data,
          steps:   [],
          planSteps: [],
          liveThinking: '',
          history: [...prev.history, finalAssistantMsg],
        }));
        if (artifactsRef.current.length > 0) {
          toast.success(`${artifactsRef.current.length} artifact${artifactsRef.current.length !== 1 ? 's' : ''} generated`);
        }
        break;
      }

      case 'quota_update':
        setState(prev => ({ ...prev, quota: event.data }));
        break;

      // ── TODO list update ─────────────────────────────────────────────────
      case 'todo_update':
        setState(prev => ({
          ...prev,
          todoList: event.data,
        }));
        break;

      // ── Clarification request ────────────────────────────────────────────
      case 'clarification':
        setState(prev => ({
          ...prev,
          clarification: event.data,
          loading: false,
        }));
        break;

      // ── SQL generation streaming ─────────────────────────────────────────
      case 'sql_generation':
        setState(prev => ({
          ...prev,
          streamingSQL: prev.streamingSQL + event.data.sql,
        }));
        if (event.data.complete) {
          // Reset after a short delay so the user can see the completed SQL
          setTimeout(() => {
            setState(prev => ({ ...prev, streamingSQL: '' }));
          }, 3000);
        }
        break;

      // ── Warning ──────────────────────────────────────────────────────────
      case 'warning':
        setState(prev => ({
          ...prev,
          warnings: [...prev.warnings, event.data],
        }));
        toast.warning(event.data.message);
        break;

      // ── Agent stopped ────────────────────────────────────────────────────
      case 'stopped':
        setState(prev => ({
          ...prev,
          loading: false,
          stopped: event.data,
        }));
        break;

      case 'context_meta':
        setState(prev => ({
          ...prev,
          contextTokens: event.data.tokens_estimated,
          contextLimit:  event.data.context_limit,
          contextPct:    event.data.context_pct,
        }));
        break;

      // ── Errors ────────────────────────────────────────────────────────────
      case 'error':
        setState(prev => ({ ...prev, loading: false, error: event.data.message }));
        toast.error(event.data.message);
        break;

      case 'quota_exceeded':
        setState(prev => ({ ...prev, loading: false, error: event.data.message }));
        toast.error('Quota exceeded: ' + event.data.message);
        break;

      case 'agent_timeout':
        setState(prev => ({ ...prev, loading: false, error: 'Agent timed out' }));
        toast.error('Agent timed out');
        break;

      default:
        break;
    }
  }, []);

  // ── clear ──────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    textRef.current       = '';
    artifactsRef.current  = [];
    stepsRef.current      = [];
    planStepsRef.current  = [];
    intentRef.current     = null;
    activeToolsRef.current.clear();
    liveThinkingRef.current = '';
    setPrompt('');
    setState({ ...INITIAL_STATE, chatId: createSessionId() });
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    textRef.current = '';
    artifactsRef.current = [];
    stepsRef.current = [];
    planStepsRef.current = [];
    intentRef.current = null;
    activeToolsRef.current.clear();
    liveThinkingRef.current = '';
    setPrompt('');
    setState(prev => ({
      ...INITIAL_STATE,
      quota: prev.quota,
      chatId: createSessionId(),
    }));
  }, []);

  const loadChat = useCallback((chatId: string, history: ChatMessage[]) => {
    abortRef.current?.();
    abortRef.current = null;
    textRef.current = '';
    artifactsRef.current = [];
    stepsRef.current = [];
    planStepsRef.current = [];
    activeToolsRef.current.clear();
    setPrompt('');
    setState(prev => ({
      ...INITIAL_STATE,
      quota: prev.quota,
      chatId,
      history,
    }));
  }, []);

  // ── Per-project chat loading ───────────────────────────────────────────────
  // When the active project changes, load the most recent chat for that project
  // (or start fresh). This gives every project its own persistent conversation.
  const prevProjectIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Skip on first mount (undefined → first real value is handled below)
    if (prevProjectIdRef.current === undefined) {
      prevProjectIdRef.current = projectId ?? null;
      // On initial mount with a project, load history
      if (projectId) {
        getProjectLatestChat(projectId).then(result => {
          if (result && result.messages.length > 0) {
            const history: ChatMessage[] = result.messages.map(m => ({
              role: m.role,
              content: m.content,
              artifacts: m.artifacts,
              modelUsed: m.modelUsed,
              createdAt: m.createdAt,
              executionTrace: m.executionTrace,
              usage: m.usage,
            }));
            loadChat(result.chat.id, history);
          }
        }).catch(() => {/* silently ignore — start fresh */});
      }
      return;
    }

    // Project changed
    if (projectId === prevProjectIdRef.current) return;
    prevProjectIdRef.current = projectId ?? null;

    // Abort any in-flight stream
    abortRef.current?.();
    abortRef.current = null;

    if (!projectId) {
      // No project open — start fresh blank chat
      textRef.current = '';
      artifactsRef.current = [];
      stepsRef.current = [];
      planStepsRef.current = [];
      intentRef.current = null;
      activeToolsRef.current.clear();
      setPrompt('');
      setState(prev => ({ ...INITIAL_STATE, quota: prev.quota, chatId: createSessionId() }));
      return;
    }

    // Load most recent chat for the new project, or start fresh
    getProjectLatestChat(projectId).then(result => {
      textRef.current = '';
      artifactsRef.current = [];
      stepsRef.current = [];
      planStepsRef.current = [];
      intentRef.current = null;
      activeToolsRef.current.clear();
      setPrompt('');

      if (result && result.messages.length > 0) {
        const history: ChatMessage[] = result.messages.map(m => ({
          role: m.role,
          content: m.content,
          artifacts: m.artifacts,
          modelUsed: m.modelUsed,
          createdAt: m.createdAt,
          executionTrace: m.executionTrace,
          usage: m.usage,
        }));
        setState(prev => ({
          ...INITIAL_STATE,
          quota: prev.quota,
          chatId: result.chat.id,
          history,
        }));
      } else {
        setState(prev => ({ ...INITIAL_STATE, quota: prev.quota, chatId: createSessionId() }));
      }
    }).catch(() => {
      setState(prev => ({ ...INITIAL_STATE, quota: prev.quota, chatId: createSessionId() }));
    });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── abort (stop stream, keep history) ─────────────────────────────────────
  const abort = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    liveThinkingRef.current = '';
    setState(prev => ({ ...prev, loading: false, steps: [], planSteps: [], liveThinking: '' }));
    stepsRef.current = [];
    planStepsRef.current = [];
  }, []);

  // ── applySQL ───────────────────────────────────────────────────────────────
  const applySQL = useCallback((sql: string) => {
    onApplySQL?.(sql);
  }, [onApplySQL]);

  // ── Clarification answer ──────────────────────────────────────────────────
  const answerClarification = useCallback((answer: string) => {
    setState(prev => ({
      ...prev,
      clarification: null,
    }));
    setPrompt(answer);
    send(answer);
  }, [send]);

  // ── Clear streaming SQL ───────────────────────────────────────────────────
  const clearStreamingSQL = useCallback(() => {
    setState(prev => ({ ...prev, streamingSQL: '' }));
  }, []);

  useEffect(() => { return () => { abortRef.current?.(); }; }, []);

  return {
    prompt, setPrompt, selectedModel, setSelectedModel,
    state, send, abort, clear, startNewChat, loadChat, applySQL,
    answerClarification, clearStreamingSQL,
    setState,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  sql_list_tables:         'Listing tables',
  sql_get_schema:          'Reading schema',
  sql_get_column_info:     'Inspecting column',
  sql_execute:             'Running query',
  sql_explain_query:       'Analyzing query plan',
  sql_validate:            'Validating SQL',
  sql_detect_antipatterns: 'Checking SQL quality',
  sql_write:               'Writing SQL',
  sql_refactor:            'Refactoring SQL',
  sql_optimize:            'Optimizing SQL',
  sql_debug:               'Debugging SQL',
  sql_suggest_fix:         'Suggesting fix',
  workspace_list_files:    'Listing project files',
  workspace_read_file:     'Reading file',
  workspace_search_files:  'Searching files',
  workspace_create_file:   'Creating file',
  workspace_update_file:   'Updating file',
  workspace_patch_file:    'Patching file',
  workspace_apply_diff:    'Applying diff',
  workspace_apply_multi_file: 'Updating multiple files',
  workspace_create_folder: 'Creating folder',
  workspace_delete_node:   'Deleting item',
  workspace_revert_to_version: 'Reverting file',
  // Database connection
  db_list_connections:         'Listing connections',
  db_test_connection:          'Testing connection',
  db_save_connection:          'Saving connection',
  db_get_project_connection:   'Checking project connection',
  db_link_project:             'Linking database to project',
  // Database migration
  db_pull_schema:              'Pulling schema from database',
  db_diff_schema:              'Comparing schema',
  db_detect_drift:             'Detecting schema drift',
  db_preview_migration:        'Previewing migration',
  db_apply_migration:          'Applying migration',
  db_migration_history:        'Fetching migration history',
  db_migration_status:         'Checking migration status',
  db_rollback:                 'Rolling back migration',
  // Terminal
  terminal_run_sw:             'Running sw command',
};

function formatToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  // DB-specific: show host+database for connection ops
  if (toolName === 'db_test_connection' || toolName === 'db_save_connection') {
    const host = input.host ?? '';
    const db   = input.database ?? '';
    return host ? `${host}/${db}` : String(db).slice(0, 80);
  }
  if (toolName === 'terminal_run_sw') {
    return String(input.command ?? '').slice(0, 80);
  }
  const val =
    input.table_name      ?? input.name         ?? input.node_id     ??
    input.query           ?? input.connection_id ?? input.requirement ??
    input.command         ?? input.sql           ?? null;
  return val ? String(val).slice(0, 80) : '';
}
