import { getCsrfToken } from '@/lib/api/client';

/**
 * SSE Stream Parser
 * Reusable utility for parsing Server-Sent Events from a fetch() ReadableStream.
 * Used by all agent clients (sql-editor, er-diagram, etc.).
 */

/**
 * Parse an SSE ReadableStream and call onEvent for each (eventName, rawData) pair.
 * Handles multi-line data, comments (heartbeat), and partial chunks correctly.
 */
export async function parseEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void
): Promise<void> {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';
  let currentEvent = '';
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keep incomplete last line in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trimEnd();

        if (line === '') {
          // Blank line = dispatch event
          if (currentEvent && dataLines.length > 0) {
            onEvent(currentEvent, dataLines.join('\n'));
          }
          currentEvent = '';
          dataLines    = [];
          continue;
        }

        // SSE comment (heartbeat) — skip
        if (line.startsWith(':')) continue;

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      // Partial event at buffer boundary — don't dispatch yet
    }
    if (currentEvent && dataLines.length > 0) {
      onEvent(currentEvent, dataLines.join('\n'));
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * POST to an SSE endpoint and return an abort function.
 * Calls onEvent for each parsed event, onError on any failure.
 */
export function streamRequest(
  url:     string,
  payload: unknown,
  onEvent: (event: string, data: string) => void,
  onError: (err: Error) => void
): { abort: () => void } {
  const controller = new AbortController();

  (async () => {
    try {
      const csrfToken = getCsrfToken();
      const response = await fetch(url, {
        method:      'POST',
        headers:     { 
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body:        JSON.stringify(payload),
        signal:      controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`[${response.status}] ${text}`);
      }

      if (!response.body) throw new Error('No response body');

      await parseEventStream(response.body, onEvent);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return { abort: () => controller.abort() };
}
