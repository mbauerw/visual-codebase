import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleFileNode, getRoleFileVisualScale } from '../renderers/role/RoleFileNode';
import type { GraphNode, LodLevel, NodeHighlight } from '../core/types';
import { roleTheme } from '../theme/roleTheme';
import { resolveNodeTheme } from '../theme/resolve';
import type { ReactFlowNodeData } from '../../types';

const fileData = (over: Partial<ReactFlowNodeData> = {}): ReactFlowNodeData => ({
  label: 'Button.tsx',
  path: 'src/components/Button.tsx',
  folder: 'src/components',
  language: 'typescript',
  role: 'react_component',
  description: '',
  category: 'frontend',
  imports: [],
  size_bytes: 10,
  line_count: 1,
  ...over,
});

const fileNode = (over: Partial<GraphNode<ReactFlowNodeData>> = {}): GraphNode<ReactFlowNodeData> => ({
  id: 'n1',
  kind: 'file',
  x: 0,
  y: 0,
  width: 240,
  height: 100,
  depth: 1,
  data: fileData(),
  ...over,
});

function renderNode(node: GraphNode<ReactFlowNodeData>, highlight: NodeHighlight = 'none', lod: LodLevel = 'near') {
  const theme = resolveNodeTheme(roleTheme, node);
  return render(<RoleFileNode node={node} highlight={highlight} lod={lod} theme={theme} />);
}

describe('RoleFileNode', () => {
  it('renders the label with the role and language pills', () => {
    renderNode(fileNode());
    expect(screen.getByTitle('Button.tsx')).toHaveTextContent('Button.tsx');
    expect(screen.getByText('React Component')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByTestId('role-file-node')).toBeInTheDocument();
  });

  it('renders no React Flow handles', () => {
    const { container } = renderNode(fileNode());
    expect(container.querySelector('.react-flow__handle')).toBeNull();
    expect(container.querySelector('[data-handleid]')).toBeNull();
  });

  it('applies the theme surface, radius, text and left border on the surface element', () => {
    renderNode(fileNode());
    const root = screen.getByTestId('role-file-node');
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('h-full');
    const surface = screen.getByTestId('role-file-node-surface');
    expect(surface.style.backgroundColor).toBe('rgb(30, 41, 59)');
    expect(surface.style.borderLeft).toContain('4px solid');
    expect(surface.style.borderRadius).toBe('8px');
    expect(surface.style.color).toBe('rgb(255, 255, 255)');
    expect(surface.className).toContain('w-full');
    expect(surface.className).toContain('h-full');
    // ring/brightness changes ease in
    expect(surface.className).toContain('transition-[box-shadow,filter]');
  });

  it('honours theme tokens (surface / border / text / radius) when overridden', () => {
    const node = fileNode({
      themeOverride: { surface: '#123456', border: '#abcdef', text: '#00ff00', radius: '50%' },
    });
    renderNode(node);
    const surface = screen.getByTestId('role-file-node-surface');
    expect(surface.style.backgroundColor).toBe('rgb(18, 52, 86)');
    expect(surface.style.borderLeft).toContain('rgb(171, 205, 239)');
    expect(surface.style.color).toBe('rgb(0, 255, 0)');
    expect(surface.style.borderRadius).toBe('50%');
  });

  it.each([
    ['selected', 'ring-amber-500'],
    ['tierlist', 'ring-blue-500'],
    ['connected', 'ring-blue-400/70'],
  ] as const)('applies the %s ring class', (highlight, cls) => {
    renderNode(fileNode(), highlight);
    expect(screen.getByTestId('role-file-node-surface').className).toContain(cls);
  });

  it('applies no ring class when not highlighted', () => {
    renderNode(fileNode(), 'none');
    expect(screen.getByTestId('role-file-node-surface').className).not.toMatch(/ring-\d/);
  });

  describe('level of detail', () => {
    it('far: the tile only — no text, no icon, no pills, zero children; role-coloured bar', () => {
      renderNode(fileNode(), 'none', 'far');
      const surface = screen.getByTestId('role-file-node-surface');
      expect(surface.childElementCount).toBe(0);
      expect(surface.textContent).toBe('');
      expect(screen.queryByText('Button.tsx')).toBeNull();
      expect(screen.queryByText('React Component')).toBeNull();
      expect(screen.queryByText('typescript')).toBeNull();
      expect(surface.querySelector('svg')).toBeNull();
      expect(screen.queryByTestId('role-file-node-pills')).toBeNull();
      // the accent bar takes the ROLE colour (roleColors.react_component = #61dafb)
      expect(surface.style.borderLeft).toContain('rgb(97, 218, 251)');
      expect(screen.getByTestId('role-file-node')).toHaveAttribute('data-lod', 'far');
    });

    it('mid: icon + label, but no pills', () => {
      renderNode(fileNode(), 'none', 'mid');
      const surface = screen.getByTestId('role-file-node-surface');
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      expect(surface.querySelector('svg')).not.toBeNull();
      expect(screen.queryByTestId('role-file-node-pills')).toBeNull();
      expect(screen.queryByText('React Component')).toBeNull();
      expect(screen.queryByText('typescript')).toBeNull();
      // back to the neutral accent
      expect(surface.style.borderLeft).toContain('4px solid');
    });

    it('near: icon + label + role/language pills', () => {
      renderNode(fileNode(), 'none', 'near');
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      expect(screen.getByTestId('role-file-node-surface').querySelector('svg')).not.toBeNull();
      const pills = screen.getByTestId('role-file-node-pills');
      expect(pills).toHaveTextContent('React Component');
      expect(pills).toHaveTextContent('typescript');
    });

    it('re-rendering near → mid → far strips the DOM progressively', () => {
      const node = fileNode();
      const theme = resolveNodeTheme(roleTheme, node);
      const { rerender } = render(<RoleFileNode node={node} highlight="none" lod="near" theme={theme} />);
      expect(screen.getByTestId('role-file-node-pills')).toBeInTheDocument();
      rerender(<RoleFileNode node={node} highlight="none" lod="mid" theme={theme} />);
      // AnimatePresence keeps the exiting pill row mounted until its exit animation
      // finishes; the label row is still there
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      rerender(<RoleFileNode node={node} highlight="none" lod="far" theme={theme} />);
      expect(screen.queryByText('Button.tsx')).toBeNull();
      expect(screen.getByTestId('role-file-node')).toHaveAttribute('data-lod', 'far');
    });
  });

  it('getRoleFileVisualScale reproduces CustomNode.getScale', () => {
    expect(getRoleFileVisualScale(1, 'none')).toBe(1);
    expect(getRoleFileVisualScale(1.5, 'connected')).toBe(1.5);
    expect(getRoleFileVisualScale(1, 'selected')).toBe(1.2);
    expect(getRoleFileVisualScale(1.25, 'selected')).toBeCloseTo(1.375);
    expect(getRoleFileVisualScale(1.5, 'tierlist')).toBeCloseTo(1.65);
  });

  it('scales about the slot centre', () => {
    renderNode(fileNode({ scale: 1.5 }));
    expect(screen.getByTestId('role-file-node').style.transformOrigin).toBe('center center');
  });
});
