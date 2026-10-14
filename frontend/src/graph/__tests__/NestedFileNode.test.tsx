import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NestedFileNode, getCompactRoleLabel, getLanguageAbbreviation } from '../renderers/nested/NestedFileNode';
import type { GraphNode, LodLevel, NodeHighlight } from '../core/types';
import { nestedTheme } from '../theme/nestedTheme';
import { resolveNodeTheme } from '../theme/resolve';
import type { ReactFlowNodeData } from '../../types';

const fileData = (over: Partial<ReactFlowNodeData> = {}): ReactFlowNodeData => ({
  label: 'Button.tsx',
  path: 'src/components/Button.tsx',
  folder: 'src/components',
  language: 'typescript',
  role: 'react_component',
  description: 'A button',
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
  width: 150,
  height: 60,
  depth: 2,
  parentId: 'folder-src/components',
  data: fileData(),
  ...over,
});

function renderNode(node: GraphNode<ReactFlowNodeData>, highlight: NodeHighlight = 'none', lod: LodLevel = 'near') {
  const theme = resolveNodeTheme(nestedTheme, node);
  return render(<NestedFileNode node={node} highlight={highlight} lod={lod} theme={theme} />);
}

describe('NestedFileNode', () => {
  it('renders the file name, language abbreviation and compact role label', () => {
    renderNode(fileNode());
    expect(screen.getByTitle('Button.tsx')).toHaveTextContent('Button.tsx');
    expect(screen.getByText('TS')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByTestId('nested-file-node')).toBeInTheDocument();
  });

  it('renders no React Flow handles', () => {
    const { container } = renderNode(fileNode());
    expect(container.querySelector('.react-flow__handle')).toBeNull();
    expect(container.querySelector('[data-handleid]')).toBeNull();
  });

  it('fills the slot and paints a white card with the language-coloured left border', () => {
    renderNode(fileNode());
    const root = screen.getByTestId('nested-file-node');
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('h-full');
    const card = root.firstElementChild as HTMLElement;
    expect(card.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(card.style.borderLeft).toContain('4px solid');
    expect(card.style.transformOrigin).toBe('center center');
    expect(card.title).toContain('src/components/Button.tsx');
  });

  it.each([
    ['selected', 'ring-amber-600'],
    ['tierlist', 'ring-blue-500'],
    ['connected', 'ring-amber-500'],
    ['edge-endpoint', 'ring-blue-400'],
  ] as const)('applies the %s ring class', (highlight, cls) => {
    renderNode(fileNode(), highlight);
    expect(screen.getByTestId('nested-file-node').className).toContain(cls);
  });

  it('applies no ring class when not highlighted', () => {
    renderNode(fileNode(), 'none');
    expect(screen.getByTestId('nested-file-node').className).not.toMatch(/ring-\d/);
  });

  it('LOD far hides the metadata row but keeps the file name', () => {
    renderNode(fileNode(), 'none', 'far');
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.queryByTestId('nested-file-node-meta')).toBeNull();
    expect(screen.queryByText('TS')).toBeNull();
  });

  it('LOD mid keeps the metadata row', () => {
    renderNode(fileNode(), 'none', 'mid');
    expect(screen.getByTestId('nested-file-node-meta')).toBeInTheDocument();
  });

  it('getCompactRoleLabel strips language prefixes and title-cases', () => {
    expect(getCompactRoleLabel('react_component')).toBe('Component');
    expect(getCompactRoleLabel('api_service')).toBe('Api Service');
    expect(getCompactRoleLabel('go_handler')).toBe('Handler');
    expect(getCompactRoleLabel('utility')).toBe('Utility');
  });

  it('getLanguageAbbreviation maps known languages and falls back to two letters', () => {
    expect(getLanguageAbbreviation('typescript')).toBe('TS');
    expect(getLanguageAbbreviation('python')).toBe('PY');
    expect(getLanguageAbbreviation('csharp')).toBe('C#');
    expect(getLanguageAbbreviation('unknown')).toBe('?');
    expect(getLanguageAbbreviation('kotlin')).toBe('KO');
  });
});
