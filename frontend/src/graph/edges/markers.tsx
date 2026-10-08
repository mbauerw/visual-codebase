/**
 * SVG arrow-head markers for edges. One `<marker>` per distinct
 * (colour, size) pair; `markerUnits="userSpaceOnUse"` keeps the head a fixed
 * world size regardless of stroke width.
 */

import { memo } from 'react';

export interface MarkerEntry {
  color: string;
  size: number;
}

/** `gm-arrow-${sanitised colour}-${size}` — safe as an SVG/CSS id. */
export function markerId(color: string, size: number): string {
  const safe = color.replace(/[#\s,()/.%]/g, '_');
  return `gm-arrow-${safe}-${size}`;
}

function dedupe(entries: readonly MarkerEntry[]): MarkerEntry[] {
  const seen = new Set<string>();
  const out: MarkerEntry[] = [];
  for (const e of entries) {
    const id = markerId(e.color, e.size);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(e);
  }
  return out;
}

export const MarkerDefs = memo(function MarkerDefs({ entries }: { entries: readonly MarkerEntry[] }) {
  const unique = dedupe(entries);
  return (
    <defs>
      {unique.map(({ color, size }) => (
        <marker
          key={markerId(color, size)}
          id={markerId(color, size)}
          markerWidth={size}
          markerHeight={size}
          viewBox="-10 -10 20 20"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
          refX={0}
          refY={0}
        >
          <polyline
            points="-5,-4 0,0 -5,4 -5,-4"
            fill={color}
            stroke={color}
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      ))}
    </defs>
  );
});
