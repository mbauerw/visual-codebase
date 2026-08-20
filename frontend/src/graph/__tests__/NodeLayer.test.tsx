/**
 * NodeLayer viewport culling (`cullNodes`): file nodes outside the padded,
 * grid-quantised visible rect are not mounted; containers never culled;
 * the set follows viewport commits and drag offsets.
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GraphProvider, type GraphContextValue } from '../core/GraphContext';
import { NodeLayer } from '../core/NodeLayer';
import { buildNodeIndex, createScene } from '../core/sceneUtils';
import type { GraphNode } from '../core/types';
import { createViewportStore } from '../core/viewportStore';
import { createFrameHarness, createStubContext } from './testUtils';

function n(id: string, x: number, y: number, extra: Partial<GraphNode> = {}): GraphNode {
  return { id, kind: 'file', x, y, width: 100, height: 40, depth: 0, data: null, ...extra };
}

const nodes: GraphNode[] = [
  n('near', 100, 100),
  n('edge-of-pad', 900, 100), // inside the padded+quantised rect (x < 1024)
  n('far', 5000, 5000),
  n('far-folder', 5000, 5000, { kind: 'folder' }),
];

function setup(cullNodes: boolean) {
  const frames = createFrameHarness();
  const store = createViewportStore({
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    containerSize: { width: 800, height: 600 },
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const base = createStubContext(store);
  const scene = createScene(nodes, []);
  const value: GraphContextValue = { ...base, scene, nodeIndex: buildNodeIndex(nodes), cullNodes };
  const utils = render(
    <GraphProvider value={value}>
      <NodeLayer layer="containers" />
      <NodeLayer layer="nodes" />
    </GraphProvider>,
  );
  const has = (id: string) => screen.queryByTestId(`graph-node-${id}`) !== null;
  return { ...utils, store, frames, positions: value.positions, has };
}

describe('NodeLayer culling', () => {
  it('renders everything when cullNodes is off', () => {
    const { has } = setup(false);
    expect(has('near')).toBe(true);
    expect(has('edge-of-pad')).toBe(true);
    expect(has('far')).toBe(true);
    expect(has('far-folder')).toBe(true);
  });

  it('skips file nodes outside the padded/quantised visible rect but never containers', () => {
    const { has } = setup(true);
    // visible (0,0)-(800,600), +25% pad → (-200,-150)-(1000,750), snapped to 512 → (-512,-512)-(1024,1024)
    expect(has('near')).toBe(true);
    expect(has('edge-of-pad')).toBe(true);
    expect(has('far')).toBe(false);
    expect(has('far-folder')).toBe(true);
  });

  it('mounts far nodes once the committed viewport reaches them and unmounts the ones left behind', () => {
    const { has, store, frames } = setup(true);
    // pan so that world (5000,5000) is at the container's top-left
    act(() => {
      store.set({ x: -5000, y: -5000, zoom: 1 });
    });
    // not committed yet (rAF pending) → unchanged
    expect(has('far')).toBe(false);
    act(() => frames.flush());
    expect(has('far')).toBe(true);
    expect(has('near')).toBe(false);
  });

  it('a small pan that stays inside the same grid cells does not change the mounted set', () => {
    const { has, store, frames } = setup(true);
    act(() => {
      store.set({ x: -50, y: -30, zoom: 1 });
      frames.flush();
    });
    expect(has('near')).toBe(true);
    expect(has('far')).toBe(false);
  });

  it('follows drag offsets: a far node dragged into view is mounted', () => {
    const { has, positions } = setup(true);
    expect(has('far')).toBe(false);
    act(() => positions.set('far', { dx: -4900, dy: -4900 }));
    expect(has('far')).toBe(true);
    act(() => positions.clear());
    expect(has('far')).toBe(false);
  });
});
