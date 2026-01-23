import { useState, useCallback, useRef, useEffect } from 'react';
import {
  sendChatMessage,
  deleteChatHistory,
  streamChatMessage,
  getSuggestedQuestions,
} from '../api/client';
import type {
  ChatMessage,
  ChatState,
  StreamEvent,
  SuggestedQuestion,
  TokenUsage,
  ToolResultInline,
} from '../types/chat';
import type {
  ToolCallLog,
  ContextInfo,
  ModelInfo,
} from '../types/devtools';
import { DEV_TOOLS_STORAGE_KEY, DEFAULT_DEV_TOOLS_STATE } from '../types/devtools';
import { createThrottledUpdater, type ThrottledUpdater } from '../utils/throttledUpdater';

interface UseChatOptions {
  analysisId: string | null;
  enableStreaming?: boolean;
}

interface UseChatReturn extends ChatState {
  sendMessage: (message: string) => Promise<void>;
  setHighlightedText: (text: string | null) => void;
  clearHighlightedText: () => void;
  clearConversation: () => Promise<void>;
  clearError: () => void;
  suggestedQuestions: SuggestedQuestion[];
  loadSuggestedQuestions: () => Promise<void>;
  currentToolName: string | null;
  cancelStream: () => void;
  retryLastMessage: () => Promise<void>;
  canRetry: boolean;
  tokenUsage: TokenUsage;
  // Dev tools
  devToolsExpanded: boolean;
  toggleDevTools: () => void;
  toolCallLogs: ToolCallLog[];
  contextInfo: ContextInfo | null;
  modelInfo: ModelInfo;
}

