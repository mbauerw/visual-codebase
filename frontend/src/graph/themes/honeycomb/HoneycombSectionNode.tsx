/**
 * HoneycombSectionNode — a hive frame: dark-wood border with a lighter inner
 * bevel, honey paper with a faint comb pattern, the layer name burned into
 * the top rail. Decorative (pointer-events: none).
 */

import type { NodeRenderProps } from '../../core/types';
import type { HoneycombSectionData } from './layout';
import { HC } from './theme';

// One flat-top hex tile (40 wide) repeated as a faint comb texture.
const COMB_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="34.64" viewBox="0 0 60 34.64">` +
    `<g fill="none" stroke="#2b1d0e" stroke-opacity="0.09" stroke-width="1.2">` +
    `<polygon points="0,17.32 10,0 30,0 40,17.32 30,34.64 10,34.64"/>` +
    `<polygon points="40,17.32 50,0 70,0 80,17.32 70,34.64 50,34.64"/>` +
    `<polygon points="40,-17.32 50,-34.64 70,-34.64 80,-17.32 70,0 50,0"/>` +
    `<polygon points="-20,17.32 -10,0 10,0 20,17.32 10,34.64 -10,34.64"/>` +
    `</g></svg>`
);

const RAIL = 22;

export function HoneycombSectionNode({ node }: NodeRenderProps<HoneycombSectionData>) {
  const d = node.data;
  return (
    <div
      data-testid="honeycomb-frame"
      className="w-full h-full pointer-events-none relative"
      style={{
        borderRadius: 14,
        background: HC.wood,
        boxShadow: '0 30px 50px -30px rgba(43,29,14,0.6), inset 0 0 0 4px rgba(255,255,255,0.08)',
        fontFamily: HC.display,
        color: HC.wax,
      }}
    >
      {/* inner bevel + paper */}
      <div
        className="absolute"
        style={{
          inset: RAIL,
          borderRadius: 6,
          background: HC.woodLight,
          boxShadow: 'inset 0 0 0 6px rgba(0,0,0,0.18)',
        }}
      >
        <div
          className="absolute"
          style={{
            inset: 10,
            borderRadius: 4,
            backgroundColor: HC.paperDeep,
            backgroundImage: `url("data:image/svg+xml,${COMB_SVG}")`,
            backgroundSize: '60px 34.64px',
            boxShadow: 'inset 0 6px 12px rgba(43,29,14,0.25)',
          }}
        />
      </div>

      {/* name burned into the top rail */}
      <div
        className="absolute flex items-baseline gap-6 whitespace-nowrap"
        style={{ left: 44, top: RAIL + 22, textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}
      >
        <span style={{ fontSize: 64, lineHeight: 1, fontWeight: 800, letterSpacing: '0.1em', color: HC.waxWarm }}>
          {d.label.toUpperCase()}
        </span>
        <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '0.18em', color: HC.honey }}>
          {d.nodeCount} {d.nodeCount === 1 ? 'CELL' : 'CELLS'} · {d.combCount} {d.combCount === 1 ? 'COMB' : 'COMBS'}
        </span>
      </div>
    </div>
  );
}
