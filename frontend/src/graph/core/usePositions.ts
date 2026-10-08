/**
 * Hooks over the position overrides store (see positionStore.ts).
 *
 * `useNodeOffset(id)` subscribes to ONE id, so during a drag only the wrappers
 * of the moved nodes and the edges touching them re-render.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { GraphNode, PositionDelta } from './types';
import { useGraphPositions } from './GraphContext';
import { ZERO_OFFSET } from './positionStore';

/** Current offset of `id`; the shared `ZERO_OFFSET` object when it has none. */
export function useNodeOffset(id: string): PositionDelta {
  const positions = useGraphPositions();
  const subscribe = useCallback((listener: () => void) => positions.subscribe(id, listener), [positions, id]);
  const getSnapshot = useCallback(() => positions.get(id) ?? ZERO_OFFSET, [positions, id]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Change token for the whole store (bumps on every set/setMany/clear). When
 * `enabled` is false the snapshot is constant so the caller never re-renders.
 */
export function usePositionsVersion(enabled = true): number {
  const positions = useGraphPositions();
  const subscribe = useCallback(
    (listener: () => void) => (enabled ? positions.subscribe('*', listener) : () => {}),
    [positions, enabled],
  );
  const getSnapshot = useCallback(() => (enabled ? positions.getVersion() : 0), [positions, enabled]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** `node` shifted by its drag offset (the SAME object when it has none). */
export function useOffsetNode(node: GraphNode): GraphNode {
  const off = useNodeOffset(node.id);
  return useMemo(
    () => (off.dx === 0 && off.dy === 0 ? node : { ...node, x: node.x + off.dx, y: node.y + off.dy }),
    [node, off],
  );
}
