/**
 * Types for the chatbot feature
 */
import type { ContextInfo } from './devtools';

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

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  tools_used: string[];
  token_usage?: TokenUsage;
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

export type StreamEventType =
  | 'text_delta'
  | 'tool_use_start'
  | 'tool_use_end'
  | 'message_complete'
  | 'error'
  | 'context_update';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  tool_name?: string;
  conversation_id?: string;
  tools_used?: string[];
  error?: string;
  token_usage?: TokenUsage;

  // Developer tools fields
  tool_call_id?: string;
  tool_input?: Record<string, unknown>;
  tool_input_preview?: string;
  tool_output?: string;
  tool_output_preview?: string;
  tool_duration_ms?: number;
  context_info?: ContextInfo;
  model_id?: string;
}

export interface SuggestedQuestion {
  question: string;
  category: string;
}

export interface SuggestedQuestionsResponse {
  questions: SuggestedQuestion[];
}
