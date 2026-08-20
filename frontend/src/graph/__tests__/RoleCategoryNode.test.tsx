import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RoleCategoryNode } from '../renderers/role/RoleCategoryNode';
import type { GraphNode, LodLevel } from '../core/types';
import { roleTheme, type RoleCategoryNodeData } from '../theme/roleTheme';
import { resolveNodeTheme } from '../theme/resolve';

const categoryNode = (over: Partial<RoleCategoryNodeData> = {}): GraphNode<RoleCategoryNodeData> => ({
  id: 'category-react_component',
  kind: 'category',
  x: 0,
  y: 0,
  width: 800,
  height: 400,
  depth: 0,
  interactive: false,
  data: { label: 'React Component', role: 'react_component', category: 'frontend', nodeCount: 12, ...over },
});

function renderNode(node: GraphNode<RoleCategoryNodeData>, lod: LodLevel = 'near') {
  const theme = resolveNodeTheme(roleTheme, node);
  return render(<RoleCategoryNode node={node} highlight="none" lod={lod} theme={theme} />);
}

describe('RoleCategoryNode', () => {
  it('renders the label and node count', () => {
    renderNode(categoryNode());
    expect(screen.getByText('React Component')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('header pill re-enables pointer events while the body stays non-interactive', () => {
    renderNode(categoryNode());
    const pill = screen.getByTestId('role-category-pill');
    expect(pill.style.pointerEvents).toBe('auto');
    expect(pill.className).toContain('cursor-pointer');
    expect(screen.getByTestId('role-category-node').className).toContain('pointer-events-none');
  });

  it('paints the role colour on the container', () => {
    renderNode(categoryNode());
    const root = screen.getByTestId('role-category-node');
    expect(root.style.border).toContain('3px solid');
    expect(root.style.border).toMatch(/#61dafb|rgb\(97, 218, 251\)/);
    expect(root.style.borderRadius).toBe('24px');
  });

  it('honours theme radius / surface / border tokens', () => {
    renderNode({
      ...categoryNode(),
      themeOverride: { radius: 4, surface: '#112233', border: '#445566' },
    });
    const root = screen.getByTestId('role-category-node');
    expect(root.style.borderRadius).toBe('4px');
    expect(root.style.backgroundColor).toBe('rgb(17, 34, 51)');
    expect(root.style.border).toContain('rgb(68, 85, 102)');
  });

  it('uses the smaller font for the API Service label', () => {
    renderNode(categoryNode({ label: 'API Service', role: 'api_service' }));
    expect(screen.getByText('API Service').className).toContain('text-[65px]');
    cleanup();
    renderNode(categoryNode());
    expect(screen.getByText('React Component').className).not.toContain('text-[65px]');
  });

  it('renders the role icon at near/mid LOD and drops it at far LOD', () => {
    const { unmount } = renderNode(categoryNode(), 'near');
    expect(screen.getByTestId('role-category-pill').querySelector('svg')).not.toBeNull();
    unmount();
    renderNode(categoryNode(), 'far');
    expect(screen.getByTestId('role-category-pill').querySelector('svg')).toBeNull();
    // far = label + count only
    expect(screen.getByText('React Component')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('role-category-node')).toHaveAttribute('data-lod', 'far');
  });
});
