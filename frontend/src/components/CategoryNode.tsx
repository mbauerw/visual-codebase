import { memo } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import {
  Monitor,
  Server,
  Layers,
  Cog,
  Box,
  Settings,
  TestTube,
  FileCode,
} from 'lucide-react';
import { categoryColors, roleColors, roleLabels } from '../types';
import type { ArchitecturalRole } from '../types';

export interface CategoryNodeData extends Record<string, unknown> {
  label: string;
  category: 'frontend' | 'backend';
  role?: ArchitecturalRole; // If present, this is a role-level category
  width: number;
  height: number;
  nodeCount: number;
  level: 'top' | 'role'; // Category level
}

export type CategoryNodeType = Node<CategoryNodeData, 'category'>;

// Icons for each role
const roleIcons: Record<ArchitecturalRole, React.ReactNode> = {
  react_component: <Layers size={14} />,
  utility: <Cog size={14} />,
  api_service: <Box size={14} />,
  model: <Box size={14} />,
  config: <Settings size={14} />,
  test: <TestTube size={14} />,
  hook: <Layers size={14} />,
  context: <Layers size={14} />,
  store: <Box size={14} />,
  middleware: <Box size={14} />,
  controller: <Box size={14} />,
  router: <Box size={14} />,
  schema: <Box size={14} />,
  unknown: <FileCode size={14} />,
};

function CategoryNode({ data, selected }: NodeProps<CategoryNodeType>) {
  const isTopLevel = data.level === 'top';

  // Determine colors based on level
  const baseColor = isTopLevel
    ? (data.category === 'frontend' ? categoryColors.frontend : categoryColors.backend)
    : (data.role ? roleColors[data.role] : '#6b7280');

  // Top-level icons
  const TopIcon = data.category === 'frontend' ? Monitor : Server;

  // Get the appropriate icon
  const Icon = isTopLevel ? TopIcon : (data.role ? () => roleIcons[data.role!] : TopIcon);

  return (
    <div
      className={`
        relative transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
      `}
      style={{
        width: isTopLevel ? data.width + 400 : data.width,
        height: isTopLevel ? data.height + 400 : data.height,
        backgroundColor: isTopLevel ? `${baseColor}05` : `${baseColor}08`,
        border: `2px ${isTopLevel ? 'dashed' : 'solid'} ${baseColor}`,
        borderRadius: isTopLevel ? '50%' : '20px',
        boxShadow: isTopLevel
          ? `0 0 40px ${baseColor}10`
          : `0 0 20px ${baseColor}15`,
      }}
    >
      {/* Header label */}
      <div
        className={`
          absolute flex items-center gap-2 rounded-full
          ${isTopLevel ? '-top-4 left-1/2 -translate-x-1/2 px-5 py-2' : '-top-3 left-4 px-3 py-1.5'}
        `}
        style={{
          backgroundColor: '#0f172a',
          border: `2px solid ${baseColor}`,
        }}
      >
        {isTopLevel ? (
          <TopIcon size={18} color={baseColor} />
        ) : (
          <span style={{ color: baseColor }}>{data.role && roleIcons[data.role]}</span>
        )}
        <span
          className={`font-semibold ${isTopLevel ? 'text-2xl' : 'text-lg'}`}
          style={{ color: baseColor }}
        >
          {data.label}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full ml-1 ${isTopLevel ? 'text-xs' : 'text-[10px]'}`}
          style={{
            backgroundColor: `${baseColor}20`,
            color: baseColor,
          }}
        >
          {data.nodeCount}
        </span>
      </div>
    </div>
  );
}

export default memo(CategoryNode);
