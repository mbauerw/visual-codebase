import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleSectionNode } from '../renderers/role/RoleSectionNode';
import type { GraphNode } from '../core/types';
import { roleTheme, type RoleSectionNodeData } from '../theme/roleTheme';
import { resolveNodeTheme } from '../theme/resolve';

const sectionNode = (over: Partial<RoleSectionNodeData> = {}): GraphNode<RoleSectionNodeData> => ({
  id: 'section-frontend',
  kind: 'section',
  x: 0,
  y: 0,
  width: 2000,
  height: 2000,
  depth: 0,
  interactive: false,
  data: { label: 'Frontend', category: 'frontend', color: '#61dafb', ...over },
});

describe('RoleSectionNode', () => {
  it('renders the section label', () => {
    const node = sectionNode();
    render(<RoleSectionNode node={node} highlight="none" lod="far" theme={resolveNodeTheme(roleTheme, node)} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Frontend').className).toContain('text-[80px]');
  });

  it('is non-interactive and draws a dashed ellipse in the section colour', () => {
    const node = sectionNode({ label: 'Backend', category: 'backend', color: '#10b981' });
    const { container } = render(
      <RoleSectionNode node={node} highlight="none" lod="far" theme={resolveNodeTheme(roleTheme, node)} />
    );
    expect(screen.getByTestId('role-section-node').className).toContain('pointer-events-none');
    const ellipse = container.querySelector('.rounded-\\[50\\%\\]') as HTMLElement;
    expect(ellipse).not.toBeNull();
    expect(ellipse.style.border).toContain('dashed');
    expect(ellipse.style.border).toMatch(/#10b981|rgba?\(16, 185, 129/);
  });
});
