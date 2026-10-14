import { describe, expect, it } from 'vitest';
import { getAnchor, getEdgeEndpoints } from '../edges/anchors';
import type { GraphNode } from '../core/types';

const node = (over: Partial<GraphNode> = {}): GraphNode => ({
  id: 'n',
  kind: 'file',
  x: 100,
  y: 200,
  width: 80,
  height: 40,
  depth: 0,
  data: null,
  ...over,
});

describe('getAnchor', () => {
  it('returns the slot edge midpoints when scale is 1 (default)', () => {
    const n = node();
    expect(getAnchor(n, 'top')).toEqual({ x: 140, y: 200 });
    expect(getAnchor(n, 'bottom')).toEqual({ x: 140, y: 240 });
    expect(getAnchor(n, 'left')).toEqual({ x: 100, y: 220 });
    expect(getAnchor(n, 'right')).toEqual({ x: 180, y: 220 });
  });

  it('honours scale about the slot centre', () => {
    const n = node({ scale: 2 });
    // centre (140, 220); half scaled size = (80, 40)
    expect(getAnchor(n, 'top')).toEqual({ x: 140, y: 180 });
    expect(getAnchor(n, 'bottom')).toEqual({ x: 140, y: 260 });
    expect(getAnchor(n, 'left')).toEqual({ x: 60, y: 220 });
    expect(getAnchor(n, 'right')).toEqual({ x: 220, y: 220 });
  });

  it('shrinks the anchor box for scale < 1', () => {
    const n = node({ scale: 0.5 });
    expect(getAnchor(n, 'top')).toEqual({ x: 140, y: 210 });
    expect(getAnchor(n, 'left')).toEqual({ x: 120, y: 220 });
  });
});

describe('getEdgeEndpoints', () => {
  it('combines the two anchors and passes the sides through', () => {
    const s = node({ id: 's', x: 0, y: 0, width: 100, height: 50 });
    const t = node({ id: 't', x: 300, y: 400, width: 60, height: 20, scale: 2 });
    expect(getEdgeEndpoints(s, t, { source: 'bottom', target: 'top' })).toEqual({
      sourceX: 50,
      sourceY: 50,
      targetX: 330,
      targetY: 390,
      sourcePosition: 'bottom',
      targetPosition: 'top',
    });
    expect(getEdgeEndpoints(s, t, { source: 'right', target: 'left' })).toEqual({
      sourceX: 100,
      sourceY: 25,
      targetX: 270,
      targetY: 410,
      sourcePosition: 'right',
      targetPosition: 'left',
    });
  });
});
