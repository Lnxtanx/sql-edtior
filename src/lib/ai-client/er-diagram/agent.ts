/**
 * ER Diagram Agent Client (stub — to be implemented)
 * Will connect to POST /api/er-agent/agent for Resona node AI.
 * Scopes: global | table | group
 */

import { AgentRequest, AgentEvent } from '../types';
import { streamRequest }            from '../stream';
import { buildArtifact }            from '../artifacts/types';

export type ERDiagramScope = 'global' | 'table' | 'group';

export interface ERDiagramAgentRequest extends AgentRequest {
  scope:       ERDiagramScope;
  targetName?: string;   // table name for 'table' scope
}

/**
 * Stream the ER diagram agent (Resona nodes).
 * Same SSE event format as the SQL editor agent.
 */
export function streamERDiagramAgent(
  request:  ERDiagramAgentRequest,
  onEvent:  (event: AgentEvent) => void,
  onError:  (err: Error) => void
): () => void {
  const payload = {
    message:       request.message,
    connectionId:  request.connectionId,
    history:       request.history,
    session_id:    request.sessionId,
    scope:         request.scope,
    target_name:   request.targetName,
  };

  const { abort } = streamRequest(
    '/api/sql-editor/agent',   // re-uses sql-editor endpoint for now; swap when er-agent is ready
    payload,
    (event, data) => {
      try {
        const parsed = _parseEvent(event, data);
        if (parsed) onEvent(parsed);
      } catch (err) {
        console.warn('[ERDiagramAgent] Failed to parse event:', event, err);
      }
    },
    onError
  );

  return abort;
}

function _parseEvent(event: string, data: string): AgentEvent | null {
  switch (event) {
    case 'chat_id':       return { type: 'chat_id',      chatId: JSON.parse(data).chat_id };
    case 'intent':        return { type: 'intent',       data: JSON.parse(data) };
    case 'thinking':      return { type: 'thinking',     text: _tj(data)?.text ?? data };
    case 'plan':          return { type: 'plan',         data: JSON.parse(data) };
    case 'plan_update':   return { type: 'plan_update',  data: JSON.parse(data) };
    case 'tool_call':     return { type: 'tool_call',    data: JSON.parse(data) };
    case 'tool_result':   return { type: 'tool_result',  data: JSON.parse(data) };
    case 'delta':         return { type: 'delta',        text: _tj(data)?.text as string ?? data };
    case 'artifact':      return { type: 'artifact',     data: buildArtifact(JSON.parse(data)) };
    case 'done':          return { type: 'done',         data: JSON.parse(data) };
    case 'error':         return { type: 'error',        data: _tj(data) ?? { message: data } };
    default:              return null;
  }
}

function _tj(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw); } catch { return null; }
}
