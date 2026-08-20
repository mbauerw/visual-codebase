import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportEdgeLabel, formatImportLabel } from '../renderers/ImportEdgeLabel';
import type { GraphEdge } from '../core/types';
import type { ReactFlowEdgeData } from '../../types';

const data = (over: Partial<ReactFlowEdgeData> = {}): ReactFlowEdgeData => ({
  imported_names: [],
  module_path: null,
  import_type: 'import',
  ...over,
});

const edge = (d?: ReactFlowEdgeData): GraphEdge => ({ id: 'e', source: 'a', target: 'b', data: d });

describe('formatImportLabel', () => {
  it('returns a single short name as-is', () => {
    expect(formatImportLabel(data({ imported_names: ['useState'] }))).toBe('useState');
    expect(formatImportLabel(data({ imported_names: ['a'.repeat(18)] }))).toBe('a'.repeat(18));
  });

  it('truncates a single long name to 15 chars + ellipsis', () => {
    expect(formatImportLabel(data({ imported_names: ['aVeryLongImportedSymbolName'] }))).toBe('aVeryLongImport...');
  });

  it('joins two names', () => {
    expect(formatImportLabel(data({ imported_names: ['a', 'b'] }))).toBe('a, b');
  });

  it('collapses three or more names to first, +N', () => {
    expect(formatImportLabel(data({ imported_names: ['a', 'b', 'c'] }))).toBe('a, +2');
    expect(formatImportLabel(data({ imported_names: ['x', 'b', 'c', 'd', 'e'] }))).toBe('x, +4');
  });

  it('falls back to module_path (truncated at 15) when there are no names', () => {
    expect(formatImportLabel(data({ module_path: './utils' }))).toBe('./utils');
    expect(formatImportLabel(data({ module_path: '../../components/Button' }))).toBe('../../compon...');
  });

  it('returns empty string with no data', () => {
    expect(formatImportLabel(undefined)).toBe('');
    expect(formatImportLabel(data())).toBe('');
  });
});

describe('ImportEdgeLabel', () => {
  it('renders the pill with the label and slate default classes', () => {
    render(<ImportEdgeLabel edge={edge(data({ imported_names: ['foo', 'bar'] }))} highlight="none" />);
    const pill = screen.getByTestId('edge-label-pill');
    expect(pill).toHaveTextContent('foo, bar');
    expect(pill.className).toContain('bg-slate-800/90');
    expect(pill.className).toContain('border-slate-600');
    expect(pill.className).not.toContain('ring-2');
    expect(screen.queryByTestId('edge-label-cross-language')).toBeNull();
  });

  it('renders the cross-language badge and amber pill', () => {
    render(
      <ImportEdgeLabel
        edge={edge(data({ imported_names: ['handler'], is_cross_language: true, source_language: 'typescript', target_language: 'python' }))}
        highlight="none"
      />,
    );
    const badge = screen.getByTestId('edge-label-cross-language');
    expect(badge).toHaveTextContent('TS → Py');
    expect(badge.className).toContain('bg-amber-500/90');
    const pill = screen.getByTestId('edge-label-pill');
    expect(pill.className).toContain('bg-amber-900/90');
    expect(pill.className).toContain('border-amber-600');
    expect(pill.className).toContain('text-amber-100');
  });

  it('renders only the badge when cross-language without a label', () => {
    render(
      <ImportEdgeLabel
        edge={edge(data({ is_cross_language: true, source_language: 'go', target_language: 'rust' }))}
        highlight="none"
      />,
    );
    expect(screen.getByTestId('edge-label-cross-language')).toHaveTextContent('Go → Rs');
    expect(screen.queryByTestId('edge-label-pill')).toBeNull();
  });

  it('adds a ring when selected and opacity when dimmed', () => {
    const { rerender, container } = render(
      <ImportEdgeLabel edge={edge(data({ imported_names: ['x'] }))} highlight="selected" />,
    );
    expect(screen.getByTestId('edge-label-pill').className).toContain('ring-2 ring-blue-400');
    expect((container.firstElementChild as HTMLElement).className).not.toContain('opacity-30');

    rerender(<ImportEdgeLabel edge={edge(data({ imported_names: ['x'] }))} highlight="dimmed" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('opacity-30');
    expect(screen.getByTestId('edge-label-pill').className).not.toContain('ring-2');
  });

  it('renders nothing when there is no label and no cross-language flag', () => {
    const { container } = render(<ImportEdgeLabel edge={edge(undefined)} highlight="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('appends a custom className', () => {
    const { container } = render(
      <ImportEdgeLabel edge={edge(data({ imported_names: ['x'] }))} highlight="none" className="extra" />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('extra');
  });
});
