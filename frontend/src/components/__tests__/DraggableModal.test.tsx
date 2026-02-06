import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { DraggableModal } from '../DraggableModal';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

describe('DraggableModal', () => {
  const defaultProps = {
    title: 'Test Modal',
    isOpen: true,
    onClose: vi.fn(),
    children: <div data-testid="modal-content">Modal Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('should render when isOpen is true', () => {
      render(<DraggableModal {...defaultProps} />);
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
    });

    it('should be hidden when isOpen is false', () => {
      render(<DraggableModal {...defaultProps} isOpen={false} />);
      // The modal is still in DOM but display: none
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ display: 'none' });
    });

    it('should show children content', () => {
      render(<DraggableModal {...defaultProps} />);
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display the title', () => {
      render(<DraggableModal {...defaultProps} />);
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('should have close button', () => {
      render(<DraggableModal {...defaultProps} />);
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<DraggableModal {...defaultProps} onClose={onClose} />);
      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });

    it('should have grab cursor class on header', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');
      expect(header).toBeInTheDocument();
    });
  });

  describe('default size', () => {
    it('should use default width when not specified', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ width: '420px' });
    });

    it('should use default height when not specified', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ height: '600px' });
    });

    it('should use custom width when specified', () => {
      render(<DraggableModal {...defaultProps} width={500} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ width: '500px' });
    });

    it('should use custom height when specified', () => {
      render(<DraggableModal {...defaultProps} height={700} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ height: '700px' });
    });
  });

  describe('localStorage persistence', () => {
    it('should save size to localStorage on resize', () => {
      render(<DraggableModal {...defaultProps} />);

      // Get the corner resize handle
      const cornerHandle = document.querySelector('[class*="cursor-nesw-resize"]');
      expect(cornerHandle).toBeInTheDocument();

      // Simulate resize start
      fireEvent.mouseDown(cornerHandle!, { clientX: 100, clientY: 600 });

      // Simulate resize move
      fireEvent.mouseMove(document, { clientX: 50, clientY: 700 });

      // Simulate resize end
      fireEvent.mouseUp(document);

      // Check localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should load saved size from localStorage', () => {
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({ width: 500, height: 700 })
      );

      render(<DraggableModal {...defaultProps} />);

      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ width: '500px', height: '700px' });
    });

    it('should clamp loaded size to min/max bounds', () => {
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({ width: 100, height: 100 })
      );

      render(<DraggableModal {...defaultProps} />);

      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      // MIN_WIDTH is 320, MIN_HEIGHT is 400
      expect(modal).toHaveStyle({ width: '320px', height: '400px' });
    });

    it('should use defaults when localStorage parse fails', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');

      render(<DraggableModal {...defaultProps} />);

      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ width: '420px', height: '600px' });
    });
  });

  describe('resize handles', () => {
    it('should have left and right resize handles', () => {
      render(<DraggableModal {...defaultProps} />);
      const ewHandles = document.querySelectorAll('[class*="cursor-ew-resize"]');
      expect(ewHandles.length).toBe(2); // left and right
    });

    it('should have top and bottom resize handles', () => {
      render(<DraggableModal {...defaultProps} />);
      const nsHandles = document.querySelectorAll('[class*="cursor-ns-resize"]');
      expect(nsHandles.length).toBe(2); // top and bottom
    });

    it('should have corner resize handles', () => {
      render(<DraggableModal {...defaultProps} />);
      // All four corners should have resize handles
      const nwseHandles = document.querySelectorAll('[class*="cursor-nwse-resize"]');
      const neswHandles = document.querySelectorAll('[class*="cursor-nesw-resize"]');
      expect(nwseHandles.length).toBe(2); // top-left, bottom-right
      expect(neswHandles.length).toBe(2); // top-right, bottom-left
    });

    it('should reset size on corner handle double-click', () => {
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({ width: 600, height: 800 })
      );

      render(<DraggableModal {...defaultProps} width={420} height={600} />);

      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveStyle({ width: '600px', height: '800px' });

      // Use bottom-right corner (cursor-nwse-resize, last one in DOM)
      const cornerHandles = document.querySelectorAll('[class*="cursor-nwse-resize"]');
      const bottomRightHandle = cornerHandles[cornerHandles.length - 1];
      fireEvent.doubleClick(bottomRightHandle!);

      // Should reset to default size
      expect(modal).toHaveStyle({ width: '420px', height: '600px' });
    });
  });

  describe('dragging', () => {
    it('should start dragging on header mousedown', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');

      fireEvent.mouseDown(header!, { clientX: 100, clientY: 50 });

      // User select should be disabled during drag
      expect(document.body.style.userSelect).toBe('none');

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('should update position on mouse move during drag', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');

      // Get initial position
      const initialLeft = modal!.style.left;

      // Start drag
      fireEvent.mouseDown(header!, { clientX: 100, clientY: 50 });

      // Move mouse
      fireEvent.mouseMove(document, { clientX: 200, clientY: 100 });

      // Position should have changed
      expect(modal!.style.left).not.toBe(initialLeft);

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('should stop dragging on mouseup', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');

      fireEvent.mouseDown(header!, { clientX: 100, clientY: 50 });
      fireEvent.mouseUp(document);

      // User select should be restored
      expect(document.body.style.userSelect).toBe('');
    });

    it('should prevent close button from triggering drag', () => {
      const onClose = vi.fn();
      render(<DraggableModal {...defaultProps} onClose={onClose} />);
      const closeButton = screen.getByRole('button');

      // MouseDown on close button should not start drag
      fireEvent.mouseDown(closeButton);
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('position constraints', () => {
    it('should not allow position below 0 on X axis', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');

      // Start drag
      fireEvent.mouseDown(header!, { clientX: 100, clientY: 50 });

      // Try to move far left (negative position)
      fireEvent.mouseMove(document, { clientX: -500, clientY: 50 });

      // Should be clamped to 0
      const left = parseInt(modal!.style.left);
      expect(left).toBeGreaterThanOrEqual(0);

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('should not allow position below 0 on Y axis', () => {
      render(<DraggableModal {...defaultProps} />);
      const header = screen.getByText('Test Modal').closest('div[class*="cursor-grab"]');
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');

      // Start drag
      fireEvent.mouseDown(header!, { clientX: 100, clientY: 50 });

      // Try to move far up (negative position)
      fireEvent.mouseMove(document, { clientX: 100, clientY: -500 });

      // Should be clamped to 0
      const top = parseInt(modal!.style.top);
      expect(top).toBeGreaterThanOrEqual(0);

      // Clean up
      fireEvent.mouseUp(document);
    });
  });

  describe('resize overlay', () => {
    it('should show resize overlay during resize', () => {
      render(<DraggableModal {...defaultProps} />);
      const cornerHandle = document.querySelector('[class*="cursor-nesw-resize"]');

      // Start resize
      fireEvent.mouseDown(cornerHandle!, { clientX: 100, clientY: 600 });

      // Should show border highlight
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveClass('border-2');
      expect(modal).toHaveClass('border-amber-500/50');

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('should show dimension indicator during resize', () => {
      render(<DraggableModal {...defaultProps} />);
      const cornerHandle = document.querySelector('[class*="cursor-nesw-resize"]');

      // Start resize
      fireEvent.mouseDown(cornerHandle!, { clientX: 100, clientY: 600 });

      // Should show dimension indicator
      expect(screen.getByText(/\d+ × \d+/)).toBeInTheDocument();

      // Clean up
      fireEvent.mouseUp(document);
    });
  });

  describe('styling', () => {
    it('should have fixed positioning', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveClass('fixed');
    });

    it('should have rounded corners', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveClass('rounded-xl');
    });

    it('should have shadow', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveClass('shadow-2xl');
    });

    it('should have appropriate z-index', () => {
      render(<DraggableModal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('div[class*="fixed"]');
      expect(modal).toHaveClass('z-40');
    });
  });

  describe('content area', () => {
    it('should have overflow hidden', () => {
      render(<DraggableModal {...defaultProps} />);
      const contentArea = screen.getByTestId('modal-content').parentElement;
      expect(contentArea).toHaveClass('overflow-hidden');
    });

    it('should expand to fill available space', () => {
      render(<DraggableModal {...defaultProps} />);
      const contentArea = screen.getByTestId('modal-content').parentElement;
      expect(contentArea).toHaveClass('flex-1');
    });
  });
});
