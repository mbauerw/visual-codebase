/**
 * Shared test helpers for the graph engine: a manual rAF queue + clock so
 * store commits and tweens can be driven deterministically.
 */

import type { GraphContextValue } from '../core/GraphContext';
import { createPositionStore } from '../core/positionStore';
import type { ViewportStore } from '../core/viewportStore';
import type { GraphTheme } from '../theme/types';

export interface FrameHarness {
  raf: (cb: FrameRequestCallback) => number;
  caf: (id: number) => void;
  now: () => number;
  /** Advance the clock by `ms` and run every callback queued so far (once). */
  flush: (ms?: number) => void;
  /** Number of callbacks currently queued. */
  pending: () => number;
  time: () => number;
}

export function createFrameHarness(): FrameHarness {
  let nextId = 1;
  let time = 0;
  const queue = new Map<number, FrameRequestCallback>();
  return {
    raf: (cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    },
    caf: (id) => {
      queue.delete(id);
    },
    now: () => time,
    flush: (ms = 16) => {
      time += ms;
      const cbs = Array.from(queue.values());
      queue.clear();
      for (const cb of cbs) cb(time);
    },
    pending: () => queue.size,
    time: () => time,
  };
}

const noop = (): void => {};

export function createStubTheme(): GraphTheme {
  const tokens = { ring: {} };
  return {
    background: '#fff',
    nodes: { file: tokens, folder: tokens, category: tokens, section: tokens },
    edges: { base: { stroke: '#000', strokeWidth: 1, markerSize: 10 }, byHighlight: {} },
    anchors: { source: 'bottom', target: 'top' },
    lod: { farBelowPx: 40, nearAbovePx: 140 },
    zoom: { min: 0.05, max: 2 },
    chrome: {
      panelClassName: '',
      buttonClassName: '',
      minimap: { maskColor: '#000', className: '', nodeColor: () => '#000' },
    },
  };
}

export function createStubContext(store: ViewportStore, theme: GraphTheme = createStubTheme()): GraphContextValue {
  return {
    store,
    theme,
    renderers: {},
    scene: { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } },
    nodeIndex: new Map(),
    highlights: { nodes: new Map(), edges: new Map() },
    callbacks: {},
    positions: createPositionStore(),
    nodesDraggable: false,
    cullNodes: false,
    descendantIds: () => [],
    actions: {
      fitView: noop,
      focusNode: noop,
      zoomIn: noop,
      zoomOut: noop,
      zoomTo: noop,
      getViewport: () => store.get(),
      setViewport: noop,
      screenToWorld: (p) => p,
      worldToScreen: (p) => p,
    },
  };
}