export function useChat({
  analysisId,
  enableStreaming = true,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);
  const [currentToolName, setCurrentToolName] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  });

  // Dev tools state
  const [devToolsExpanded, setDevToolsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEV_TOOLS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [toolCallLogs, setToolCallLogs] = useState<ToolCallLog[]>([]);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo>(DEFAULT_DEV_TOOLS_STATE.modelInfo);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageRef = useRef<string>('');
  const throttledUpdaterRef = useRef<ThrottledUpdater<string> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      throttledUpdaterRef.current?.cancel();
    };
  }, []);

  // Toggle dev tools and persist to localStorage
  const toggleDevTools = useCallback(() => {
    setDevToolsExpanded(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(DEV_TOOLS_STORAGE_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  const loadSuggestedQuestions = useCallback(async () => {
    if (!analysisId) return;

    try {
      const response = await getSuggestedQuestions(analysisId);
      setSuggestedQuestions(response.questions);
    } catch (err) {
      // Silently fail - suggested questions are optional
      console.warn('Failed to load suggested questions:', err);
    }
  }, [analysisId]);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setCurrentToolName(null);
  }, []);

  const sendMessageStreaming = useCallback(async (message: string) => {
    if (!analysisId) {
      setError('No analysis selected');
      return;
    }

    // Abort any existing stream and cancel throttled updater
    abortControllerRef.current?.abort();
    throttledUpdaterRef.current?.cancel();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    streamingMessageRef.current = '';
    // Reset tool call logs for new message
    setToolCallLogs([]);

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder for assistant message with empty tool_results
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      tools_used: [],
      tool_results: [],
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Create throttled updater for text content (batches updates at ~60fps)
    throttledUpdaterRef.current = createThrottledUpdater<string, ChatMessage[]>(
      setMessages,
      (prev, textDelta) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        if (newMessages[lastIdx]?.role === 'assistant') {
          streamingMessageRef.current += textDelta;
          newMessages[lastIdx] = {
            ...newMessages[lastIdx],
            content: streamingMessageRef.current,
          };
        }
        return newMessages;
      },
      { minIntervalMs: 16 } // ~60fps
    );

    try {
      let toolsUsed: string[] = [];

      await streamChatMessage(
        analysisId,
        {
          message,
          highlighted_text: highlightedText || undefined,
          conversation_id: conversationId || undefined,
        },
        (event: StreamEvent) => {
          switch (event.type) {
            case 'text_delta':
              if (event.content) {
                // Use throttled updater for batched text updates
                throttledUpdaterRef.current?.update(event.content);
              }
              break;

            case 'context_update':
              if (event.context_info) {
                setContextInfo(event.context_info);
              }
              if (event.model_id) {
                setModelInfo(prev => ({ ...prev, modelId: event.model_id! }));
              }
              break;

            case 'tool_use_start':
              setCurrentToolName(event.tool_name || null);
              if (event.tool_name) {
                toolsUsed.push(event.tool_name);
              }
              // Add tool call to dev tools logs
              if (event.tool_call_id && event.tool_name) {
                const newToolCall: ToolCallLog = {
                  id: event.tool_call_id,
                  name: event.tool_name,
                  input: event.tool_input,
                  inputPreview: event.tool_input_preview,
                  status: 'running',
                  startTime: Date.now(),
                };
                setToolCallLogs(prev => [...prev, newToolCall]);
              }
              // Add inline tool result to message for progressive display
              if (event.tool_call_id && event.tool_name) {
                const newToolResult: ToolResultInline = {
                  id: event.tool_call_id,
                  name: event.tool_name,
                  status: 'running',
                  inputPreview: event.tool_input_preview,
                };
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (newMessages[lastIdx]?.role === 'assistant') {
                    newMessages[lastIdx] = {
                      ...newMessages[lastIdx],
                      tool_results: [
                        ...(newMessages[lastIdx].tool_results || []),
                        newToolResult,
                      ],
                    };
                  }
                  return newMessages;
                });
              }
              break;

            case 'tool_use_end':
              setCurrentToolName(null);
              // Update tool call in dev tools logs with result
              if (event.tool_call_id) {
                setToolCallLogs(prev => prev.map(log =>
                  log.id === event.tool_call_id
                    ? {
                        ...log,
                        status: 'completed' as const,
                        endTime: Date.now(),
                        durationMs: event.tool_duration_ms,
                        output: event.tool_output,
                        outputPreview: event.tool_output_preview,
                      }
                    : log
                ));
              }
              // Update inline tool result in message
              if (event.tool_call_id) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (newMessages[lastIdx]?.role === 'assistant') {
                    newMessages[lastIdx] = {
                      ...newMessages[lastIdx],
                      tool_results: newMessages[lastIdx].tool_results?.map(tr =>
                        tr.id === event.tool_call_id
                          ? {
                              ...tr,
                              status: 'completed' as const,
                              outputPreview: event.tool_output_preview,
                              durationMs: event.tool_duration_ms,
                            }
                          : tr
                      ),
                    };
                  }
                  return newMessages;
                });
              }
              break;

            case 'message_complete':
              // Flush any pending throttled updates
              throttledUpdaterRef.current?.forceFlush();

              if (event.conversation_id && !conversationId) {
                setConversationId(event.conversation_id);
              }
              if (event.tools_used) {
                toolsUsed = event.tools_used;
              }
              // Track token usage (cumulative)
              if (event.token_usage) {
                setTokenUsage(prev => ({
                  input_tokens: prev.input_tokens + event.token_usage!.input_tokens,
                  output_tokens: prev.output_tokens + event.token_usage!.output_tokens,
                  total_tokens: prev.total_tokens + event.token_usage!.total_tokens,
                }));
              }
              // Update context info with final values
              if (event.context_info) {
                setContextInfo(event.context_info);
              }
              if (event.model_id) {
                setModelInfo(prev => ({ ...prev, modelId: event.model_id! }));
              }
              // Update final message with tools used
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (newMessages[lastIdx]?.role === 'assistant') {
                  newMessages[lastIdx] = {
                    ...newMessages[lastIdx],
                    tools_used: [...new Set(toolsUsed)],
                  };
                }
                return newMessages;
              });
              break;

            case 'error':
              // Flush any pending updates before showing error
              throttledUpdaterRef.current?.forceFlush();
              setError(event.error || 'Unknown error');
              break;
          }
        },
        abortControllerRef.current.signal
      );

      // Clear highlighted text after sending
      setHighlightedText(null);
    } catch (err: any) {
      // Clean up throttled updater
      throttledUpdaterRef.current?.cancel();

      if (err.name === 'AbortError') {
        // Request was cancelled, not an error
        return;
      }
      const errorMessage = err?.message || 'Failed to send message';
      setError(errorMessage);
      setLastFailedMessage(message);
      // Remove the assistant placeholder on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setCurrentToolName(null);
    }
  }, [analysisId, conversationId, highlightedText]);

  const sendMessageNonStreaming = useCallback(async (message: string) => {
    if (!analysisId) {
      setError('No analysis selected');
      return;
    }

    if (!message.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await sendChatMessage(analysisId, {
        message,
        highlighted_text: highlightedText || undefined,
        conversation_id: conversationId || undefined,
      });

      // Update conversation ID if this is a new conversation
      if (!conversationId) {
        setConversationId(response.conversation_id);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        tools_used: response.tools_used,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Clear highlighted text after sending
      setHighlightedText(null);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to send message';
      setError(errorMessage);
      setLastFailedMessage(message);
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [analysisId, conversationId, highlightedText]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Clear last failed message before attempting to send
    setLastFailedMessage(null);

    if (enableStreaming) {
      await sendMessageStreaming(message);
    } else {
      await sendMessageNonStreaming(message);
    }
  }, [enableStreaming, sendMessageStreaming, sendMessageNonStreaming]);

  const retryLastMessage = useCallback(async () => {
    if (!lastFailedMessage) return;
    const messageToRetry = lastFailedMessage;
    setLastFailedMessage(null);
    setError(null);
    await sendMessage(messageToRetry);
  }, [lastFailedMessage, sendMessage]);

  const clearHighlightedText = useCallback(() => {
    setHighlightedText(null);
  }, []);

  const clearConversation = useCallback(async () => {
    // Cancel any active stream
    abortControllerRef.current?.abort();

    if (analysisId && conversationId) {
      try {
        await deleteChatHistory(analysisId, conversationId);
      } catch (err) {
        // Ignore errors when clearing - server might not have the conversation
      }
    }
    setMessages([]);
    setConversationId(null);
    setError(null);
    setHighlightedText(null);
    setCurrentToolName(null);
    setTokenUsage({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
    // Reset dev tools state
    setToolCallLogs([]);
    setContextInfo(null);
    streamingMessageRef.current = '';
  }, [analysisId, conversationId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
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
    canRetry: !!lastFailedMessage,
    tokenUsage,
    // Dev tools
    devToolsExpanded,
    toggleDevTools,
    toolCallLogs,
    contextInfo,
    modelInfo,
  };
}
