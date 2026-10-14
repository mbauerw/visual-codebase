import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EdgeItem } from '../edges/EdgeItem';
import { computeEdgeGeometry } from '../edges/geometry';
import type { GraphEdge, GraphNode } from '../core/types';
import type { ResolvedEdgeStyle } from '../theme/types';

const source: GraphNode = { id: 'a', kind: 'file', x: 0, y: 0, width: 100, height: 40, depth: 0, data: null };
const target: GraphNode = { id: 'b', kind: 'file', x: 300, y: 300, width: 100, height: 40, depth: 0, data: null };
const edge: GraphEdge = { id: 'e1', source: 'a', target: 'b' };
const style: ResolvedEdgeStyle = { stroke: '#475569', strokeWidth: 1.5, markerSize: 20 };
const anchors = { source: 'top', target: 'bottom' } as const;

function renderEdge(over: Partial<React.ComponentProps<typeof EdgeItem>> = {}) {
  return render(
    <svg>
      <EdgeItem edge={edge} source={source} target={target} highlight="none" style={style} anchors={anchors} {...over} />
    </svg>,
  );
}

describe('EdgeItem', () => {
  it('renders a group with id/testid/highlight and two paths sharing the same d', () => {
    renderEdge({ highlight: 'connected' });
    const g = screen.getByTestId('graph-edge-e1');
    expect(g.getAttribute('data-edge-id')).toBe('e1');
    expect(g.getAttribute('data-highlight')).toBe('connected');
    const paths = g.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    const expected = computeEdgeGeometry(source, target, anchors).path;
    expect(paths[0].getAttribute('d')).toBe(expected);
    expect(paths[1].getAttribute('d')).toBe(expected);
    expect(expected.startsWith('M50 0')).toBe(true); // top anchor of source
  });

  it('visible path carries stroke, width, dasharray, opacity and the marker url', () => {
    renderEdge({ style: { ...style, dasharray: '20, 20', opacity: 0.4 } });
    const [visible] = screen.getByTestId('graph-edge-e1').querySelectorAll('path');
    expect(visible.getAttribute('fill')).toBe('none');
    expect(visible.getAttribute('stroke')).toBe('#475569');
    expect(visible.getAttribute('stroke-width')).toBe('1.5');
    expect(visible.getAttribute('stroke-dasharray')).toBe('20, 20');
    expect(visible.getAttribute('opacity')).toBe('0.4');
    expect(visible.getAttribute('marker-end')).toBe('url(#gm-arrow-_475569-20)');
    expect(visible.style.pointerEvents).toBe('none');
  });

  it('hit path is transparent, at least 12 wide, and captures pointer events on the stroke', () => {
    renderEdge();
    const [, hit] = screen.getByTestId('graph-edge-e1').querySelectorAll('path');
    expect(hit.getAttribute('stroke')).toBe('transparent');
    expect(hit.getAttribute('fill')).toBe('none');
    expect(Number(hit.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(12);
    expect(hit.style.pointerEvents).toBe('stroke');
    expect(hit.style.cursor).toBe('pointer');
  });

  it('hit width grows to 3x a thick stroke', () => {
    renderEdge({ style: { ...style, strokeWidth: 6 } });
    const [, hit] = screen.getByTestId('graph-edge-e1').querySelectorAll('path');
    expect(hit.getAttribute('stroke-width')).toBe('18');
  });

  it('click on the hit path calls onClick with the edge and event', () => {
    const onClick = vi.fn();
    renderEdge({ onClick });
    const [, hit] = screen.getByTestId('graph-edge-e1').querySelectorAll('path');
    fireEvent.click(hit, { clientX: 11, clientY: 22 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBe(edge);
    expect(onClick.mock.calls[0][1].clientX).toBe(11);
  });

  it('pointer enter/leave on the hit path reports hover changes', () => {
    const onHoverChange = vi.fn();
    renderEdge({ onHoverChange });
    const [, hit] = screen.getByTestId('graph-edge-e1').querySelectorAll('path');
    fireEvent.pointerEnter(hit);
    expect(onHoverChange).toHaveBeenLastCalledWith(edge);
    fireEvent.pointerLeave(hit);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });
});
