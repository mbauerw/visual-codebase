import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import CustomNode from '../CustomNode';
import type { ReactFlowNodeData } from '../../types';

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

const mockNodeData: ReactFlowNodeData = {
  label: 'App.tsx',
  path: '/src/components/App.tsx',
  folder: '/src/components',
  language: 'typescript',
  role: 'react_component',
  description: 'Main application component',
  category: 'frontend',
  imports: ['./Header', './Footer'],
  size_bytes: 2500,
  line_count: 85,
};

describe('CustomNode', () => {
  const defaultProps = {
    id: 'node-1',
    data: mockNodeData,
    selected: false,
    type: 'custom' as const,
    isConnectable: true,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    dragging: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };

  describe('rendering', () => {
    it('should render node with file name', () => {
      render(<CustomNode {...defaultProps} />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should render source handle at top', () => {
      render(<CustomNode {...defaultProps} />);

      const sourceHandle = screen.getByTestId('handle-source');
      expect(sourceHandle).toHaveAttribute('data-position', 'top');
    });

    it('should render target handle at bottom', () => {
      render(<CustomNode {...defaultProps} />);

      const targetHandle = screen.getByTestId('handle-target');
      expect(targetHandle).toHaveAttribute('data-position', 'bottom');
    });
  });

  describe('role display', () => {
    it('should display React Component role', () => {
      render(<CustomNode {...defaultProps} />);

      expect(screen.getByText('React Component')).toBeInTheDocument();
    });

    it('should display Utility role', () => {
      const utilityData = { ...mockNodeData, role: 'utility' as const };
      render(<CustomNode {...defaultProps} data={utilityData} />);

      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('should display Hook role', () => {
      const hookData = { ...mockNodeData, role: 'hook' as const };
      render(<CustomNode {...defaultProps} data={hookData} />);

      expect(screen.getByText('Hook')).toBeInTheDocument();
    });

    it('should display API Service role', () => {
      const apiData = { ...mockNodeData, role: 'api_service' as const };
      render(<CustomNode {...defaultProps} data={apiData} />);

      expect(screen.getByText('API Service')).toBeInTheDocument();
    });

    it('should display Test role', () => {
      const testData = { ...mockNodeData, role: 'test' as const };
      render(<CustomNode {...defaultProps} data={testData} />);

      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should display Config role', () => {
      const configData = { ...mockNodeData, role: 'config' as const };
      render(<CustomNode {...defaultProps} data={configData} />);

      expect(screen.getByText('Config')).toBeInTheDocument();
    });

    it('should display Model role', () => {
      const modelData = { ...mockNodeData, role: 'model' as const };
      render(<CustomNode {...defaultProps} data={modelData} />);

      expect(screen.getByText('Model')).toBeInTheDocument();
    });

    it('should display Context role', () => {
      const contextData = { ...mockNodeData, role: 'context' as const };
      render(<CustomNode {...defaultProps} data={contextData} />);

      expect(screen.getByText('Context')).toBeInTheDocument();
    });

    it('should display Store role', () => {
      const storeData = { ...mockNodeData, role: 'store' as const };
      render(<CustomNode {...defaultProps} data={storeData} />);

      expect(screen.getByText('Store')).toBeInTheDocument();
    });
  });

  describe('language display', () => {
    it('should display typescript language', () => {
      render(<CustomNode {...defaultProps} />);

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should display javascript language', () => {
      const jsData = { ...mockNodeData, language: 'javascript' as const };
      render(<CustomNode {...defaultProps} data={jsData} />);

      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should display python language', () => {
      const pyData = { ...mockNodeData, language: 'python' as const };
      render(<CustomNode {...defaultProps} data={pyData} />);

      expect(screen.getByText('python')).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('should have selected styles when selected is true', () => {
      render(<CustomNode {...defaultProps} selected={true} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('ring-4');
      expect(nodeElement).toHaveClass('ring-amber-500');
    });

    it('should not have selected styles when selected is false', () => {
      render(<CustomNode {...defaultProps} selected={false} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).not.toHaveClass('ring-4');
    });

    it('should have scale effect when selected', () => {
      render(<CustomNode {...defaultProps} selected={true} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('scale-[1.2]');
    });
  });

  describe('styling', () => {
    it('should have dark background', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#1e293b' });
    });

    it('should have minimum width', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('min-w-[240px]');
    });

    it('should have maximum width', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('max-w-[320px]');
    });

    it('should have rounded corners', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('rounded-lg');
    });
  });

  describe('hover effects', () => {
    it('should have hover scale class', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('hover:scale-[1.2]');
    });

    it('should have transition class', () => {
      render(<CustomNode {...defaultProps} />);

      const nodeElement = screen.getByText('App.tsx').closest('div[class*="relative"]');
      expect(nodeElement).toHaveClass('transition-all');
    });
  });

  describe('truncation', () => {
    it('should truncate long file names', () => {
      const longNameData = {
        ...mockNodeData,
        label: 'VeryLongComponentNameThatShouldBeTruncated.tsx',
      };
      render(<CustomNode {...defaultProps} data={longNameData} />);

      const labelElement = screen.getByText('VeryLongComponentNameThatShouldBeTruncated.tsx');
      expect(labelElement).toHaveClass('truncate');
    });

    it('should have title attribute for tooltip on long names', () => {
      const longNameData = {
        ...mockNodeData,
        label: 'VeryLongComponentNameThatShouldBeTruncated.tsx',
      };
      render(<CustomNode {...defaultProps} data={longNameData} />);

      const labelElement = screen.getByText('VeryLongComponentNameThatShouldBeTruncated.tsx');
      expect(labelElement).toHaveAttribute(
        'title',
        'VeryLongComponentNameThatShouldBeTruncated.tsx'
      );
    });
  });

  describe('unknown role handling', () => {
    it('should handle unknown role gracefully', () => {
      const unknownRoleData = { ...mockNodeData, role: 'unknown' as const };
      render(<CustomNode {...defaultProps} data={unknownRoleData} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('unknown language handling', () => {
    it('should handle unknown language gracefully', () => {
      const unknownLangData = { ...mockNodeData, language: 'unknown' as const };
      render(<CustomNode {...defaultProps} data={unknownLangData} />);

      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });
});
