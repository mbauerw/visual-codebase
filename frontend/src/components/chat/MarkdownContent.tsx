import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { Components } from 'react-markdown';

/**
 * Minimal Prism theme matching the app's slate design.
 * Kept compact since chat code blocks are typically short snippets.
 */
const codeTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: '#e2e8f0',
    background: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: '#e2e8f0',
    background: '#0f172a',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    tabSize: 2,
    padding: '0.75rem',
    margin: 0,
    overflow: 'auto',
    borderRadius: '0.375rem',
  },
  comment: { color: '#64748b' },
  punctuation: { color: '#94a3b8' },
  property: { color: '#7dd3fc' },
  tag: { color: '#f472b6' },
  boolean: { color: '#c084fc' },
  number: { color: '#c084fc' },
  string: { color: '#4ade80' },
  keyword: { color: '#f472b6' },
  function: { color: '#38bdf8' },
  'class-name': { color: '#fbbf24' },
  operator: { color: '#94a3b8' },
  builtin: { color: '#38bdf8' },
  variable: { color: '#e2e8f0' },
};

interface MarkdownContentProps {
  content: string;
  variant: 'widget' | 'panel';
}

/**
 * Renders markdown content with syntax-highlighted code blocks.
 * Supports GFM (tables, strikethrough, task lists).
 */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  variant,
}: MarkdownContentProps) {
  const isPanel = variant === 'panel';

  const components: Components = {
    // Fenced code blocks with syntax highlighting
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      // Inline code (no language class, short content, no newlines)
      if (!match && !codeString.includes('\n')) {
        return (
          <code
            className={
              isPanel
                ? 'bg-slate-700 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono'
                : 'bg-[#e8e6e3] text-[#8b5e34] px-1.5 py-0.5 rounded text-xs font-mono'
            }
            {...props}
          >
            {children}
          </code>
        );
      }

      // Fenced code block
      return (
        <SyntaxHighlighter
          style={codeTheme}
          language={match?.[1] || 'text'}
          PreTag="div"
          customStyle={{
            margin: '0.5rem 0',
            borderRadius: '0.375rem',
            border: isPanel ? '1px solid #334155' : '1px solid #d4d0cb',
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      );
    },

    // Block-level elements
    p({ children }) {
      return <p className="mb-2 last:mb-0">{children}</p>;
    },
    h1({ children }) {
      return <h1 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-sm font-semibold mb-1.5 mt-2.5 first:mt-0">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0">{children}</h3>;
    },

    // Lists
    ul({ children }) {
      return <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>;
    },
    li({ children }) {
      return <li className="pl-0.5">{children}</li>;
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isPanel
              ? 'text-amber-400 hover:text-amber-300 underline underline-offset-2'
              : 'text-[#8b5e34] hover:text-[#6b4226] underline underline-offset-2'
          }
        >
          {children}
        </a>
      );
    },

    // Blockquote
    blockquote({ children }) {
      return (
        <blockquote
          className={`border-l-2 pl-3 my-2 italic ${
            isPanel
              ? 'border-slate-600 text-slate-400'
              : 'border-[#d4d0cb] text-[#718096]'
          }`}
        >
          {children}
        </blockquote>
      );
    },

    // Horizontal rule
    hr() {
      return (
        <hr
          className={`my-3 border-t ${
            isPanel ? 'border-slate-700' : 'border-[#e8e6e3]'
          }`}
        />
      );
    },

    // Tables (GFM)
    table({ children }) {
      return (
        <div className="overflow-x-auto my-2">
          <table
            className={`text-xs w-full border-collapse ${
              isPanel ? 'border-slate-700' : 'border-[#d4d0cb]'
            }`}
          >
            {children}
          </table>
        </div>
      );
    },
    th({ children }) {
      return (
        <th
          className={`px-2 py-1 text-left font-medium border ${
            isPanel
              ? 'border-slate-700 bg-slate-800'
              : 'border-[#d4d0cb] bg-[#f0eeeb]'
          }`}
        >
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td
          className={`px-2 py-1 border ${
            isPanel ? 'border-slate-700' : 'border-[#d4d0cb]'
          }`}
        >
          {children}
        </td>
      );
    },

    // Strong/emphasis
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>;
    },
  };

  return (
    <div className="markdown-content break-words text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
