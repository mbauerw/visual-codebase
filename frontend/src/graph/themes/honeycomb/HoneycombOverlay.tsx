/**
 * HoneycombOverlay — "Bloom all" / "Fold all" on a wax label.
 */

import { GraphPanel } from '../../chrome/GraphPanel';
import type { ThemeOverlayProps } from '../types';
import { HC } from './theme';

export function HoneycombOverlay({ scene, state, actions }: ThemeOverlayProps) {
  const combIds = scene.nodes.filter((n) => n.kind === 'category').map((n) => n.id);
  const bloomed = combIds.filter((id) => state.expanded.has(id)).length;
  const btn =
    'px-3 py-1.5 text-[12px] font-bold tracking-[0.14em] uppercase transition-colors hover:bg-[#ffe9a8] disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <GraphPanel position="top-right" className="m-4">
      <div
        data-testid="honeycomb-overlay"
        className="flex items-center overflow-hidden"
        style={{ fontFamily: HC.body, color: HC.ink, background: HC.wax, border: `3px solid ${HC.ink}`, borderRadius: 999, boxShadow: '0 4px 0 rgba(43,29,14,0.25)' }}
      >
        <span className="pl-4 pr-3 text-[12px] font-semibold tracking-[0.1em]">
          {bloomed}/{combIds.length} in bloom
        </span>
        <button
          type="button"
          className={btn}
          style={{ borderLeft: `3px solid ${HC.ink}` }}
          disabled={bloomed === combIds.length}
          onClick={() => actions.expandAll(combIds)}
        >
          Bloom all
        </button>
        <button
          type="button"
          className={btn}
          style={{ borderLeft: `3px solid ${HC.ink}` }}
          disabled={bloomed === 0}
          onClick={() => actions.collapseAll()}
        >
          Fold all
        </button>
      </div>
    </GraphPanel>
  );
}
