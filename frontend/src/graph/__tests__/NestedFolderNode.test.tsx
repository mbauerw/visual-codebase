import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NestedFolderNode } from '../renderers/nested/NestedFolderNode';
import type { GraphNode, LodLevel, NodeHighlight } from '../core/types';
import { nestedTheme, getDepthColor, getDepthBorderColor, type NestedFolderNodeData } from '../theme/nestedTheme';
import { resolveNodeTheme } from '../theme/resolve';

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

const folderNode = (over: Partial<NestedFolderNodeData> = {}): GraphNode<NestedFolderNodeData> => ({
  id: 'folder-src/components',
  kind: 'folder',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  depth: 2,
  parentId: 'folder-src',
  interactive: true,
  data: { label: 'components', path: 'src/components', depth: 2, fileCount: 7, category: 'frontend', ...over },
});

function renderNode(node: GraphNode<NestedFolderNodeData>, highlight: NodeHighlight = 'none', lod: LodLevel = 'near') {
  const theme = resolveNodeTheme(nestedTheme, node);
  return render(<NestedFolderNode node={node} highlight={highlight} lod={lod} theme={theme} />);
}

describe('NestedFolderNode', () => {
  it('renders the folder label, path title and file count', () => {
    renderNode(folderNode());
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByTitle('src/components')).toBeInTheDocument();
    expect(screen.getByTestId('nested-folder-count')).toHaveTextContent('7');
  });

  it('fills the slot and paints the depth colours', () => {
    renderNode(folderNode());
    const root = screen.getByTestId('nested-folder-node');
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('h-full');
    expect(root.style.backgroundColor).toBe(hexToRgb(getDepthColor(2)));
    expect(root.style.border).toContain('2px solid');
    expect(root.style.border).toContain(hexToRgb(getDepthBorderColor(2)));
    expect(root.style.borderRadius).toBe('16px');
  });

  it('uses darker colours for deeper folders', () => {
    const { unmount } = renderNode(folderNode({ depth: 1 }));
    const shallow = screen.getByTestId('nested-folder-node').style.backgroundColor;
    unmount();
    renderNode(folderNode({ depth: 5 }));
    const deep = screen.getByTestId('nested-folder-node').style.backgroundColor;
    expect(shallow).toBe(hexToRgb(getDepthColor(1)));
    expect(deep).toBe(hexToRgb(getDepthColor(5)));
    expect(shallow).not.toBe(deep);
    // count pill flips to light text on dark backgrounds
    expect(screen.getByTestId('nested-folder-count').style.color).toBe(hexToRgb('#fffbeb'));
  });

  it('applies the container-selected ring class and none otherwise', () => {
    const { unmount } = renderNode(folderNode(), 'container-selected');
    expect(screen.getByTestId('nested-folder-node').className).toContain('ring-amber-800');
    unmount();
    renderNode(folderNode(), 'none');
    expect(screen.getByTestId('nested-folder-node').className).not.toMatch(/ring-\d/);
  });

  it('renders no React Flow handles', () => {
    const { container } = renderNode(folderNode());
    expect(container.querySelector('.react-flow__handle')).toBeNull();
  });

  it('hides the count pill when the file count is 0', () => {
    renderNode(folderNode({ fileCount: 0 }));
    expect(screen.queryByTestId('nested-folder-count')).toBeNull();
  });

  it('LOD far hides the count pill but keeps the label', () => {
    renderNode(folderNode(), 'none', 'far');
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.queryByTestId('nested-folder-count')).toBeNull();
  });
});
