import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-syntax-highlighter BEFORE importing component
vi.mock('react-syntax-highlighter', () => ({
  PrismLight: Object.assign(
    ({ children, language }: { children: string; language: string }) => (
      <pre data-testid="syntax-highlighter" data-language={language}>
        {children}
      </pre>
    ),
    { registerLanguage: vi.fn() }
  ),
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/typescript', () => ({
  default: {},
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/javascript', () => ({
  default: {},
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/python', () => ({
  default: {},
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/jsx', () => ({
  default: {},
}));
vi.mock('react-syntax-highlighter/dist/esm/languages/prism/tsx', () => ({
  default: {},
}));

import SourceCodePanel from '../SourceCodePanel';

const mockSourceCode = `import React from 'react';

const App = () => {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
};

export default App;`;

describe('SourceCodePanel', () => {
  const defaultProps = {
    sourceCode: mockSourceCode,
    fileName: 'App.tsx',
    language: 'typescript' as const,
    lineCount: 12,
    isLoading: false,
    error: null,
    isOpen: true,
    onClose: vi.fn(),
  };

  let mockWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock for each test
    mockWriteText = vi.fn().mockResolvedValue(undefined);

    // Mock clipboard API using defineProperty since navigator.clipboard is read-only
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('visibility', () => {
    it('should render when isOpen is true', () => {
      render(<SourceCodePanel {...defaultProps} />);
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<SourceCodePanel {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display file name', () => {
      render(<SourceCodePanel {...defaultProps} />);
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should display language', () => {
      render(<SourceCodePanel {...defaultProps} />);
      // Language text is lowercase in DOM but displayed uppercase via CSS
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should display line count', () => {
      render(<SourceCodePanel {...defaultProps} />);
      expect(screen.getByText('12 lines')).toBeInTheDocument();
    });
  });

  describe('code display', () => {
    it('should render syntax highlighter with code', () => {
      render(<SourceCodePanel {...defaultProps} />);
      const highlighter = screen.getByTestId('syntax-highlighter');
      expect(highlighter).toBeInTheDocument();
      expect(highlighter).toHaveTextContent("import React from 'react'");
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<SourceCodePanel {...defaultProps} isLoading={true} sourceCode={null} />);
      expect(screen.getByText('Loading source code...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when error is provided', () => {
      render(<SourceCodePanel {...defaultProps} error="Failed to load source code" />);
      expect(screen.getByText('Failed to load source code')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no source code', () => {
      render(<SourceCodePanel {...defaultProps} sourceCode={null} />);
      expect(screen.getByText('No source code available')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should copy code to clipboard when copy button is clicked', async () => {
      render(<SourceCodePanel {...defaultProps} />);
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);
      // Wait for async clipboard operation
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWriteText).toHaveBeenCalledWith(mockSourceCode);
    });

    it('should disable copy button when loading', () => {
      render(<SourceCodePanel {...defaultProps} isLoading={true} />);
      const copyButton = screen.getByTitle('Copy to clipboard');
      expect(copyButton).toBeDisabled();
    });

    it('should disable copy button when no source code', () => {
      render(<SourceCodePanel {...defaultProps} sourceCode={null} />);
      const copyButton = screen.getByTitle('Copy to clipboard');
      expect(copyButton).toBeDisabled();
    });
  });

  describe('collapse functionality', () => {
    it('should collapse panel when collapse button is clicked', async () => {
      const user = userEvent.setup();
      render(<SourceCodePanel {...defaultProps} />);
      const collapseButton = screen.getByTitle('Collapse panel');
      await user.click(collapseButton);
      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<SourceCodePanel {...defaultProps} onClose={onClose} />);
      const closeButton = screen.getByTitle('Close (Esc)');
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<SourceCodePanel {...defaultProps} onClose={onClose} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('different languages', () => {
    it('should handle javascript', () => {
      render(<SourceCodePanel {...defaultProps} language="javascript" />);
      // Language text is lowercase in DOM but displayed uppercase via CSS
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should handle python', () => {
      render(<SourceCodePanel {...defaultProps} language="python" />);
      // Language text is lowercase in DOM but displayed uppercase via CSS
      expect(screen.getByText('python')).toBeInTheDocument();
    });
  });
});
