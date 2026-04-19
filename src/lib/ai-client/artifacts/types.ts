/**
 * Artifact types — pure data shapes, no UI.
 * Artifacts are the structured outputs produced by the AI agent:
 * SQL queries, migration scripts, markdown analysis, diffs, etc.
 */

export type ArtifactKind =
  | 'sql'          // SELECT / DML / DDL query
  | 'migration'    // migration script (ALTER TABLE etc.)
  | 'markdown'     // analysis, plan, explanation
  | 'diff'         // before/after SQL diff
  | 'file'         // generated file (e.g. seed data)
  | 'unknown';

export interface ArtifactItem {
  id:          string;     // unique per run (from backend or generated)
  kind:        ArtifactKind;
  title:       string;
  description?: string;
  content:     string;     // raw content (SQL text, markdown text, etc.)
  language?:   string;     // syntax highlighting hint: 'sql', 'markdown', 'json'
  preview?:    string;     // short preview snippet
  // For diff artifacts
  original?:   string;     // SQL before
  modified?:   string;     // SQL after
}

/** Map from backend `type` field → ArtifactKind */
export function resolveArtifactKind(backendType: string): ArtifactKind {
  switch (backendType?.toLowerCase()) {
    case 'sql':       return 'sql';
    case 'migration': return 'migration';
    case 'markdown':
    case 'report':
    case 'analysis':  return 'markdown';
    case 'diff':      return 'diff';
    case 'file':      return 'file';
    default:          return 'unknown';
  }
}

/** Build an ArtifactItem from a raw SSE artifact payload */
export function buildArtifact(raw: {
  type?:        string;
  content?:     string;
  title?:       string;
  description?: string;
  language?:    string;
  preview?:     string;
  original?:    string;
  modified?:    string;
}): ArtifactItem {
  return {
    id:          crypto.randomUUID(),
    kind:        resolveArtifactKind(raw.type ?? ''),
    title:       raw.title ?? 'Generated output',
    description: raw.description,
    content:     raw.content ?? '',
    language:    raw.language ?? (raw.type === 'sql' ? 'sql' : undefined),
    preview:     raw.preview,
    original:    raw.original,
    modified:    raw.modified,
  };
}
