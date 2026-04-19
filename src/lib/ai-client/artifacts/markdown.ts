/**
 * Markdown artifact helpers — pure logic, no UI.
 * Converts AI-generated text into structured markdown artifact items.
 */

import { ArtifactItem } from './types';

/**
 * Wrap a plain text analysis/plan response as a markdown ArtifactItem.
 * Called when the agent emits a text response with no explicit artifact event.
 */
export function wrapTextAsMarkdown(
  text:    string,
  title?:  string
): ArtifactItem {
  return {
    id:       crypto.randomUUID(),
    kind:     'markdown',
    title:    title ?? 'Analysis',
    content:  text,
    language: 'markdown',
    preview:  text.slice(0, 120).replace(/\n+/g, ' ').trim(),
  };
}

/**
 * Extract all fenced code blocks of a given language from markdown text.
 * Useful for pulling SQL out of a markdown analysis response.
 */
export function extractCodeBlocks(
  markdown: string,
  language: string = 'sql'
): string[] {
  const pattern = new RegExp(
    `\`\`\`${language}\\s*\\n([\\s\\S]*?)\`\`\``,
    'gi'
  );
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Strip markdown formatting for plain-text display (notifications, titles).
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .trim();
}
