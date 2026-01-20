/**
 * Types for the chatbot feature
 */

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
  tools_used?: string[];
}

export interface ChatRequest {
  message: string;
  highlighted_text?: string;
  conversation_id?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  tools_used: string[];
}

export interface ChatHistoryResponse {
  conversation_id: string;
  messages: ChatMessage[];
  analysis_id: string;
}

export interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
  highlightedText: string | null;
}
