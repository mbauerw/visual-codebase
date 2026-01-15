import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import NodeDetailPanel from '../NodeDetailPanel';
import type { ReactFlowNodeData } from '../../types';

const mockNodeData: ReactFlowNodeData = {
  label: 'App.tsx',
  path: '/src/components/App.tsx',
  folder: '/src/components',
  language: 'typescript',
  role: 'react_component',
  description: 'Main application component that handles routing and state',
  category: 'frontend',
  imports: ['./Header', './Footer', '../hooks/useAuth', 'react-router-dom'],
  size_bytes: 2500,
  line_count: 85,
};

describe('NodeDetailPanel', () => {
  const defaultProps = {
    data: mockNodeData,
    onClose: vi.fn(),
    setExpand: vi.fn(),
    expanded: true,
  };

  describe('empty state', () => {
    it('should show empty state when data is null', () => {
      render(<NodeDetailPanel {...defaultProps} data={null} />);

      expect(screen.getByText('No File Selected')).toBeInTheDocument();
      expect(screen.getByText(/Click on a file node/i)).toBeInTheDocument();
    });

    it('should not show empty state content when collapsed', () => {
      render(<NodeDetailPanel {...defaultProps} data={null} expanded={false} />);

      expect(screen.queryByText('No File Selected')).not.toBeInTheDocument();
    });
  });

  describe('file information display', () => {
    it('should display file name', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should display file path', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('/src/components/App.tsx')).toBeInTheDocument();
    });

    it('should display description', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(
        screen.getByText('Main application component that handles routing and state')
      ).toBeInTheDocument();
    });

    it('should not display description section when no description', () => {
      const dataWithoutDescription = { ...mockNodeData, description: '' };
      render(<NodeDetailPanel {...defaultProps} data={dataWithoutDescription} />);

      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('badges', () => {
    it('should display role badge', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('React Component')).toBeInTheDocument();
    });

    it('should display language badge', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should display category badge', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('frontend')).toBeInTheDocument();
    });
  });

  describe('stats', () => {
    it('should display line count', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should display file size', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('2.4 KB')).toBeInTheDocument();
    });

    it('should format large line counts with commas', () => {
      const dataWithManyLines = { ...mockNodeData, line_count: 1500 };
      render(<NodeDetailPanel {...defaultProps} data={dataWithManyLines} />);

      expect(screen.getByText('1,500')).toBeInTheDocument();
    });

    it('should display bytes for small files', () => {
      const dataWithSmallFile = { ...mockNodeData, size_bytes: 500 };
      render(<NodeDetailPanel {...defaultProps} data={dataWithSmallFile} />);

      expect(screen.getByText('500 B')).toBeInTheDocument();
    });

    it('should display MB for large files', () => {
      const dataWithLargeFile = { ...mockNodeData, size_bytes: 2 * 1024 * 1024 };
      render(<NodeDetailPanel {...defaultProps} data={dataWithLargeFile} />);

      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });
  });

  describe('imports section', () => {
    it('should display imports header with count', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('Imports')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // import count
    });

    it('should display all imports', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      expect(screen.getByText('./Header')).toBeInTheDocument();
      expect(screen.getByText('./Footer')).toBeInTheDocument();
      expect(screen.getByText('../hooks/useAuth')).toBeInTheDocument();
      expect(screen.getByText('react-router-dom')).toBeInTheDocument();
    });

    it('should not display imports section when no imports', () => {
      const dataWithoutImports = { ...mockNodeData, imports: [] };
      render(<NodeDetailPanel {...defaultProps} data={dataWithoutImports} />);

      expect(screen.queryByText('Imports')).not.toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('should render close button', () => {
      render(<NodeDetailPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<NodeDetailPanel {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('different roles', () => {
    it('should display utility role correctly', () => {
      const utilityData = { ...mockNodeData, role: 'utility' as const };
      render(<NodeDetailPanel {...defaultProps} data={utilityData} />);

      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('should display hook role correctly', () => {
      const hookData = { ...mockNodeData, role: 'hook' as const };
      render(<NodeDetailPanel {...defaultProps} data={hookData} />);

      expect(screen.getByText('Hook')).toBeInTheDocument();
    });

    it('should display api_service role correctly', () => {
      const apiData = { ...mockNodeData, role: 'api_service' as const };
      render(<NodeDetailPanel {...defaultProps} data={apiData} />);

      expect(screen.getByText('API Service')).toBeInTheDocument();
    });

    it('should display test role correctly', () => {
      const testData = { ...mockNodeData, role: 'test' as const };
      render(<NodeDetailPanel {...defaultProps} data={testData} />);

      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('different languages', () => {
    it('should display javascript language', () => {
      const jsData = { ...mockNodeData, language: 'javascript' as const };
      render(<NodeDetailPanel {...defaultProps} data={jsData} />);

      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should display python language', () => {
      const pyData = { ...mockNodeData, language: 'python' as const };
      render(<NodeDetailPanel {...defaultProps} data={pyData} />);

      expect(screen.getByText('python')).toBeInTheDocument();
    });
  });

  describe('different categories', () => {
    it('should display backend category', () => {
      const backendData = { ...mockNodeData, category: 'backend' as const };
      render(<NodeDetailPanel {...defaultProps} data={backendData} />);

      expect(screen.getByText('backend')).toBeInTheDocument();
    });

    it('should display shared category', () => {
      const sharedData = { ...mockNodeData, category: 'shared' as const };
      render(<NodeDetailPanel {...defaultProps} data={sharedData} />);

      expect(screen.getByText('shared')).toBeInTheDocument();
    });
  });
});
