/**
 * Prompt Enhancer
 * Calls the backend to rewrite a raw user prompt into a clearer, more specific
 * instruction for the AI agent. Uses a fast LLM call (no streaming needed).
 *
 * Endpoint: POST /api/ai/enhance-prompt
 */

export interface EnhancePromptResult {
  enhanced:  string;
  original:  string;
}

import { API_BASE_URL } from '../api/client';

/**
 * Enhance a user prompt using the LLM.
 * Returns the enhanced version. Falls back to the original on any error.
 *
 * @param prompt       - Raw user input
 * @param context      - Optional context hint (e.g. "sql_editor", "er_diagram")
 */
export async function enhancePrompt(
  prompt:  string,
  context: string = 'sql_editor'
): Promise<EnhancePromptResult> {
  const original = prompt.trim();

  if (!original) {
    return { enhanced: original, original };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/enhance-prompt`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prompt: original, context }),
    });

    if (!response.ok) {
      throw new Error(`Enhance failed: ${response.status}`);
    }

    const data = await response.json() as { enhanced?: string };
    const enhanced = (data.enhanced ?? original).trim();

    return { enhanced, original };
  } catch {
    // Fail silently — return original so the user is never blocked
    return { enhanced: original, original };
  }
}
