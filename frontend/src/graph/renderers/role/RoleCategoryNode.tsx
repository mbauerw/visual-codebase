/**
 * RoleCategoryNode — role container box for the role layout (port of the
 * `level === 'role'` branch of components/CategoryNode.tsx).
 *
 * The wrapper is interactive: a click anywhere on the box (or the header pill)
 * fires `onNodeClick(node)`, and with the canvas's `nodesDraggable` the box is
 * the drag surface for moving the category. This root div keeps
 * `pointer-events: none` so the wrapper itself is the event target; the pill
 * re-enables pointer events for its hover scale + pointer cursor.
 *
 * LOD: `far` drops the role icon from the header pill (label + count only —
 * the icon is a 50px SVG that is pure noise at that size); mid/near are identical.
 * Theme tokens: `radius` (container corner radius, default 24), `surface` /
 * `border` (default: role colour tint / role colour).
 */

import type { NodeRenderProps } from '../../core/types';
import type { RoleCategoryNodeData } from '../../theme/roleTheme';
import { roleColors } from '../../../types';
import { roleIconComponents } from '../../../utils/roleIcons';

const DEFAULT_RADIUS = 24;

export function RoleCategoryNode({ node, lod, theme }: NodeRenderProps<RoleCategoryNodeData>) {
  const data = node.data;
  const baseColor = data.role ? roleColors[data.role] ?? '#6b7280' : '#6b7280';
  const Icon = data.role ? roleIconComponents[data.role] : undefined;

  return (
    <div
      data-testid="role-category-node"
      data-lod={lod}
      className="w-full h-full pointer-events-none transition-[box-shadow] duration-300 group"
      style={{
        backgroundColor: theme.surface ?? `${baseColor}40`,
        border: `3px solid ${theme.border ?? baseColor}`,
        borderRadius: theme.radius ?? DEFAULT_RADIUS,
        boxShadow: `0 0 30px 5px ${baseColor}15`,
      }}
    >
      {/* Header label */}
      <div
        data-testid="role-category-pill"
        className="absolute -top-8 left-[60px] flex items-center gap-5 rounded-full px-3 py-1.5 transition-transform duration-800 hover:scale-[1.1] cursor-pointer"
        style={{
          pointerEvents: 'auto',
          backgroundColor: '#0f172a',
          border: `2px solid ${baseColor}`,
          boxShadow: `0 0 15px ${baseColor}30`,
        }}
      >
        {lod !== 'far' && Icon && (
          <span style={{ color: baseColor }}>
            <Icon size={50} />
          </span>
        )}
        <span
          className={`font-semibold ${data.label === 'API Service' ? 'text-[65px]' : 'text-7xl'}`}
          style={{ color: theme.text ?? baseColor }}
        >
          {data.label}
        </span>
        <span
          className="px-5 py-0.5 rounded-full ml-1 text-5xl"
          style={{ backgroundColor: `${baseColor}25`, color: baseColor }}
        >
          {data.nodeCount}
        </span>
      </div>
    </div>
  );
}
