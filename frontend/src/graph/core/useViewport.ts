/**
 * Viewport hooks. All read the store from GraphContext unless one is passed.
 *
 * Implemented with `useSyncExternalStore`; every snapshot is a primitive or a
 * store-owned object that is referentially stable between commits, so a
 * component subscribed to e.g. `useZoom()` does not re-render while panning.
 */

import { useContext, useRef, useSyncExternalStore } from 'react';
import { GraphContext, useGraphTheme } from './GraphContext';
import { getLod, nodeScreenWidth } from './lod';
import type { GraphNode, LodLevel, Rect, Size, Viewport, ZoomBucket } from './types';
import type { ViewportStore } from './viewportStore';

function useResolvedStore(store?: ViewportStore): ViewportStore {
  const ctx = useContext(GraphContext);
  const resolved = store ?? ctx?.store;
  if (!resolved) {
    throw new Error('Viewport hooks must be used inside <GraphCanvas> or be given a store');
  }
  return resolved;
}

export function useViewport(store?: ViewportStore): Viewport {
  const s = useResolvedStore(store);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

export function useZoom(store?: ViewportStore): number {
  const s = useResolvedStore(store);
  const getZoom = () => s.get().zoom;
  return useSyncExternalStore(s.subscribe, getZoom, getZoom);
}

export function useContainerSizeValue(store?: ViewportStore): Size {
  const s = useResolvedStore(store);
  return useSyncExternalStore(s.subscribe, s.getContainerSize, s.getContainerSize);
}

export function useVisibleWorldRect(store?: ViewportStore): Rect {
  const s = useResolvedStore(store);
  return useSyncExternalStore(s.subscribe, s.getVisibleWorldRect, s.getVisibleWorldRect);
}

/**
 * Coarse zoom bucket for the whole canvas: the LOD a `referenceWidth`-world-px
 * node would get at the current zoom, with hysteresis so it does not flicker
 * around a threshold.
 */
export function useZoomBucket(referenceWidth = 200): ZoomBucket {
  const s = useResolvedStore();
  const { lod } = useGraphTheme();
  const prevRef = useRef<LodLevel | undefined>(undefined);
  const getSnapshot = (): ZoomBucket => {
    const level = getLod(referenceWidth * s.get().zoom, lod, prevRef.current);
    prevRef.current = level;
    return level;
  };
  return useSyncExternalStore(s.subscribe, getSnapshot, getSnapshot);
}

/** LOD for one node from its on-screen width, with hysteresis. */
export function useLod(node: GraphNode): LodLevel {
  const s = useResolvedStore();
  const { lod } = useGraphTheme();
  const prevRef = useRef<LodLevel | undefined>(undefined);
  const getSnapshot = (): LodLevel => {
    const level = getLod(nodeScreenWidth(node, s.get().zoom), lod, prevRef.current);
    prevRef.current = level;
    return level;
  };
  return useSyncExternalStore(s.subscribe, getSnapshot, getSnapshot);
}
