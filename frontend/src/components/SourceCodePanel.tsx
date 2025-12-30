import { useState, useEffect, useRef } from 'react';
import { X, FileCode, Copy, Check, ChevronDown, ChevronUp, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import type { Language } from '../types';

// Register languages with PrismLight
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);

// Custom dark theme matching the app's slate design
const customTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: '#e2e8f0', // slate-200
    background: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.6',
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: '#e2e8f0',
    background: '#0f172a', // slate-900
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.6',
    tabSize: 2,
    padding: '1rem',
    margin: 0,
    overflow: 'auto',
  },
  comment: { color: '#64748b' }, // slate-500
  prolog: { color: '#64748b' },
  doctype: { color: '#64748b' },
  cdata: { color: '#64748b' },
  punctuation: { color: '#94a3b8' }, // slate-400
  namespace: { opacity: 0.7 },
  property: { color: '#7dd3fc' }, // sky-300
  tag: { color: '#f472b6' }, // pink-400
  boolean: { color: '#c084fc' }, // purple-400
  number: { color: '#c084fc' },
  constant: { color: '#c084fc' },
  symbol: { color: '#c084fc' },
  deleted: { color: '#f87171' }, // red-400
  selector: { color: '#4ade80' }, // green-400
  'attr-name': { color: '#fbbf24' }, // amber-400
  string: { color: '#4ade80' }, // green-400
  char: { color: '#4ade80' },
  builtin: { color: '#38bdf8' }, // sky-400
  inserted: { color: '#4ade80' },
  operator: { color: '#94a3b8' }, // slate-400
  entity: { color: '#fbbf24', cursor: 'help' },
  url: { color: '#38bdf8' },
  '.language-css .token.string': { color: '#38bdf8' },
  '.style .token.string': { color: '#38bdf8' },
  atrule: { color: '#a78bfa' }, // violet-400
  'attr-value': { color: '#4ade80' },
  keyword: { color: '#f472b6' }, // pink-400
  function: { color: '#38bdf8' }, // sky-400
  'class-name': { color: '#fbbf24' }, // amber-400
  regex: { color: '#fbbf24' },
  important: { color: '#f472b6', fontWeight: 'bold' },
  variable: { color: '#e2e8f0' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
};

// Line number styles
const lineNumberStyle: React.CSSProperties = {
  minWidth: '3em',
  paddingRight: '1em',
  textAlign: 'right',
  userSelect: 'none',
  color: '#475569', // slate-600
};

interface SourceCodePanelProps {
  sourceCode: string | null;
  fileName: string;
  language: Language;
  lineCount: number;
  isLoading?: boolean;
  error?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SourceCodePanel({
  sourceCode,
  fileName,
  language,
  lineCount,
  isLoading = false,
  error = null,
  isOpen,
  onClose,
}: SourceCodePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panelHeight, setPanelHeight] = useState(800);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Map our Language type to Prism language identifiers
  const getPrismLanguage = (lang: Language): string => {
    const languageMap: Record<Language, string> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      unknown: 'javascript', // Fallback to JS for syntax highlighting
    };
    return languageMap[lang] || 'javascript';
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!sourceCode) return;
    try {
      await navigator.clipboard.writeText(sourceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle panel resizing
  useEffect(() => {
    const resizeHandle = resizeRef.current;
    if (!resizeHandle) return;

    let startY = 0;
    let startHeight = 0;

    const handleMouseDown = (e: MouseEvent) => {
      startY = e.clientY;
      startHeight = panelHeight;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 150), 700);
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    resizeHandle.addEventListener('mousedown', handleMouseDown);
    return () => {
      resizeHandle.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panelHeight]);

  if (!isOpen) return null;

  const effectiveHeight = isCollapsed ? 56 : isExpanded ? '900px' : panelHeight;

  return (
    <div
      ref={panelRef}
      className="bg-slate-900 border-t border-slate-700/50 flex flex-col transition-all duration-200"
      style={{ height: effectiveHeight }}
    >
      {/* Resize handle */}
      {!isCollapsed && !isExpanded && (
        <div
          ref={resizeRef}
          className="h-1 bg-slate-800 hover:bg-indigo-500/50 cursor-ns-resize transition-colors flex-shrink-0"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg flex-shrink-0">
            <FileCode size={16} className="text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate" title={fileName}>
              {fileName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="uppercase">{language}</span>
              <span className="text-slate-600">|</span>
              <span>{lineCount.toLocaleString()} lines</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!sourceCode || isLoading}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} className="text-slate-400" />
            )}
          </button>

          {/* Expand/Collapse toggle */}
          <button
            onClick={() => {
              if (isExpanded) {
                setIsExpanded(false);
              } else if (isCollapsed) {
                setIsCollapsed(false);
              } else {
                setIsExpanded(true);
              }
            }}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title={isExpanded ? 'Restore size' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 size={16} className="text-slate-400" />
            ) : (
              <Maximize2 size={16} className="text-slate-400" />
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => {
              setIsCollapsed(!isCollapsed);
              if (isExpanded) setIsExpanded(false);
            }}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-800 [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin" />
              <span className="text-sm">Loading source code...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-6">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <span className="text-sm text-center">{error}</span>
            </div>
          ) : sourceCode ? (
            <SyntaxHighlighter
              language={getPrismLanguage(language)}
              style={customTheme}
              showLineNumbers
              lineNumberStyle={lineNumberStyle}
              wrapLines
              customStyle={{
                margin: 0,
                background: '#0f172a',
                minHeight: '100%',
              }}
            >
              {sourceCode}
            </SyntaxHighlighter>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <FileCode size={32} className="text-slate-600" />
              <span className="text-sm">No source code available</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
