/**
 * HoneycombFileNode — a wax cell. Ink outline, wax fill; the middle tier is
 * warm wax and the top tier is full of honey (white text). Highlight state
 * recolours the outline (clip-path clips box-shadow rings): raspberry for
 * the selection, teal for its dependencies.
 *
 *   far  → the cell only
 *   mid  → + name
 *   near → + language and line count
 */

import { motion } from 'framer-motion';
import type { NodeRenderProps } from '../../core/types';
import { languageShortLabels } from '../../renderers/ImportEdgeLabel';
import { Hex } from './Hex';
import type { HoneycombFileData } from './layout';
import { HC } from './theme';

export function cellOutline(highlight: NodeRenderProps['highlight']): { color: string; stroke: number } {
  switch (highlight) {
    case 'selected':
    case 'edge-endpoint':
      return { color: HC.red, stroke: 6 };
    case 'tierlist':
      return { color: HC.blue, stroke: 6 };
    case 'connected':
      return { color: HC.teal, stroke: 5 };
    case 'connected-tierlist':
      return { color: HC.blue, stroke: 5 };
    default:
      return { color: HC.ink, stroke: 3 };
  }
}

export function HoneycombFileNode({ node, highlight, lod, theme }: NodeRenderProps<HoneycombFileData>) {
  const d = node.data;
  const tier = d.scaleTier ?? 1;
  const isHub = tier >= 1.5;
  const fill = isHub
    ? `linear-gradient(160deg, ${HC.honey} 0%, ${HC.honeyDeep} 100%)`
    : tier > 1
      ? HC.waxWarm
      : theme.surface ?? HC.wax;
  const outline = cellOutline(highlight);
  const emphasised = highlight === 'selected' || highlight === 'tierlist';

  return (
    <motion.div
      data-testid="honeycomb-cell"
      data-lod={lod}
      data-tier={tier}
      className="w-full h-full hc-cell"
      style={{
        ['--bloom-index' as string]: d.bloomIndex ?? 0,
        transformOrigin: 'center center',
        filter: 'drop-shadow(0 4px 0 rgba(43,29,14,0.22))',
        fontFamily: HC.body,
        color: isHub ? HC.wax : theme.text ?? HC.ink,
      }}
      initial={false}
      animate={{ scale: emphasised ? 1.12 : 1 }}
      transition={theme.motion?.transition}
    >
      <motion.div className="w-full h-full" whileHover={theme.motion?.whileHover} transition={theme.motion?.transition}>
        <Hex outline={outline.color} fill={fill} stroke={outline.stroke} className="w-full h-full transition-[background] duration-200">
          {lod !== 'far' && (
            <div className="flex flex-col items-center justify-center text-center w-full" style={{ padding: '0 14px' }}>
              <div
                data-testid="honeycomb-cell-name"
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflowWrap: 'anywhere',
                }}
                title={d.path}
              >
                {d.label}
              </div>
              {lod === 'near' && (
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', marginTop: 5, opacity: isHub ? 0.9 : 0.6 }}>
                  {(languageShortLabels[d.language] ?? '?').toUpperCase()} · {d.line_count} LN
                </div>
              )}
            </div>
          )}
        </Hex>
      </motion.div>
    </motion.div>
  );
}
