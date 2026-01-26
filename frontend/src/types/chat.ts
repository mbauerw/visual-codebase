/**
 * Types for the chatbot feature
 */
import type { ContextInfo } from './devtools';

export type MessageRole = 'user' | 'assistant';

export type ToolResultStatus = 'running' | 'completed' | 'error';

/**
 * Inline tool result for progressive display within messages.
 */
export interface ToolResultInline {
  id: string;
  name: string;
  status: ToolResultStatus;
  inputPreview?: string;
  outputPreview?: string;
  durationMs?: number;
  error?: string;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
  tools_used?: string[];
  /** Inline tool results for progressive display */
  tool_results?: ToolResultInline[];
}

/**
 * Source of the text selection for rich context.
 */
export type SelectionSource =
  | 'source_code_panel'
  | 'graph_node'
  | 'tier_list'
  | 'file_tree'
  | 'unknown';

/**
 * Type of the selected text for better intent detection.
 */
export type SelectionType =
  | 'function_name'
  | 'variable'
  | 'import'
  | 'file_name'
  | 'code_block'
  | 'unknown';

/**
 * Rich context about the user's selection to reduce unnecessary tool calls.
 * When provided, the model can directly look up the relevant file/function
 * instead of searching through all files.
 */
export interface SelectionContext {
  /** Where the selection originated */
  source: SelectionSource;

  /** Current file being viewed in source panel */
  current_file?: {
    node_id: string;
    file_path: string;
    file_name: string;
    language: string;
    role?: string;
    category?: string;
  };

  /** Currently selected graph node */
  selected_node?: {
    node_id: string;
    file_path: string;
    role?: string;
    category?: string;
  };

  /** Line range if selecting from source code */
  line_range?: {
    start: number;
    end: number;
  };

  /** Detected type of the selection */
  selection_type?: SelectionType;
}

/**
 * Chat context mode - determines what context and tools are included.
 * 'codebase' sends full codebase context + all tools.
 * 'general' sends minimal context with no tools (for general programming questions).
 */
export type ContextMode = 'codebase' | 'general';

export interface ChatRequest {
  message: string;
  highlighted_text?: string;
  /** Rich context about the selection to optimize tool usage */
  selection_context?: SelectionContext;
  conversation_id?: string;
  /** Context mode: 'codebase' for full analysis, 'general' for general questions */
  context_mode?: ContextMode;
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
