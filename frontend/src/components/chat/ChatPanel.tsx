import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  StopCircle,
  Wrench,
  RefreshCw,
  X,
  Terminal,
  Code2,
  Globe,
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useTextSelection } from '../../hooks/useTextSelection';
import { ChatMessage } from './ChatMessage';
import { DevToolsPanel } from './devtools';
import type { SelectionContext } from '../../types/chat';

interface ChatPanelProps {
  analysisId: string | null;
  expanded?: boolean;
  /** Rich selection context for better tool optimization */
  selectionContext?: SelectionContext | null;
}

export function ChatPanel({ analysisId, expanded, selectionContext }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    error,
    highlightedText,
    sendMessage,
    setHighlightedText,
    clearHighlightedText,
    clearConversation,
    clearError,
    suggestedQuestions,
    loadSuggestedQuestions,
    currentToolName,
    cancelStream,
    retryLastMessage,
    canRetry,
    tokenUsage,
    // Context mode
    contextMode,
    setContextMode,
    // Dev tools
    devToolsExpanded,
    toggleDevTools,
    toolCallLogs,
    contextInfo,
    modelInfo,
  } = useChat({ analysisId, enableStreaming: true, selectionContext });

  // Text selection hook - captures highlighted text from visualization
  const { clearSelection } = useTextSelection({
    enabled: expanded ?? false,
    minLength: 2,
    maxLength: 500,
    onSelect: (text) => {
      setHighlightedText(text);
    },
  });

  // Load suggested questions on mount
  useEffect(() => {
    if (analysisId && messages.length === 0 && suggestedQuestions.length === 0) {
      loadSuggestedQuestions();
    }
  }, [analysisId, messages.length, suggestedQuestions.length, loadSuggestedQuestions]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel becomes visible
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Keyboard shortcut for dev tools (Cmd/Ctrl + Shift + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleDevTools();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDevTools]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
    clearSelection();
  }, [inputValue, isLoading, sendMessage, clearSelection]);

  const handleSuggestedQuestion = useCallback(async (question: string) => {
    if (isLoading) return;
    await sendMessage(question);
  }, [isLoading, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Show empty state if not expanded
  if (!expanded) {
    return null;
  }

  // Show waiting state if no analysis
  if (!analysisId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="p-6 bg-slate-800/50 w-[96px] rounded-2xl border border-slate-700/50 mb-4">
          <Loader2 size={48} className="text-slate-600 animate-spin" />
        </div>
        <h3 className="text-lg font-medium text-slate-400 mb-2">Waiting for Analysis</h3>
        <p className="text-sm text-slate-500 max-w-[200px]">
          The AI assistant will be available once an analysis is loaded
        </p>
      </div>
    );
  }

  return (
    <div data-chat-panel className="h-full w-full flex flex-col relative bg-slate-900">
      {/* Header */}
      <div className="relative">
        <div className="p-4 border-b border-slate-800 bg-slate-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
                <MessageSquare size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Assistant</h2>
                <p className="text-xs text-slate-500">
                  {isLoading ? 'Processing...' : contextMode === 'codebase' ? 'Codebase Analysis' : 'General Assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tokenUsage.total_tokens > 0 && (
                <span
                  className="text-[10px] text-slate-500 font-mono"
                  title={`Input: ${tokenUsage.input_tokens.toLocaleString()} | Output: ${tokenUsage.output_tokens.toLocaleString()}`}
                >
                  {tokenUsage.total_tokens.toLocaleString()} tokens
                </span>
              )}
              <button
                onClick={toggleDevTools}
                className={`p-1.5 rounded-lg transition-colors ${
                  devToolsExpanded
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'hover:bg-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle dev tools (Cmd+Shift+D)"
              >
                <Terminal size={14} />
              </button>
              {messages.length > 0 && !isLoading && (
                <button
                  onClick={clearConversation}
                  className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 size={14} className="text-slate-500 hover:text-slate-300" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Mode Toggle */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/20">
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setContextMode('codebase')}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center ${
              contextMode === 'codebase'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            } disabled:opacity-50`}
            title="Full codebase context with analysis tools"
          >
            <Code2 size={12} />
            Codebase
          </button>
          <button
            onClick={() => setContextMode('general')}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center ${
              contextMode === 'general'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            } disabled:opacity-50`}
            title="General programming assistant (no tools, lower cost)"
          >
            <Globe size={12} />
            General
          </button>
        </div>
      </div>

      {/* Developer Tools Panel */}
      <DevToolsPanel
        isExpanded={devToolsExpanded}
        onToggle={toggleDevTools}
        tokenUsage={tokenUsage}
        contextInfo={contextInfo}
        toolCallLogs={toolCallLogs}
        modelInfo={modelInfo}
        messageCount={messages.length}
        isLoading={isLoading}
      />

      {/* Context indicator bar */}
      {(highlightedText || currentToolName) && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center justify-between text-xs">
            {highlightedText && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-amber-500 font-medium uppercase text-[10px]">Context</span>
                <span className="text-slate-400 truncate font-mono text-[11px] bg-slate-900/50 px-2 py-0.5 rounded">
                  {highlightedText}
                </span>
                <button
                  onClick={clearHighlightedText}
                  className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {currentToolName && (
              <div className="flex items-center gap-2 text-amber-500">
                <Wrench size={12} className="animate-pulse" />
                <span className="font-mono text-[11px]">{currentToolName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4">
              <MessageSquare size={32} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">
              {contextMode === 'codebase' ? 'Ask About This Codebase' : 'Ask a Programming Question'}
            </p>
            <p className="text-xs text-slate-500 mb-6 max-w-[200px]">
              {contextMode === 'codebase'
                ? 'Select text in the visualization for context'
                : 'General programming questions without codebase tools'}
            </p>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-3">
                  <Sparkles size={12} className="text-amber-500" />
                  <span className="uppercase tracking-wider text-[10px] font-medium">Suggestions</span>
                </div>
                {suggestedQuestions.slice(0, 4).map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.question)}
                    disabled={isLoading}
                    className="w-full text-left text-xs px-3 py-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {q.question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} variant="panel" />
            ))}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin text-amber-500" />
                <span>Processing request...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            {canRetry && (
              <button
                onClick={retryLastMessage}
                className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                title="Retry"
              >
                <RefreshCw size={12} />
              </button>
            )}
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-slate-800 bg-slate-800/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={contextMode === 'codebase' ? 'Ask about the codebase...' : 'Ask a programming question...'}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 rounded-lg resize-none transition-colors"
              rows={1}
              disabled={isLoading}
            />
          </div>
          {isLoading ? (
            <button
              type="button"
              onClick={cancelStream}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Stop generating"
            >
              <StopCircle size={18} className="text-red-400" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Send message"
            >
              <Send size={18} className="text-white" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
