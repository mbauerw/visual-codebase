/**
 * Types for the developer tools panel
 */

/**
 * Context window information for debugging
 */
export interface ContextInfo {
  pre_request_tokens: number;
  post_request_tokens: number;
  system_prompt_tokens: number;
  conversation_tokens: number;
  tools_tokens: number;
  context_window_limit: number;
  utilization_percent: number;
}

/**
 * Information about a single tool call
 */
export interface ToolCallLog {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  inputPreview?: string;
  output?: string;
  outputPreview?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
}

/**
 * Session metrics for the dev tools
 */
export interface SessionMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  toolCallCount: number;
  avgLatencyMs: number;
  latencies: number[];
}

/**
 * Model information
 */
export interface ModelInfo {
  modelId: string;
  contextWindowSize: number;
}

/**
 * Complete dev tools state
 */
export interface DevToolsState {
  isExpanded: boolean;
  toolCallLogs: ToolCallLog[];
  contextInfo: ContextInfo | null;
  sessionMetrics: SessionMetrics;
  modelInfo: ModelInfo;
}

/**
 * Initial/default dev tools state
 */
export const DEFAULT_DEV_TOOLS_STATE: DevToolsState = {
  isExpanded: false,
  toolCallLogs: [],
  contextInfo: null,
  sessionMetrics: {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    messageCount: 0,
    toolCallCount: 0,
    avgLatencyMs: 0,
    latencies: [],
  },
  modelInfo: {
    modelId: 'claude-sonnet-4-20250514',
    contextWindowSize: 200000,
  },
};

/**
 * LocalStorage key for dev tools expanded state
 */
export const DEV_TOOLS_STORAGE_KEY = 'visual-codebase:devToolsExpanded';
