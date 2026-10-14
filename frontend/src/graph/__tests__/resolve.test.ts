import { describe, expect, it, vi } from 'vitest';
import { mergeNodeTokens, resolveEdgeStyle, resolveNodeTheme } from '../theme/resolve';
import type { GraphTheme, NodeThemeTokens } from '../theme/types';
import type { GraphNode, NodeHighlight } from '../core/types';

const ALL_NODE_HIGHLIGHTS: NodeHighlight[] = [
  'none',
  'selected',
  'tierlist',
  'connected',
  'connected-tierlist',
  'edge-endpoint',
  'container-selected',
];

const fileTokens: NodeThemeTokens = {
  className: 'file-base',
  style: { borderRadius: 8, opacity: 1 },
  surface: '#111',
  border: '#222',
  text: '#eee',
  radius: 8,
  ring: { selected: 'ring-blue', connected: 'ring-blue-soft' },
  motion: { whileHover: { scale: 1.02 }, transition: { duration: 0.1 } },
};

const theme: GraphTheme = {
  background: '#000',
  nodes: {
    file: fileTokens,
    folder: { ring: { 'container-selected': 'ring-folder' }, surface: '#333' },
    category: { ring: {} },
    section: { ring: {}, className: 'section' },
  },
  edges: {
    base: { stroke: '#888', strokeWidth: 1, opacity: 0.6, markerSize: 12 },
    byHighlight: {
      selected: { stroke: '#fff', strokeWidth: 3, opacity: 1 },
      dimmed: { opacity: 0.1 },
      connected: { stroke: '#4af', dasharray: '4, 4' },
    },
  },
  anchors: { source: 'bottom', target: 'top' },
  lod: { farBelowPx: 40, nearAbovePx: 160 },
  zoom: { min: 0.1, max: 4 },
  chrome: {
    panelClassName: 'panel',
    buttonClassName: 'btn',
    minimap: { maskColor: 'rgba(0,0,0,.5)', className: 'mm', nodeColor: () => '#fff' },
  },
};

const fileNode: GraphNode = { id: 'f', kind: 'file', x: 0, y: 0, width: 10, height: 10, depth: 0, data: null };

describe('mergeNodeTokens', () => {
  it('returns a copy of the base when there are no overrides', () => {
    const out = mergeNodeTokens(fileTokens);
    expect(out).toEqual(fileTokens);
    expect(out).not.toBe(fileTokens);
    expect(out.ring).not.toBe(fileTokens.ring);
    expect(out.style).not.toBe(fileTokens.style);
  });

  it('shallow-merges scalar tokens, later wins', () => {
    const out = mergeNodeTokens(fileTokens, { surface: '#a' }, { surface: '#b', text: '#t' });
    expect(out.surface).toBe('#b');
    expect(out.text).toBe('#t');
    expect(out.border).toBe('#222');
  });

  it('merges ring per key', () => {
    const out = mergeNodeTokens(fileTokens, { ring: { tierlist: 'ring-amber' } }, { ring: { selected: 'ring-red' } });
    expect(out.ring).toEqual({ selected: 'ring-red', connected: 'ring-blue-soft', tierlist: 'ring-amber' });
  });

  it('concatenates className with a space', () => {
    expect(mergeNodeTokens(fileTokens, { className: 'x' }, undefined, { className: 'y' }).className).toBe('file-base x y');
    expect(mergeNodeTokens({ ring: {} }, { className: 'only' }).className).toBe('only');
    expect(mergeNodeTokens({ ring: {} }, { className: '' }).className).toBeUndefined();
  });

  it('shallow-merges style and motion', () => {
    const out = mergeNodeTokens(fileTokens, { style: { opacity: 0.5, color: 'red' }, motion: { transition: { duration: 1 } } });
    expect(out.style).toEqual({ borderRadius: 8, opacity: 0.5, color: 'red' });
    expect(out.motion).toEqual({ whileHover: { scale: 1.02 }, transition: { duration: 1 } });
  });

  it('skips undefined override values and undefined overrides', () => {
    const out = mergeNodeTokens(fileTokens, undefined, { surface: undefined, ring: { selected: undefined } });
    expect(out.surface).toBe('#111');
    expect(out.ring.selected).toBe('ring-blue');
  });

  it('does not mutate its inputs', () => {
    const base: NodeThemeTokens = { ring: { selected: 'a' }, style: { opacity: 1 }, className: 'c' };
    const override = { ring: { connected: 'b' }, style: { color: 'red' }, className: 'd' };
    mergeNodeTokens(base, override);
    expect(base).toEqual({ ring: { selected: 'a' }, style: { opacity: 1 }, className: 'c' });
    expect(override).toEqual({ ring: { connected: 'b' }, style: { color: 'red' }, className: 'd' });
  });
});

