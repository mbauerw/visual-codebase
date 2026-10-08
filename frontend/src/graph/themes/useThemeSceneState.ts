/**
 * Owns the UI state a theme pack's scene can depend on (today: the set of
 * expanded categories) and the actions that mutate it. Both are referentially
 * stable between changes so `buildScene` can be memoised on `state`.
 */

import { useMemo, useState } from 'react';
import type { ThemeSceneActions, ThemeSceneState } from './types';

const EMPTY: ReadonlySet<string> = new Set();

export function useThemeSceneState(): { state: ThemeSceneState; actions: ThemeSceneActions } {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY);

  const actions = useMemo<ThemeSceneActions>(
    () => ({
      toggle: (id) =>
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      expandAll: (ids) => setExpanded(new Set(ids)),
      collapseAll: () => setExpanded(EMPTY),
    }),
    []
  );

  const state = useMemo<ThemeSceneState>(() => ({ expanded }), [expanded]);
  return { state, actions };
}
