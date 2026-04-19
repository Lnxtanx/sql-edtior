/**
 * Lightweight Markdown Renderer
 * Renders basic markdown (code blocks, inline code, bold, italic, lists, tables)
 * without external dependencies.
 */

import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className = '' }: MarkdownTextProps) {
  const rendered = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = '';
    let keyIndex = 0;
    let inUnorderedList = false;
    let inOrderedList = false;
    let tableBuffer: string[] = [];

    const flushCodeBlock = () => {
      if (codeContent.length > 0) {
        elements.push(
          <div key={`code-${keyIndex++}`} className="my-2 rounded-lg overflow-hidden border border-border/40">
            {codeLanguage && (
              <div className="px-3 py-1 bg-muted/30 border-b border-border/30 text-[10px] font-mono text-muted-foreground/60 uppercase">
                {codeLanguage}
              </div>
            )}
            <pre className="p-3 bg-muted/20 overflow-x-auto text-sm">
              <code className="font-mono text-sm leading-relaxed">{codeContent.join('\n')}</code>
            </pre>
          </div>
        );
        codeContent = [];
        codeLanguage = '';
      }
    };

    const flushTable = () => {
      if (tableBuffer.length < 2) {
        // Not a valid table (need at least header + separator), render as paragraphs
        tableBuffer.forEach((line, i) => {
          elements.push(
            <p key={`tbl-p-${keyIndex++}`} className="text-sm leading-relaxed my-1 break-words">
              {renderInlineMarkdown(line)}
            </p>
          );
        });
        tableBuffer = [];
        return;
      }

      const parseRow = (row: string): string[] => {
        return row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(cell => cell.trim());
      };

      const headers = parseRow(tableBuffer[0]);
      const dataRows = tableBuffer.slice(2).map(parseRow);

      elements.push(
        <div key={`table-${keyIndex++}`} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-border/30">
            <thead>
              <tr className="bg-muted/30">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold border-b border-border/30 whitespace-nowrap">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border-b border-border/20 break-words">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                  {row.length < headers.length &&
                    Array.from({ length: headers.length - row.length }).map((_, ci) => (
                      <td key={`empty-${ci}`} className="px-3 py-2 border-b border-border/20" />
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableBuffer = [];
    };

    const flushList = () => {
      inUnorderedList = false;
      inOrderedList = false;
    };

    const isTableSeparator = (line: string): boolean => {
      return /^\|[\s:-]+[-|:]+\s*\|/.test(line) || /^\s*-+\s*(\|\s*-+\s*)+\|?\s*$/.test(line);
    };

    const isTableRow = (line: string): boolean => {
      return /^\|[^|]*\|/.test(line) && line.trim().endsWith('|');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block toggle
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
          flushTable();
          inCodeBlock = false;
        } else {
          flushList();
          flushTable();
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim() || '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        flushList();
        flushTable();
        elements.push(<div key={`br-${keyIndex++}`} className="h-2" />);
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        flushList();
        flushTable();
        elements.push(
          <h3 key={`h3-${keyIndex++}`} className="text-base font-semibold mt-3 mb-1 break-words">
            {renderInlineMarkdown(line.slice(4))}
          </h3>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        flushList();
        flushTable();
        elements.push(
          <h2 key={`h2-${keyIndex++}`} className="text-lg font-semibold mt-3 mb-1 break-words">
            {renderInlineMarkdown(line.slice(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        flushList();
        flushTable();
        elements.push(
          <h1 key={`h1-${keyIndex++}`} className="text-xl font-bold mt-3 mb-2 break-words">
            {renderInlineMarkdown(line.slice(2))}
          </h1>
        );
        continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        flushList();
        flushTable();
        elements.push(<hr key={`hr-${keyIndex++}`} className="my-3 border-border/30" />);
        continue;
      }

      // Table handling
      if (isTableRow(line)) {
        flushList();
        tableBuffer.push(line);
        continue;
      }

      if (isTableSeparator(line)) {
        // This is a separator row — keep accumulating table data rows
        tableBuffer.push(line);
        continue;
      }

      // If we have table buffer and current line is NOT a table row or separator, flush
      if (tableBuffer.length > 0) {
        flushTable();
      }

      // Unordered list
      if (line.match(/^[-*] /)) {
        if (!inUnorderedList) {
          inUnorderedList = true;
          inOrderedList = false;
        }
        elements.push(
          <div key={`li-${keyIndex++}`} className="flex items-start gap-2 ml-1 my-0.5 min-w-0">
            <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-foreground/50 shrink-0" />
            <span className="text-sm leading-relaxed break-words flex-1 min-w-0">{renderInlineMarkdown(line.slice(2))}</span>
          </div>
        );
        continue;
      }

      // Ordered list
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (orderedMatch) {
        if (!inOrderedList) {
          inOrderedList = true;
          inUnorderedList = false;
        }
        elements.push(
          <div key={`oli-${keyIndex++}`} className="flex items-start gap-2 ml-1 my-0.5 min-w-0">
            <span className="text-xs font-mono text-muted-foreground/70 shrink-0 min-w-[1.5em] text-right">{orderedMatch[1]}.</span>
            <span className="text-sm leading-relaxed break-words flex-1 min-w-0">{renderInlineMarkdown(orderedMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        flushList();
        flushTable();
        elements.push(
          <blockquote key={`bq-${keyIndex++}`} className="border-l-3 border-primary/30 pl-3 py-1 my-2 text-muted-foreground text-sm italic">
            {renderInlineMarkdown(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${keyIndex++}`} className="text-sm leading-relaxed my-1 break-words">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    // Flush any remaining content
    if (inCodeBlock) {
      flushCodeBlock();
    }
    if (tableBuffer.length > 0) {
      flushTable();
    }

    return elements;
  }, [content]);

  return <div className={cn("break-words", className)}>{rendered}</div>;
}

/**
 * Render inline markdown (bold, italic, inline code, links)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={`ic-${keyIndex++}`} className="px-1.5 py-0.5 bg-muted/40 rounded text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(remaining.slice(0, linkMatch.index));
      }
      parts.push(
        <a key={`lnk-${keyIndex++}`} href={linkMatch[2]} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={`b-${keyIndex++}`} className="font-semibold">
          {renderInlineMarkdown(boldMatch[1])}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(remaining.slice(0, italicMatch.index));
      }
      parts.push(
        <em key={`i-${keyIndex++}`} className="italic">
          {renderInlineMarkdown(italicMatch[1])}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // No more markdown, push rest as text
    parts.push(remaining);
    break;
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
