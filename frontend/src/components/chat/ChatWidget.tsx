import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  StopCircle,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useTextSelection } from '../../hooks/useTextSelection';
import { ChatMessage } from './ChatMessage';

interface ChatWidgetProps {
  analysisId: string | null;
}

export function ChatWidget({ analysisId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
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
  } = useChat({ analysisId, enableStreaming: true });

  // Text selection hook
  const { clearSelection } = useTextSelection({
    enabled: isOpen,
    minLength: 2,
    maxLength: 500,
    onSelect: (text) => {
      setHighlightedText(text);
    },
  });

  // Load suggested questions when opening
  useEffect(() => {
    if (isOpen && messages.length === 0 && suggestedQuestions.length === 0) {
      loadSuggestedQuestions();
    }
  }, [isOpen, messages.length, suggestedQuestions.length, loadSuggestedQuestions]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shadow-lg flex items-center justify-center transition-all duration-200 hover:border-slate-600 z-50"
        title="Open AI Assistant"
      >
        <MessageSquare size={20} className="text-amber-400" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-chat-widget
      className="fixed bottom-6 right-6 w-96 h-[560px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-amber-400" />
          <h2 className="font-semibold text-white">AI Assistant</h2>
          {isLoading && (
            <Loader2 size={14} className="text-slate-400 animate-spin" />
          )}
        </div>
        <button
          onClick={toggleOpen}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Context indicator bar */}
      {(highlightedText || currentToolName) && (
        <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between text-xs">
            {highlightedText && (
              <div className="flex items-center gap-2 text-slate-400 flex-1 min-w-0">
                <span className="text-amber-400 shrink-0">Context:</span>
                <span className="truncate">"{highlightedText}"</span>
                <button
                  onClick={clearHighlightedText}
                  className="p-0.5 text-slate-500 hover:text-white transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {currentToolName && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Wrench size={12} className="animate-pulse" />
                <span>{currentToolName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageSquare size={32} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 mb-1">Ask me about this codebase</p>
            <p className="text-xs text-slate-600 mb-6">
              Select text in the visualization for context
            </p>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-2">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Suggested questions</span>
                </div>
                {suggestedQuestions.slice(0, 4).map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.question)}
                    disabled={isLoading}
                    className="w-full text-left text-xs px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <ChatMessage key={index} message={message} />
            ))}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1 truncate">{error}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none transition-all"
              rows={1}
              disabled={isLoading || !analysisId}
            />
          </div>
          <div className="flex flex-col gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={cancelStream}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                title="Stop generating"
              >
                <StopCircle size={16} className="text-red-400" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim() || !analysisId}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors group"
                title="Send message"
              >
                <Send size={16} className="text-slate-400 group-hover:text-amber-400 group-disabled:text-slate-600 transition-colors" />
              </button>
            )}
            {messages.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={clearConversation}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors group"
                title="Clear conversation"
              >
                <Trash2 size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
              </button>
            )}
          </div>
        </form>
        {!analysisId && (
          <p className="text-xs text-slate-600 mt-2">
            Waiting for analysis to load...
          </p>
        )}
      </div>
    </div>
  );
}
