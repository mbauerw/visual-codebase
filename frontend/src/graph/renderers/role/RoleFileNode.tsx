/**
 * RoleFileNode — file box for the role layout (port of components/CustomNode.tsx).
 *
 * Structure (the wrapper owns position/size and is the hit area):
 *
 *   <motion.div root>       fills the slot; animates the VISUAL scale (scaleTier +
 *                           selection bump) about the slot centre
 *     <motion.div surface>  the tile: theme surface/border/radius/text tokens, the
 *                           highlight ring, and `whileHover` (kept on its own element
 *                           so the hover scale composes with the root scale instead
 *                           of overwriting it — framer merges `scale` per element)
 *
 * Level of detail (`lod`, from on-screen width, see theme.lod):
 *   far  → the tile only, with a role-coloured bar (no children at all)
 *   mid  → icon + file name
 *   near → icon + file name + role/language pills (pill row fades via AnimatePresence)
 *
 * No React Flow handles: edges anchor to the slot edges (see edges/anchors.ts).
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { NodeRenderProps } from '../../core/types';
import type { ReactFlowNodeData } from '../../../types';
import { languageColors, roleColors, roleLabels } from '../../../types';
import { roleIconComponents } from '../../../utils/roleIcons';

/** CustomNode.getScale: selected/tierlist → at least 1.2 (base × 1.1), else the base tier scale. */
export function getRoleFileVisualScale(baseScale: number, highlight: NodeRenderProps['highlight']): number {
  if (highlight === 'selected' || highlight === 'tierlist') return Math.max(baseScale * 1.1, 1.2);
  return baseScale;
}

/** Fallbacks when the theme has no token (today's values). */
const DEFAULT_SURFACE = '#1e293b';
const DEFAULT_BORDER = '#7d7d7de9';
const DEFAULT_TEXT = '#ffffff';
const DEFAULT_RADIUS = 8;

/** Pill row fade: opacity/y only (never layout), short so zooming feels snappy. */
const PILL_TRANSITION = { duration: 0.18, ease: 'easeOut' } as const;
const PILL_HIDDEN = { opacity: 0, y: 4 } as const;
const PILL_SHOWN = { opacity: 1, y: 0 } as const;

export function RoleFileNode({ node, highlight, lod, theme }: NodeRenderProps<ReactFlowNodeData>) {
  const data = node.data;
  const roleColor = roleColors[data.role] || roleColors.unknown;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const Icon = roleIconComponents[data.role] ?? roleIconComponents.unknown;
  const visualScale = getRoleFileVisualScale(node.scale ?? 1, highlight);
  const ring = theme.ring[highlight] ?? '';
  const isFar = lod === 'far';

  return (
    <motion.div
      data-testid="role-file-node"
      data-lod={lod}
      className="w-full h-full"
      style={{ transformOrigin: 'center center' }}
      initial={false}
      animate={{ scale: visualScale }}
      transition={theme.motion?.transition}
    >
      <motion.div
        data-testid="role-file-node-surface"
        className={`w-full h-full flex flex-col justify-center overflow-hidden transition-[box-shadow,filter] duration-300 hover:brightness-110 ${ring}`}
        style={{
          backgroundColor: theme.surface ?? DEFAULT_SURFACE,
          // far: the accent becomes a wide role-coloured bar — the only thing that
          // still reads at < ~40 screen px; mid/near: the thin neutral accent of CustomNode
          borderLeft: isFar ? `14px solid ${roleColor}` : `4px solid ${theme.border ?? DEFAULT_BORDER}`,
          borderRadius: theme.radius ?? DEFAULT_RADIUS,
          color: theme.text ?? DEFAULT_TEXT,
        }}
        whileHover={theme.motion?.whileHover}
        transition={theme.motion?.transition}
      >
        {!isFar && (
          <div className="flex justify-center items-center gap-2 px-3">
            <span className="shrink-0 flex items-center" style={{ color: langColor }}>
              <Icon size={14} />
            </span>
            <span className="text-2xl font-medium truncate" title={data.label}>
              {data.label}
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {lod === 'near' && (
            <motion.div
              key="pills"
              data-testid="role-file-node-pills"
              className="flex items-center justify-center gap-3 mt-1 px-3"
              initial={PILL_HIDDEN}
              animate={PILL_SHOWN}
              exit={PILL_HIDDEN}
              transition={PILL_TRANSITION}
            >
              <span
                className="text-md px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: `${roleColor}20`, color: roleColor }}
              >
                {roleLabels[data.role] ?? data.role}
              </span>
              <span
                className="text-md px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: `${langColor}20`, color: langColor }}
              >
                {data.language}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
