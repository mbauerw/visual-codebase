/**
 * Position overrides store — per-node world-space deltas layered on top of the
 * scene's layout positions (node dragging).
 *
 * Framework-free. Listeners subscribe per node id (or to `'*'` for any change),
 * so during a drag only the dragged node(s) and the edges touching them are
 * notified. Snapshots (`get(id)`) are referentially stable until that id
 * changes, so they can be fed straight to `useSyncExternalStore`.
 */

import type { PositionDelta } from './types';

/** Shared "no offset" value; `get()` never returns it (undefined instead) but hooks do. */
export const ZERO_OFFSET: Readonly<PositionDelta> = Object.freeze({ dx: 0, dy: 0 });

export type PositionListener = () => void;

export interface PositionStore {
  /** Delta for `id`, or `undefined` when it has none. Stable object until the id changes. */
  get(id: string): PositionDelta | undefined;
  /** Live map (do NOT mutate). Use `getVersion()` when you need a change token. */
  getAll(): ReadonlyMap<string, PositionDelta>;
  /** Monotonic counter bumped by every change (snapshot for `'*'` subscribers). */
  getVersion(): number;
  set(id: string, delta: PositionDelta): void;
  /** Batch update; every touched id is notified once, `'*'` once. */
  setMany(entries: Iterable<readonly [string, PositionDelta]>): void;
  /** Drop every override; notifies every id that had one, plus `'*'`. */
  clear(): void;
  /** Subscribe to one id or to `'*'` (any change). Returns the unsubscribe function. */
  subscribe(id: string | '*', listener: PositionListener): () => void;
}

export function isZeroDelta(d: PositionDelta | undefined): boolean {
  return !d || (d.dx === 0 && d.dy === 0);
}

export function createPositionStore(): PositionStore {
  const values = new Map<string, PositionDelta>();
  const listeners = new Map<string, Set<PositionListener>>();
  let version = 0;

  const notifyId = (id: string): void => {
    const set = listeners.get(id);
    if (!set) return;
    for (const l of Array.from(set)) l();
  };

  /** Write one entry; returns whether anything changed. Does not notify. */
  const write = (id: string, delta: PositionDelta): boolean => {
    const prev = values.get(id);
    if (prev && prev.dx === delta.dx && prev.dy === delta.dy) return false;
    values.set(id, { dx: delta.dx, dy: delta.dy });
    return true;
  };

  return {
    get: (id) => values.get(id),
    getAll: () => values,
    getVersion: () => version,

    set(id, delta) {
      if (!write(id, delta)) return;
      version++;
      notifyId(id);
      notifyId('*');
    },

    setMany(entries) {
      const touched: string[] = [];
      for (const [id, delta] of entries) {
        if (write(id, delta)) touched.push(id);
      }
      if (touched.length === 0) return;
      version++;
      for (const id of touched) notifyId(id);
      notifyId('*');
    },

    clear() {
      if (values.size === 0) return;
      const ids = Array.from(values.keys());
      values.clear();
      version++;
      for (const id of ids) notifyId(id);
      notifyId('*');
    },

    subscribe(id, listener) {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(listener);
      return () => {
        const current = listeners.get(id);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) listeners.delete(id);
      };
    },
  };
}
