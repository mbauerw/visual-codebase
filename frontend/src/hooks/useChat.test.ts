import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import type { StreamEvent } from '../types/chat';
import type { ToolCallLog } from '../types/devtools';

// Mock the API client module
vi.mock('../api/client', () => ({
  sendChatMessage: vi.fn(),
  deleteChatHistory: vi.fn(),
  streamChatMessage: vi.fn(),
  getSuggestedQuestions: vi.fn(),
}));

// Mock the Supabase client
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  },
}));

// Mock requestAnimationFrame and cancelAnimationFrame for throttled updater
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 0) as unknown as number;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

// Import mocked modules after mocking
import {
  sendChatMessage,
  deleteChatHistory,
  streamChatMessage,
  getSuggestedQuestions,
} from '../api/client';

// Helper to create a mock stream handler
function createMockStreamHandler() {
  let onEventCallback: ((event: StreamEvent) => void) | null = null;
  let resolvePromise: (() => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;

  const mock = vi.fn(
    async (
      _analysisId: string,
      _request: unknown,
      onEvent: (event: StreamEvent) => void,
      _signal?: AbortSignal
    ) => {
      onEventCallback = onEvent;
      return new Promise<void>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
    }
  );

  return {
    mock,
    emit: (event: StreamEvent) => {
      if (onEventCallback) {
        onEventCallback(event);
      }
    },
    complete: () => {
      if (resolvePromise) {
        resolvePromise();
      }
    },
    error: (err: Error) => {
      if (rejectPromise) {
        rejectPromise(err);
      }
    },
  };
}

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Reset localStorage mock
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should return initial state with empty messages and no loading', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.conversationId).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.highlightedText).toBeNull();
      expect(result.current.currentToolName).toBeNull();
      expect(result.current.canRetry).toBe(false);
    });

    it('should provide all expected functions', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.setHighlightedText).toBe('function');
      expect(typeof result.current.clearHighlightedText).toBe('function');
      expect(typeof result.current.clearConversation).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.loadSuggestedQuestions).toBe('function');
      expect(typeof result.current.cancelStream).toBe('function');
      expect(typeof result.current.retryLastMessage).toBe('function');
      expect(typeof result.current.toggleDevTools).toBe('function');
    });

    it('should initialize with default token usage', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.tokenUsage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      });
    });

    it('should read devToolsExpanded from localStorage on init', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('true');

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.devToolsExpanded).toBe(true);
    });

    it('should default devToolsExpanded to false if localStorage is empty', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.devToolsExpanded).toBe(false);
    });

    it('should have default context mode as codebase', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.contextMode).toBe('codebase');
    });
  });

  describe('streaming mode', () => {
    it('should add user message immediately when sending', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      // User message should be added immediately
      expect(result.current.messages).toHaveLength(2); // user + assistant placeholder
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.isLoading).toBe(true);
    });

    it('should accumulate text_delta events', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      // Emit text deltas
      act(() => {
        streamHandler.emit({ type: 'text_delta', content: 'Hello' });
      });

      // Advance timers to let throttled updater flush
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      act(() => {
        streamHandler.emit({ type: 'text_delta', content: ' World' });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Complete the stream
      act(() => {
        streamHandler.emit({
          type: 'message_complete',
          conversation_id: 'conv-123',
        });
        streamHandler.complete();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Assistant message should have accumulated content
      const assistantMsg = result.current.messages.find(
        (m) => m.role === 'assistant'
      );
      expect(assistantMsg?.content).toContain('Hello');
    });

    it('should track tool_use_start and tool_use_end events', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Search for files');
      });

      // Emit tool_use_start
      act(() => {
        streamHandler.emit({
          type: 'tool_use_start',
          tool_name: 'search_files',
          tool_call_id: 'tool-1',
          tool_input: { query: 'test' },
          tool_input_preview: '{ query: "test" }',
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // currentToolName should be set
      expect(result.current.currentToolName).toBe('search_files');
      expect(result.current.toolCallLogs).toHaveLength(1);
      expect(result.current.toolCallLogs[0].status).toBe('running');

      // Emit tool_use_end
      act(() => {
        streamHandler.emit({
          type: 'tool_use_end',
          tool_call_id: 'tool-1',
          tool_output: '{ files: [] }',
          tool_output_preview: '{ files: [] }',
          tool_duration_ms: 100,
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // currentToolName should be cleared
      expect(result.current.currentToolName).toBeNull();
      expect(result.current.toolCallLogs[0].status).toBe('completed');
      expect(result.current.toolCallLogs[0].durationMs).toBe(100);
    });

    it('should derive tool_results in messages from toolCallLogs', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Search for files');
      });

      act(() => {
        streamHandler.emit({
          type: 'tool_use_start',
          tool_name: 'get_file_info',
          tool_call_id: 'tool-2',
          tool_input_preview: '{ filename: "test.ts" }',
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // The assistant message should have derived tool_results
      const assistantMsg = result.current.messages.find(
        (m) => m.role === 'assistant'
      );
      expect(assistantMsg?.tool_results).toBeDefined();
      expect(assistantMsg?.tool_results?.[0].name).toBe('get_file_info');
      expect(assistantMsg?.tool_results?.[0].status).toBe('running');
    });

    it('should set conversationId from message_complete event', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.conversationId).toBeNull();

      act(() => {
        streamHandler.emit({
          type: 'message_complete',
          conversation_id: 'new-conv-id',
        });
        streamHandler.complete();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.conversationId).toBe('new-conv-id');
    });

    it('should accumulate token usage from message_complete events', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        streamHandler.emit({
          type: 'message_complete',
          conversation_id: 'conv-1',
          token_usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        });
        streamHandler.complete();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.tokenUsage).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      });
    });

    it('should handle context_update events', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        streamHandler.emit({
          type: 'context_update',
          model_id: 'claude-3',
          question_intent: 'codebase_specific',
          context_info: {
            pre_request_tokens: 1000,
            post_request_tokens: 1500,
            system_prompt_tokens: 500,
            conversation_tokens: 300,
            tools_tokens: 200,
            context_window_limit: 200000,
            utilization_percent: 0.75,
          },
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.modelInfo.modelId).toBe('claude-3');
      expect(result.current.modelInfo.questionIntent).toBe('codebase_specific');
      expect(result.current.contextInfo).toBeDefined();
      expect(result.current.contextInfo?.pre_request_tokens).toBe(1000);
    });
  });

  describe('non-streaming mode', () => {
    it('should use sendChatMessage when streaming is disabled', async () => {
      vi.mocked(sendChatMessage).mockResolvedValue({
        response: 'Hello there!',
        conversation_id: 'conv-456',
        tools_used: ['search_files'],
      });

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: false })
      );

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(sendChatMessage).toHaveBeenCalledWith('test-analysis', {
        message: 'Hello',
        highlighted_text: undefined,
        selection_context: undefined,
        conversation_id: undefined,
        context_mode: 'codebase',
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Hello there!');
      expect(result.current.messages[1].tools_used).toEqual(['search_files']);
      expect(result.current.conversationId).toBe('conv-456');
    });

    it('should not send empty messages', async () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: false })
      );

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(sendChatMessage).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should set error on stream error event', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        streamHandler.emit({
          type: 'error',
          error: 'Something went wrong',
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.error).toBe('Something went wrong');
    });

    it('should set error when stream throws', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        streamHandler.error(new Error('Network error'));
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.canRetry).toBe(true);
    });

    it('should remove assistant placeholder on error', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        streamHandler.error(new Error('Error'));
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // User message stays, assistant placeholder removed
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
    });

    it('should set error when no analysis is selected', async () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: null, enableStreaming: true })
      );

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBe('No analysis selected');
    });

    it('should allow clearing error', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: null, enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBe('No analysis selected');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('retry functionality', () => {
    it('should retry last failed message', async () => {
      const streamHandler = createMockStreamHandler();
      let callCount = 0;
      vi.mocked(streamChatMessage).mockImplementation(async (...args) => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          throw new Error('Network error');
        }
        // Second call succeeds
        return streamHandler.mock(...args);
      });

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      // First attempt fails
      act(() => {
        result.current.sendMessage('Hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.canRetry).toBe(true);

      // Clear error and retry
      act(() => {
        result.current.clearError();
        result.current.retryLastMessage();
      });

      expect(result.current.canRetry).toBe(false);
      expect(streamChatMessage).toHaveBeenCalledTimes(2);
    });

    it('should not retry if no failed message', async () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      await act(async () => {
        await result.current.retryLastMessage();
      });

      expect(streamChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('cancellation', () => {
    it('should cancel ongoing stream', async () => {
      let abortSignal: AbortSignal | undefined;
      vi.mocked(streamChatMessage).mockImplementation(
        async (_id, _req, _onEvent, signal) => {
          abortSignal = signal;
          return new Promise(() => {}); // Never resolves
        }
      );

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.cancelStream();
      });

      expect(result.current.isLoading).toBe(false);
      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe('highlighted text', () => {
    it('should set and clear highlighted text', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      act(() => {
        result.current.setHighlightedText('function doSomething()');
      });

      expect(result.current.highlightedText).toBe('function doSomething()');

      act(() => {
        result.current.clearHighlightedText();
      });

      expect(result.current.highlightedText).toBeNull();
    });

    it('should include highlighted text in message request', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.setHighlightedText('const x = 1');
      });

      act(() => {
        result.current.sendMessage('What does this do?');
      });

      expect(streamChatMessage).toHaveBeenCalledWith(
        'test-analysis',
        expect.objectContaining({
          message: 'What does this do?',
          highlighted_text: 'const x = 1',
        }),
        expect.any(Function),
        expect.any(AbortSignal)
      );
    });

    it('should clear highlighted text after sending', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.setHighlightedText('const x = 1');
        result.current.sendMessage('What?');
      });

      act(() => {
        streamHandler.emit({ type: 'message_complete', conversation_id: 'c1' });
        streamHandler.complete();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.highlightedText).toBeNull();
    });
  });

  describe('context mode', () => {
    it('should allow changing context mode', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.contextMode).toBe('codebase');

      act(() => {
        result.current.setContextMode('general');
      });

      expect(result.current.contextMode).toBe('general');
    });

    it('should include context mode in request', async () => {
      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      // First change the context mode
      act(() => {
        result.current.setContextMode('general');
      });

      // Then send a message (in a separate act so state is updated)
      act(() => {
        result.current.sendMessage('What is TypeScript?');
      });

      expect(streamChatMessage).toHaveBeenCalledWith(
        'test-analysis',
        expect.objectContaining({
          context_mode: 'general',
        }),
        expect.any(Function),
        expect.any(AbortSignal)
      );
    });
  });

  describe('clear conversation', () => {
    it('should clear all messages and reset state', async () => {
      vi.mocked(deleteChatHistory).mockResolvedValue({ message: 'Deleted' });

      const streamHandler = createMockStreamHandler();
      vi.mocked(streamChatMessage).mockImplementation(streamHandler.mock);

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      // Send a message first
      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        streamHandler.emit({
          type: 'message_complete',
          conversation_id: 'conv-to-delete',
        });
        streamHandler.complete();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.conversationId).toBe('conv-to-delete');

      // Clear conversation
      await act(async () => {
        await result.current.clearConversation();
      });

      expect(deleteChatHistory).toHaveBeenCalledWith(
        'test-analysis',
        'conv-to-delete'
      );
      expect(result.current.messages).toEqual([]);
      expect(result.current.conversationId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.highlightedText).toBeNull();
      expect(result.current.toolCallLogs).toEqual([]);
      expect(result.current.tokenUsage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      });
    });
  });

  describe('dev tools', () => {
    it('should toggle dev tools and persist to localStorage', () => {
      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      expect(result.current.devToolsExpanded).toBe(false);

      act(() => {
        result.current.toggleDevTools();
      });

      expect(result.current.devToolsExpanded).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'visual-codebase:devToolsExpanded',
        'true'
      );

      act(() => {
        result.current.toggleDevTools();
      });

      expect(result.current.devToolsExpanded).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'visual-codebase:devToolsExpanded',
        'false'
      );
    });
  });

  describe('suggested questions', () => {
    it('should load suggested questions', async () => {
      vi.mocked(getSuggestedQuestions).mockResolvedValue({
        questions: [
          { question: 'What is this codebase about?', category: 'overview' },
          { question: 'What are the main components?', category: 'architecture' },
        ],
      });

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      await act(async () => {
        await result.current.loadSuggestedQuestions();
      });

      expect(result.current.suggestedQuestions).toHaveLength(2);
      expect(result.current.suggestedQuestions[0].question).toBe(
        'What is this codebase about?'
      );
    });

    it('should not load suggested questions without analysisId', async () => {
      const { result } = renderHook(() => useChat({ analysisId: null }));

      await act(async () => {
        await result.current.loadSuggestedQuestions();
      });

      expect(getSuggestedQuestions).not.toHaveBeenCalled();
    });

    it('should handle suggested questions load error gracefully', async () => {
      vi.mocked(getSuggestedQuestions).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() =>
        useChat({ analysisId: 'test-analysis' })
      );

      // Should not throw
      await act(async () => {
        await result.current.loadSuggestedQuestions();
      });

      // Suggested questions remain empty
      expect(result.current.suggestedQuestions).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should abort stream on unmount', () => {
      let abortSignal: AbortSignal | undefined;
      vi.mocked(streamChatMessage).mockImplementation(
        async (_id, _req, _onEvent, signal) => {
          abortSignal = signal;
          return new Promise(() => {}); // Never resolves
        }
      );

      const { result, unmount } = renderHook(() =>
        useChat({ analysisId: 'test-analysis', enableStreaming: true })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      // Unmount while streaming
      unmount();

      expect(abortSignal?.aborted).toBe(true);
    });
  });
});
