import { useState, useCallback } from 'react';
import { sendChatMessage, deleteChatHistory } from '../api/client';
import type { ChatMessage, ChatState } from '../types/chat';

interface UseChatOptions {
  analysisId: string | null;
}

interface UseChatReturn extends ChatState {
  sendMessage: (message: string) => Promise<void>;
  setHighlightedText: (text: string | null) => void;
  clearHighlightedText: () => void;
  clearConversation: () => Promise<void>;
  clearError: () => void;
}

export function useChat({ analysisId }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
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

  const clearHighlightedText = useCallback(() => {
    setHighlightedText(null);
  }, []);

  const clearConversation = useCallback(async () => {
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
  };
}