describe('resolveNodeTheme', () => {
  it('fills every NodeHighlight key of ring with "" and always defines className/style', () => {
    const resolved = resolveNodeTheme(theme, { ...fileNode, kind: 'category' });
    expect(Object.keys(resolved.ring).sort()).toEqual([...ALL_NODE_HIGHLIGHTS].sort());
    for (const k of ALL_NODE_HIGHLIGHTS) expect(resolved.ring[k]).toBe('');
    expect(resolved.className).toBe('');
    expect(resolved.style).toEqual({});
  });

  it('keeps theme ring values and fills the rest', () => {
    const resolved = resolveNodeTheme(theme, fileNode);
    expect(resolved.ring.selected).toBe('ring-blue');
    expect(resolved.ring.connected).toBe('ring-blue-soft');
    expect(resolved.ring.none).toBe('');
    expect(resolved.ring.tierlist).toBe('');
    expect(resolved.ring['edge-endpoint']).toBe('');
    expect(resolved.ring['container-selected']).toBe('');
    expect(resolved.className).toBe('file-base');
    expect(resolved.style).toEqual({ borderRadius: 8, opacity: 1 });
    expect(resolved.surface).toBe('#111');
    expect(resolved.motion).toEqual(fileTokens.motion);
  });

  it('applies the merge order theme < override fn < node.themeOverride', () => {
    const override = vi.fn(() => ({
      surface: '#override',
      text: '#override-text',
      className: 'from-fn',
      ring: { selected: 'ring-fn', tierlist: 'ring-fn-tier' },
      style: { opacity: 0.5 },
    }));
    const node: GraphNode = {
      ...fileNode,
      themeOverride: { surface: '#node', className: 'from-node', ring: { selected: 'ring-node' }, style: { color: 'red' } },
    };
    const resolved = resolveNodeTheme(theme, node, override);
    expect(override).toHaveBeenCalledTimes(1);
    expect(override).toHaveBeenCalledWith(node);
    expect(resolved.surface).toBe('#node'); // node beats fn
    expect(resolved.text).toBe('#override-text'); // fn beats theme
    expect(resolved.border).toBe('#222'); // theme survives
    expect(resolved.className).toBe('file-base from-fn from-node');
    expect(resolved.ring.selected).toBe('ring-node');
    expect(resolved.ring.tierlist).toBe('ring-fn-tier');
    expect(resolved.ring.connected).toBe('ring-blue-soft');
    expect(resolved.style).toEqual({ borderRadius: 8, opacity: 0.5, color: 'red' });
  });

  it('tolerates an override fn returning undefined', () => {
    const resolved = resolveNodeTheme(theme, fileNode, () => undefined);
    expect(resolved.surface).toBe('#111');
    expect(resolved.className).toBe('file-base');
  });

  it('picks tokens by node kind', () => {
    const folder = resolveNodeTheme(theme, { ...fileNode, kind: 'folder' });
    expect(folder.surface).toBe('#333');
    expect(folder.ring['container-selected']).toBe('ring-folder');
    expect(folder.ring.selected).toBe('');
    const section = resolveNodeTheme(theme, { ...fileNode, kind: 'section' });
    expect(section.className).toBe('section');
  });

  it('does not mutate the theme', () => {
    const before = JSON.stringify(theme.nodes.file);
    resolveNodeTheme(theme, { ...fileNode, themeOverride: { ring: { selected: 'zzz' }, style: { color: 'x' } } });
    expect(JSON.stringify(theme.nodes.file)).toBe(before);
  });
});

describe('resolveEdgeStyle', () => {
  it('returns base for none / unknown highlight', () => {
    expect(resolveEdgeStyle(theme, 'none')).toEqual(theme.edges.base);
    expect(resolveEdgeStyle(theme, 'connected-tierlist')).toEqual(theme.edges.base);
  });

  it('overlays byHighlight on base', () => {
    expect(resolveEdgeStyle(theme, 'selected')).toEqual({ stroke: '#fff', strokeWidth: 3, opacity: 1, markerSize: 12 });
    expect(resolveEdgeStyle(theme, 'dimmed')).toEqual({ stroke: '#888', strokeWidth: 1, opacity: 0.1, markerSize: 12 });
    expect(resolveEdgeStyle(theme, 'connected')).toEqual({
      stroke: '#4af',
      strokeWidth: 1,
      opacity: 0.6,
      markerSize: 12,
      dasharray: '4, 4',
    });
  });

  it('never returns undefined for the required keys', () => {
    const t: GraphTheme = { ...theme, edges: { ...theme.edges, byHighlight: { selected: { stroke: undefined } } } };
    const s = resolveEdgeStyle(t, 'selected');
    expect(s.stroke).toBe('#888');
    expect(s.strokeWidth).toBe(1);
    expect(s.markerSize).toBe(12);
  });
});
