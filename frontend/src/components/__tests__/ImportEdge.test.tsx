import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import ImportEdge from '../ImportEdge';
import type { ReactFlowEdgeData } from '../../types';

// Mock React Flow components
vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ id, path }: { id: string; path: string }) => (
    <g data-testid={`base-edge-${id}`} data-path={path} />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getSmoothStepPath: () => ['M0,0 L100,100', 50, 50],
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

const defaultProps = {
  id: 'edge-1',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: 'bottom' as any,
  targetPosition: 'top' as any,
  source: 'node-1',
  target: 'node-2',
};

describe('ImportEdge', () => {
  it('should render a base edge', () => {
    render(
      <svg>
        <ImportEdge {...defaultProps} />
      </svg>
    );

    expect(screen.getByTestId('base-edge-edge-1')).toBeInTheDocument();
  });

  it('should show import names label for single import', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['useState'],
      module_path: 'react',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('useState')).toBeInTheDocument();
  });

  it('should truncate long single import names', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['veryLongImportNameThatExceeds'],
      module_path: 'some/module',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('veryLongImportN...')).toBeInTheDocument();
  });

  it('should show both names for two imports', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['useState', 'useEffect'],
      module_path: 'react',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('useState, useEffect')).toBeInTheDocument();
  });

  it('should show first import and count for 3+ imports', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['useState', 'useEffect', 'useCallback'],
      module_path: 'react',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('useState, +2')).toBeInTheDocument();
  });

  it('should show module_path when no import names', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: [],
      module_path: './utils/helper',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('./utils/helper')).toBeInTheDocument();
  });

  it('should show cross-language indicator', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['parse'],
      module_path: 'parser',
      is_cross_language: true,
      source_language: 'typescript',
      target_language: 'python',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.getByText('TS → Py')).toBeInTheDocument();
  });

  it('should not show cross-language indicator for same-language edges', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['helper'],
      module_path: './helper',
      is_cross_language: false,
      source_language: 'typescript',
      target_language: 'typescript',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('should have title with all import names for tooltip', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['a', 'b', 'c'],
      module_path: 'module',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} />
      </svg>
    );

    const label = screen.getByText('a, +2');
    expect(label).toHaveAttribute('title', 'a, b, c');
  });

  it('should render nothing when no data', () => {
    render(
      <svg>
        <ImportEdge {...defaultProps} />
      </svg>
    );

    expect(screen.queryByTestId('edge-label-renderer')).not.toBeInTheDocument();
  });

  it('should apply selected styling when selected', () => {
    const data: Partial<ReactFlowEdgeData> = {
      imported_names: ['Component'],
      module_path: './Component',
    };

    render(
      <svg>
        <ImportEdge {...defaultProps} data={data} selected={true} />
      </svg>
    );

    const label = screen.getByText('Component');
    // The class attribute contains the conditional selected classes as raw template string
    const classAttr = label.getAttribute('class') || '';
    expect(classAttr).toContain('ring-2 ring-blue-400');
  });
});
