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
} from '../types/chat';

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
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

    // Abort any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    streamingMessageRef.current = '';

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder for assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      tools_used: [],
    };
    setMessages(prev => [...prev, assistantMessage]);

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
                streamingMessageRef.current += event.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (newMessages[lastIdx]?.role === 'assistant') {
                    newMessages[lastIdx] = {
                      ...newMessages[lastIdx],
                      content: streamingMessageRef.current,
                    };
                  }
                  return newMessages;
                });
              }
              break;

            case 'tool_use_start':
              setCurrentToolName(event.tool_name || null);
              if (event.tool_name) {
                toolsUsed.push(event.tool_name);
              }
              break;

            case 'tool_use_end':
              setCurrentToolName(null);
              break;

            case 'message_complete':
              if (event.conversation_id && !conversationId) {
                setConversationId(event.conversation_id);
              }
              if (event.tools_used) {
                toolsUsed = event.tools_used;
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
              setError(event.error || 'Unknown error');
              break;
          }
        },
        abortControllerRef.current.signal
      );

      // Clear highlighted text after sending
      setHighlightedText(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, not an error
        return;
      }
      const errorMessage = err?.message || 'Failed to send message';
      setError(errorMessage);
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
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [analysisId, conversationId, highlightedText]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    if (enableStreaming) {
      await sendMessageStreaming(message);
    } else {
      await sendMessageNonStreaming(message);
    }
  }, [enableStreaming, sendMessageStreaming, sendMessageNonStreaming]);

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
  };
}
