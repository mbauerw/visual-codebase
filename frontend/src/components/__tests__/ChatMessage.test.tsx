import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { ChatMessage } from '../chat/ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

// Mock sub-components
vi.mock('../chat/ToolResultBlock', () => ({
  ToolResultsList: ({ results }: { results: unknown[] }) => (
    <div data-testid="tool-results">Tool results: {results.length}</div>
  ),
}));

vi.mock('../chat/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

function createMessage(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    role: 'user',
    content: 'Hello world',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('ChatMessage', () => {
  describe('user messages', () => {
    it('should render user message with content', () => {
      render(<ChatMessage message={createMessage({ content: 'Test message' })} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should show "You" label for user messages', () => {
      render(<ChatMessage message={createMessage()} />);
      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('should render user messages as plain text (not markdown)', () => {
      render(<ChatMessage message={createMessage({ content: 'plain text' })} />);
      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
      expect(screen.getByText('plain text')).toBeInTheDocument();
    });
  });

  describe('assistant messages', () => {
    it('should show "Assistant" label', () => {
      render(
        <ChatMessage message={createMessage({ role: 'assistant', content: 'Hi' })} />
      );
      expect(screen.getByText('Assistant')).toBeInTheDocument();
    });

    it('should render assistant messages as markdown', () => {
      render(
        <ChatMessage
          message={createMessage({ role: 'assistant', content: '**bold**' })}
        />
      );
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should display tool results when present', () => {
      const message = createMessage({
        role: 'assistant',
        content: 'Response',
        tool_results: [
          { id: '1', name: 'search', status: 'completed' },
          { id: '2', name: 'read', status: 'completed' },
        ],
      });

      render(<ChatMessage message={message} />);
      expect(screen.getByTestId('tool-results')).toHaveTextContent('Tool results: 2');
    });

    it('should not show tool results for user messages', () => {
      const message = createMessage({
        role: 'user',
        content: 'Test',
        tool_results: [{ id: '1', name: 'search', status: 'completed' }],
      });

      render(<ChatMessage message={message} />);
      expect(screen.queryByTestId('tool-results')).not.toBeInTheDocument();
    });

    it('should not show tool results when showToolResults is false', () => {
      const message = createMessage({
        role: 'assistant',
        content: 'Response',
        tool_results: [{ id: '1', name: 'search', status: 'completed' }],
      });

      render(<ChatMessage message={message} showToolResults={false} />);
      expect(screen.queryByTestId('tool-results')).not.toBeInTheDocument();
    });

    it('should show tools used indicator when no inline results', () => {
      const message = createMessage({
        role: 'assistant',
        content: 'Response',
        tools_used: ['search_files', 'read_file'],
      });

      render(<ChatMessage message={message} />);
      expect(screen.getByText('search_files, read_file')).toBeInTheDocument();
    });

    it('should not show tools used when tool results are present', () => {
      const message = createMessage({
        role: 'assistant',
        content: 'Response',
        tools_used: ['search_files'],
        tool_results: [{ id: '1', name: 'search_files', status: 'completed' }],
      });

      render(<ChatMessage message={message} />);
      // Tool results are shown, so tools_used text should not appear separately
      expect(screen.queryByText('search_files')).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should render widget variant by default', () => {
      const { container } = render(
        <ChatMessage message={createMessage({ role: 'assistant', content: 'Hi' })} />
      );
      // Widget variant has specific color classes
      const avatar = container.querySelector('.bg-\\[\\#fafaf9\\]');
      expect(avatar).toBeInTheDocument();
    });

    it('should render panel variant with dark theme', () => {
      const { container } = render(
        <ChatMessage
          message={createMessage({ role: 'assistant', content: 'Hi' })}
          variant="panel"
        />
      );
      // Panel variant uses slate backgrounds
      const avatar = container.querySelector('.bg-slate-800');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('empty content', () => {
    it('should not render text content div when content is empty', () => {
      const message = createMessage({
        role: 'assistant',
        content: '',
        tools_used: ['search'],
      });

      render(<ChatMessage message={message} />);
      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });
  });
});
