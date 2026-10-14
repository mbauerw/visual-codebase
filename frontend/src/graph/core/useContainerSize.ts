/**
 * Keeps `store.getContainerSize()` in sync with the canvas element: one
 * initial `getBoundingClientRect` measure, then a ResizeObserver.
 */

import { useEffect, type RefObject } from 'react';
import type { ViewportStore } from './viewportStore';

function pushSize(store: ViewportStore, width: number, height: number): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return; // not laid out yet (display:none, detached, jsdom…)
  const current = store.getContainerSize();
  if (current.width === w && current.height === h) return;
  store.setContainerSize({ width: w, height: h });
}

export function useContainerSizeObserver(ref: RefObject<HTMLElement>, store: ViewportStore): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      pushSize(store, rect.width, rect.height);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry?.contentRect;
      if (box) pushSize(store, box.width, box.height);
      else measure();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, store]);
}
