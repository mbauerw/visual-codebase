/**
 * RoleSectionNode — Frontend/Backend/Test background ellipse for the role
 * layout (port of one section from components/Categorybackground.tsx).
 * Purely decorative: the whole node is `pointer-events: none`.
 */

import { FlaskConical, Monitor, Server, type LucideIcon } from 'lucide-react';
import type { NodeRenderProps } from '../../core/types';
import type { RoleSectionNodeData } from '../../theme/roleTheme';
import { categoryColors } from '../../../types';

const SECTION_ICONS: Record<RoleSectionNodeData['category'], LucideIcon> = {
  frontend: Monitor,
  backend: Server,
  test: FlaskConical,
};

export function RoleSectionNode({ node }: NodeRenderProps<RoleSectionNodeData>) {
  const data = node.data;
  const baseColor = data.color || categoryColors[data.category] || categoryColors.unknown;
  const Icon = SECTION_ICONS[data.category] ?? Server;

  return (
    <div data-testid="role-section-node" className="w-full h-full pointer-events-none">
      {/* Background ellipse */}
      <div
        className="w-full h-full rounded-[50%]"
        style={{
          backgroundColor: `${baseColor}06`,
          border: `3px dashed ${baseColor}40`,
          boxShadow: `0 0 80px 30px ${baseColor}15, inset 0 0 80px ${baseColor}08`,
        }}
      />

      {/* Header label */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-10 flex items-center gap-5 rounded-full px-6 py-2.5 whitespace-nowrap"
        style={{
          backgroundColor: '#0f172a',
          border: `2px solid ${baseColor}`,
          boxShadow: `0 0 20px ${baseColor}30`,
        }}
      >
        <Icon size={70} color={baseColor} />
        <span className="font-semibold text-[80px]" style={{ color: baseColor }}>
          {data.label}
        </span>
      </div>
    </div>
  );
}
