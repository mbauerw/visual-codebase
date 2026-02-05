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
  GripVertical,
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useTextSelection } from '../../hooks/useTextSelection';
import { ChatMessage } from './ChatMessage';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 900;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 580;
const STORAGE_KEY = 'chat-widget-size';

interface ChatWidgetProps {
  analysisId: string | null;
}

function loadSavedSize(): { width: number; height: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { width, height } = JSON.parse(saved);
      return {
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)),
        height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

function saveSizeToStorage(width: number, height: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }));
  } catch {
    // Ignore storage errors
  }
}

export function ChatWidget({ analysisId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Resize state
  const [size, setSize] = useState(loadSavedSize);
  const [isResizing, setIsResizing] = useState<'right' | 'top' | 'corner' | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Keyboard shortcut (Cmd+K / Ctrl+K) to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'right' | 'top' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  }, [size]);

  const handleResetSize = useCallback(() => {
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    saveSizeToStorage(DEFAULT_WIDTH, DEFAULT_HEIGHT);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const { x, y, width, height } = resizeStartRef.current;
      let newWidth = width;
      let newHeight = height;

      if (isResizing === 'right' || isResizing === 'corner') {
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + (e.clientX - x)));
      }
      if (isResizing === 'top' || isResizing === 'corner') {
        newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height - (e.clientY - y)));
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      resizeStartRef.current = null;
      saveSizeToStorage(size.width, size.height);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = isResizing === 'corner' ? 'nesw-resize' : isResizing === 'right' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, size.width, size.height]);

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
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 w-12 h-12 sm:w-24 sm:h-12 rounded-lg bg-gradient-to-br from-slate-900 to-gray-800 hover:bg-gradient-to-br hover:from-slate-800 hover:to-gray-600 border border-white shadow-lg flex items-center justify-center transition-all duration-200 z-50"
        title="Open AI Assistant (⌘K)"
      >
        <MessageSquare size={20} className="text-white" />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      data-chat-widget
      className={`fixed inset-4 sm:inset-auto sm:bottom-6 sm:left-6 bg-[#fafaf9] rounded-lg border shadow-2xl flex flex-col z-50 ${
        isResizing ? 'border-[#8b7355]/50' : 'border-[#e8e6e3]'
      }`}
      style={isMobile ? undefined : {
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
    >
      {/* Resize overlay during drag */}
      {isResizing && (
        <div className="absolute inset-0 bg-[#8b7355]/5 rounded-lg pointer-events-none z-30">
          <div className="absolute top-2 right-2 px-2 py-1 bg-[#2d3748] text-white text-[10px] font-mono rounded">
            {size.width} × {size.height}
          </div>
        </div>
      )}

      {/* Resize handles (hidden on mobile) */}
      {!isMobile && (
        <>
          {/* Right resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#8b7355]/20 transition-colors z-10 group"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-[#a0aec0]" />
            </div>
          </div>

          {/* Top resize handle */}
          <div
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[#8b7355]/20 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, 'top')}
          />

          {/* Top-right corner resize handle (double-click to reset) */}
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-[#8b7355]/30 transition-colors z-20 rounded-tr-lg"
            onMouseDown={(e) => handleResizeStart(e, 'corner')}
            onDoubleClick={handleResetSize}
            title="Double-click to reset size"
          />
        </>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e6e3] bg-white rounded-t-lg">
        <div className="flex items-center gap-4">
          <div className="p-2 border border-[#e8e6e3]">
            <MessageSquare size={16} className="text-[#8b7355]" />
          </div>
          <div>
            <h2 className="text-[#2d3748] text-base font-semibold">AI Assistant</h2>
            <p className="text-[10px] text-[#a0aec0] font-light tracking-wider uppercase mt-0.5">
              {isLoading ? 'Processing...' : 'Codebase Analysis'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tokenUsage.total_tokens > 0 && (
            <span
              className="text-[10px] text-[#a0aec0] font-light"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              title={`Input: ${tokenUsage.input_tokens.toLocaleString()} | Output: ${tokenUsage.output_tokens.toLocaleString()}`}
            >
              {tokenUsage.total_tokens.toLocaleString()} tokens
            </span>
          )}
          <button
            onClick={toggleOpen}
            className="p-2 text-[#a0aec0] hover:text-[#718096] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Context indicator bar */}
      {(highlightedText || currentToolName) && (
        <div className="px-6 py-3 border-b border-[#e8e6e3] bg-white">
          <div className="flex items-center justify-between text-xs">
            {highlightedText && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[#8b7355] font-light tracking-wider uppercase shrink-0">Context</span>
                <span
                  className="text-[#718096] truncate px-2 py-1 bg-[#fafaf9] border border-[#e8e6e3]"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace', fontSize: '11px' }}
                >
                  {highlightedText}
                </span>
                <button
                  onClick={clearHighlightedText}
                  className="p-1 text-[#a0aec0] hover:text-[#718096] transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {currentToolName && (
              <div className="flex items-center gap-2 text-[#8b7355]">
                <Wrench size={12} className="animate-pulse" />
                <span
                  className="font-light"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace', fontSize: '11px' }}
                >
                  {currentToolName}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e2e0dc] hover:[&::-webkit-scrollbar-thumb]:bg-[#d4d0cb] [&::-webkit-scrollbar-thumb]:rounded-full">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="p-6 border border-[#e8e6e3] bg-[#fafaf9] mb-6 ">
              <MessageSquare size={28} className="text-[#cbd5e0] rounded-md" />
            </div>
            <p className="text-sm text-[#4a5568] font-medium mb-1">Ask About This Codebase</p>
            <p className="text-xs text-[#a0aec0] font-light mb-8">
              Select text in the visualization for context
            </p>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-[#a0aec0] mb-3">
                  <Sparkles size={12} className="text-[#8b7355]" />
                  <span className="font-light tracking-wider uppercase">Suggested Questions</span>
                </div>
                {suggestedQuestions.slice(0, 4).map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.question)}
                    disabled={isLoading}
                    className="w-full text-left text-xs px-4 py-3 bg-[#fafaf9] hover:bg-[#f7f6f5] border border-[#e8e6e3] hover:border-[#d4d0cb] text-[#4a5568] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-3 text-[#a0aec0] text-sm">
                <Loader2 size={14} className="animate-spin text-[#8b7355]" />
                <span className="font-light">Processing request...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mb-3 px-4 py-3 bg-[#fdf2f2] border border-[#fecaca]">
          <div className="flex items-center gap-3 text-[#dc2626] text-xs">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1 truncate font-light">{error}</span>
            {canRetry && (
              <button
                onClick={retryLastMessage}
                className="text-[#dc2626] hover:text-[#b91c1c] transition-colors shrink-0"
                title="Retry"
              >
                <RefreshCw size={12} />
              </button>
            )}
            <button
              onClick={clearError}
              className="text-[#dc2626] hover:text-[#b91c1c] transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-6 py-4 border-t border-[#e8e6e3] rounded-b-lg bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="w-full px-4 py-3 bg-[#fafaf9] border border-[#e8e6e3] text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:border-[#d4d0cb] resize-none transition-colors"
              style={{ fontFamily: 'inherit' }}
              rows={1}
              disabled={isLoading || !analysisId}
            />
          </div>
          <div className="flex flex-col gap-2">
            {isLoading ? (
              <button
                type="button"
                onClick={cancelStream}
                className="p-3 bg-[#fafaf9] hover:bg-[#f7f6f5] border border-[#e8e6e3] hover:border-[#d4d0cb] transition-colors"
                title="Stop generating"
              >
                <StopCircle size={16} className="text-[#dc2626]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim() || !analysisId}
                className="p-3 bg-[#2d3748] hover:bg-[#4a5568] disabled:bg-[#e8e6e3] disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send size={16} className="text-white disabled:text-[#a0aec0]" />
              </button>
            )}
            {messages.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={clearConversation}
                className="p-3 bg-[#fafaf9] hover:bg-[#f7f6f5] border border-[#e8e6e3] hover:border-[#d4d0cb] transition-colors"
                title="Clear conversation"
              >
                <Trash2 size={16} className="text-[#a0aec0]" />
              </button>
            )}
          </div>
        </form>
        {!analysisId && (
          <p className="text-[10px] text-[#a0aec0] mt-2 font-light tracking-wider uppercase">
            Waiting for analysis...
          </p>
        )}
      </div>
    </div>
  );
}
