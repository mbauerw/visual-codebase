import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { ChatPanel } from '../ChatPanel';
import type { ChatMessage } from '../../../types/chat';

// Mock scrollIntoView which JSDOM doesn't support
Element.prototype.scrollIntoView = vi.fn();

// Mock the useChat hook
const mockSendMessage = vi.fn();
const mockClearConversation = vi.fn();
const mockSetContextMode = vi.fn();
const mockCancelStream = vi.fn();
const mockRetryLastMessage = vi.fn();
const mockClearError = vi.fn();
const mockClearHighlightedText = vi.fn();
const mockSetHighlightedText = vi.fn();
const mockLoadSuggestedQuestions = vi.fn();
const mockToggleDevTools = vi.fn();

const defaultUseChatReturn = {
  messages: [] as ChatMessage[],
  isLoading: false,
  error: null as string | null,
  highlightedText: null as string | null,
  sendMessage: mockSendMessage,
  setHighlightedText: mockSetHighlightedText,
  clearHighlightedText: mockClearHighlightedText,
  clearConversation: mockClearConversation,
  clearError: mockClearError,
  suggestedQuestions: [],
  loadSuggestedQuestions: mockLoadSuggestedQuestions,
  currentToolName: null as string | null,
  cancelStream: mockCancelStream,
  retryLastMessage: mockRetryLastMessage,
  canRetry: false,
  tokenUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  contextMode: 'codebase' as const,
  setContextMode: mockSetContextMode,
  devToolsExpanded: false,
  toggleDevTools: mockToggleDevTools,
  toolCallLogs: [],
  contextInfo: null,
  modelInfo: null,
};

vi.mock('../../../hooks/useChat', () => ({
  useChat: vi.fn(() => defaultUseChatReturn),
}));

// Mock useTextSelection
vi.mock('../../../hooks/useTextSelection', () => ({
  useTextSelection: vi.fn(() => ({
    clearSelection: vi.fn(),
  })),
}));

