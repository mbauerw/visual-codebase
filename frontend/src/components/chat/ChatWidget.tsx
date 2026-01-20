import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  Minimize2,
  Maximize2,
  Highlighter,
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useTextSelection } from '../../hooks/useTextSelection';
import { ChatMessage } from './ChatMessage';

interface ChatWidgetProps {
  analysisId: string | null;
}

export function ChatWidget({ analysisId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
  } = useChat({ analysisId });

  // Text selection hook - updates highlighted text when user selects text
  const { selectedText, clearSelection } = useTextSelection({
    enabled: isOpen && !isMinimized,
    minLength: 2,
    maxLength: 500,
    onSelect: (text) => {
      setHighlightedText(text);
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
    clearSelection();
  }, [inputValue, isLoading, sendMessage, clearSelection]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-50"
        title="Open AI Assistant"
      >
        <MessageSquare size={24} className="text-white" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-xs text-white flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-chat-widget
      className={`fixed bottom-6 right-6 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col transition-all duration-200 z-50 ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-400" />
          <span className="text-sm font-medium text-white">AI Assistant</span>
          {isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={toggleOpen}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <MessageSquare size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Ask me anything about this codebase!</p>
                <p className="text-xs mt-2 text-slate-600">
                  Highlight text in the visualization to ask about specific elements.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} />
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Highlighted text indicator */}
          {highlightedText && (
            <div className="px-4 py-2 bg-amber-900/30 border-t border-amber-800">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <Highlighter size={14} />
                <span className="truncate flex-1">
                  Context: "{highlightedText.slice(0, 50)}{highlightedText.length > 50 ? '...' : ''}"
                </span>
                <button
                  onClick={clearHighlightedText}
                  className="text-amber-400 hover:text-amber-300"
                  title="Clear context"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the codebase..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={1}
                  disabled={isLoading || !analysisId}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim() || !analysisId}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Send message"
                >
                  <Send size={16} className="text-white" />
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearConversation}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 size={16} className="text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            {!analysisId && (
              <p className="text-xs text-slate-500 mt-2">
                Please wait for the analysis to load.
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
