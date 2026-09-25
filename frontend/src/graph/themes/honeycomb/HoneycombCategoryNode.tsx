/**
 * HoneycombCategoryNode — a comb.
 *
 * Folded: one big flat-top cell tinted in the role colour with the role name,
 * the cell count and a six-cell glyph ("there is more inside").
 * Bloomed: a pointy-top container outlined in the role colour; the label
 * moves into a small central cell and the file cells ring around it.
 *
 * The wrapper is the hit area: a click anywhere on the comb (not on a file
 * cell) folds or blooms it via the pack's `collapsible` contract.
 */

import type { NodeRenderProps } from '../../core/types';
import { roleColors } from '../../../types';
import { HONEYCOMB_CFG, type HoneycombCategoryData } from './layout';
import { Hex } from './Hex';
import { HC } from './theme';

/** Six small hexes around a seventh — the "more inside" glyph. */
function CombGlyph({ color }: { color: string }) {
  const cells = [
    [0, 0],
    [-11, -6.5],
    [0, -13],
    [11, -6.5],
    [11, 6.5],
    [0, 13],
    [-11, 6.5],
  ];
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 40 }}>
      {cells.map(([dx, dy], i) => (
        <Hex
          key={i}
          outline={HC.ink}
          fill={i === 0 ? color : HC.wax}
          stroke={1.5}
          style={{ position: 'absolute', left: 22 + dx - 7, top: 20 + dy - 6, width: 14, height: 12 }}
        />
      ))}
    </div>
  );
}

export function HoneycombCategoryNode({ node, lod }: NodeRenderProps<HoneycombCategoryData>) {
  const d = node.data;
  const color = roleColors[d.role] ?? HC.honey;
  const tint = `color-mix(in srgb, ${color} 28%, ${HC.wax})`;

  if (!d.expanded) {
    return (
      <div
        data-testid="honeycomb-comb"
        data-lod={lod}
        data-expanded="false"
        className="w-full h-full pointer-events-none"
        style={{ filter: 'drop-shadow(0 6px 0 rgba(43,29,14,0.25))', fontFamily: HC.display, color: HC.ink }}
      >
        <Hex outline={HC.ink} fill={tint} stroke={5} className="w-full h-full">
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '0 44px', gap: 12 }}>
            <CombGlyph color={color} />
            <div
              data-testid="honeycomb-comb-label"
              style={{ fontSize: 34, lineHeight: 0.95, fontWeight: 800, letterSpacing: '0.06em' }}
            >
              {d.label.toUpperCase()}
            </div>
            <div style={{ fontFamily: HC.body, fontSize: 14, fontWeight: 600, opacity: 0.75, whiteSpace: 'nowrap' }}>
              {d.nodeCount} {d.nodeCount === 1 ? 'cell' : 'cells'} · tap to bloom
            </div>
          </div>
        </Hex>
      </div>
    );
  }

  const C = HONEYCOMB_CFG;
  const centre = d.centre ?? { x: node.width / 2, y: node.height / 2 };
  return (
    <div
      data-testid="honeycomb-comb"
      data-lod={lod}
      data-expanded="true"
      className="w-full h-full pointer-events-none relative"
      style={{ fontFamily: HC.display, color: HC.ink }}
    >
      <Hex orientation="pointy" outline={color} fill={tint} stroke={5} className="w-full h-full" fillStyle={{ opacity: 0.85 }} />
      {/* central label cell */}
      <div
        data-testid="honeycomb-comb-label"
        className="absolute"
        style={{ left: centre.x - C.cellW / 2, top: centre.y - C.cellH / 2, width: C.cellW, height: C.cellH }}
      >
        <Hex outline={HC.ink} fill={color} stroke={4} className="w-full h-full">
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '0 26px', color: HC.wax, textShadow: '0 1px 0 rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 20, lineHeight: 0.95, fontWeight: 800, letterSpacing: '0.05em' }}>{d.label.toUpperCase()}</div>
            <div style={{ fontFamily: HC.body, fontSize: 12, fontWeight: 600, marginTop: 6, opacity: 0.9 }}>{d.nodeCount} · fold</div>
          </div>
        </Hex>
      </div>
    </div>
  );
}