// Mock the ChatMessage component
vi.mock('../ChatMessage', () => ({
  ChatMessage: ({ message }: { message: ChatMessage }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

// Mock DevToolsPanel
vi.mock('../devtools', () => ({
  DevToolsPanel: ({ isExpanded }: { isExpanded: boolean }) => (
    isExpanded ? <div data-testid="dev-tools-panel">Dev Tools</div> : null
  ),
}));

// Import useChat after mocking
import { useChat } from '../../../hooks/useChat';

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useChat as ReturnType<typeof vi.fn>).mockReturnValue(defaultUseChatReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('should return null when not expanded', () => {
      const { container } = render(
        <ChatPanel analysisId="test-id" expanded={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when expanded', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });
  });

  describe('waiting state', () => {
    it('should show waiting state when no analysisId', () => {
      render(<ChatPanel analysisId={null} expanded={true} />);
      expect(screen.getByText('Waiting for Analysis')).toBeInTheDocument();
      expect(
        screen.getByText('The AI assistant will be available once an analysis is loaded')
      ).toBeInTheDocument();
    });

    it('should show loader icon when waiting', () => {
      const { container } = render(<ChatPanel analysisId={null} expanded={true} />);
      // Check for Loader2 icon (animate-spin class)
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display AI Assistant title', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('should show Codebase Analysis subtitle in codebase mode', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Codebase Analysis')).toBeInTheDocument();
    });

    it('should show General Assistant subtitle in general mode', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        contextMode: 'general',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('General Assistant')).toBeInTheDocument();
    });

    it('should show Processing... when loading', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should show token count when tokens used', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        tokenUsage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('150 tokens')).toBeInTheDocument();
    });

    it('should show clear button when messages exist and not loading', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        messages: [{ role: 'user', content: 'Hello' }] as ChatMessage[],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTitle('Clear conversation')).toBeInTheDocument();
    });

    it('should call clearConversation when clear button clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        messages: [{ role: 'user', content: 'Hello' }] as ChatMessage[],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByTitle('Clear conversation'));
      expect(mockClearConversation).toHaveBeenCalled();
    });
  });

  describe('context mode toggle', () => {
    it('should render Codebase and General buttons', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Codebase')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('should call setContextMode when Codebase clicked', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByText('Codebase'));
      expect(mockSetContextMode).toHaveBeenCalledWith('codebase');
    });

    it('should call setContextMode when General clicked', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByText('General'));
      expect(mockSetContextMode).toHaveBeenCalledWith('general');
    });

    it('should disable context mode buttons when loading', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const codebaseBtn = screen.getByText('Codebase').closest('button');
      const generalBtn = screen.getByText('General').closest('button');
      expect(codebaseBtn).toBeDisabled();
      expect(generalBtn).toBeDisabled();
    });
  });

  describe('dev tools', () => {
    it('should toggle dev tools panel', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByTitle('Toggle dev tools (Cmd+Shift+D)'));
      expect(mockToggleDevTools).toHaveBeenCalled();
    });

    it('should show dev tools panel when expanded', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        devToolsExpanded: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTestId('dev-tools-panel')).toBeInTheDocument();
    });
  });

  describe('context indicator', () => {
    it('should show highlighted text when present', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        highlightedText: 'selected code',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('selected code')).toBeInTheDocument();
      expect(screen.getByText('Context')).toBeInTheDocument();
    });

    it('should clear highlighted text when X clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        highlightedText: 'selected code',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      // Find the close button within the context indicator
      const contextSection = screen.getByText('Context').closest('div');
      const closeButton = contextSection?.querySelector('button');
      if (closeButton) {
        fireEvent.click(closeButton);
      }
      expect(mockClearHighlightedText).toHaveBeenCalled();
    });

    it('should show current tool name when active', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        currentToolName: 'search_files',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('search_files')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no messages', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Ask About This Codebase')).toBeInTheDocument();
    });

    it('should show general mode empty state', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        contextMode: 'general',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Ask a Programming Question')).toBeInTheDocument();
    });

    it('should display suggested questions in codebase mode', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        suggestedQuestions: [
          { question: 'What does this codebase do?', category: 'architecture' },
        ],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('What does this codebase do?')).toBeInTheDocument();
    });

    it('should display general questions in general mode', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        contextMode: 'general',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(
        screen.getByText('What are common React performance optimization techniques?')
      ).toBeInTheDocument();
    });

    it('should call sendMessage when suggested question clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        suggestedQuestions: [
          { question: 'What does this codebase do?', category: 'architecture' },
        ],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByText('What does this codebase do?'));
      expect(mockSendMessage).toHaveBeenCalledWith('What does this codebase do?');
    });
  });

  describe('messages display', () => {
    it('should render messages when present', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ] as ChatMessage[],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getAllByTestId('chat-message')).toHaveLength(2);
    });

    it('should show loading indicator for empty assistant message', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: '' },
        ] as ChatMessage[],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Processing request...')).toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('should show error when present', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        error: 'Something went wrong',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show retry button when canRetry is true', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        error: 'Something went wrong',
        canRetry: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTitle('Retry')).toBeInTheDocument();
    });

    it('should call retryLastMessage when retry clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        error: 'Something went wrong',
        canRetry: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByTitle('Retry'));
      expect(mockRetryLastMessage).toHaveBeenCalled();
    });

    it('should call clearError when dismiss clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        error: 'Something went wrong',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByTitle('Dismiss'));
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('input area', () => {
    it('should render textarea input', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(
        screen.getByPlaceholderText('Ask about the codebase...')
      ).toBeInTheDocument();
    });

    it('should show general mode placeholder', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        contextMode: 'general',
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(
        screen.getByPlaceholderText('Ask a programming question...')
      ).toBeInTheDocument();
    });

    it('should update input value on change', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: 'test message' } });
      expect(input).toHaveValue('test message');
    });

    it('should disable input when loading', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(
        screen.getByPlaceholderText('Ask about the codebase...')
      ).toBeDisabled();
    });

    it('should call sendMessage on submit', async () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('test message');
      });
    });

    it('should send message on Enter key', async () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('test message');
      });
    });

    it('should not send message on Shift+Enter', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not send empty message', async () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(mockSendMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe('send/stop button', () => {
    it('should show send button when not loading', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTitle('Send message')).toBeInTheDocument();
    });

    it('should show stop button when loading', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTitle('Stop generating')).toBeInTheDocument();
    });

    it('should call cancelStream when stop clicked', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        isLoading: true,
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      fireEvent.click(screen.getByTitle('Stop generating'));
      expect(mockCancelStream).toHaveBeenCalled();
    });

    it('should disable send button when input is empty', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(screen.getByTitle('Send message')).toBeDisabled();
    });

    it('should enable send button when input has value', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      const input = screen.getByPlaceholderText('Ask about the codebase...');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(screen.getByTitle('Send message')).not.toBeDisabled();
    });
  });

  describe('load suggested questions', () => {
    it('should load suggested questions on mount when conditions met', () => {
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(mockLoadSuggestedQuestions).toHaveBeenCalled();
    });

    it('should not load suggested questions when messages exist', () => {
      (useChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultUseChatReturn,
        messages: [{ role: 'user', content: 'Hello' }] as ChatMessage[],
      });
      render(<ChatPanel analysisId="test-id" expanded={true} />);
      expect(mockLoadSuggestedQuestions).not.toHaveBeenCalled();
    });
  });
});
