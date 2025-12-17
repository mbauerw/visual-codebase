import { memo } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
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
import { categoryColors, roleColors } from '../types';
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

  // For circular containers, use the larger dimension to make it a proper circle
  const circleSize = isTopLevel ? Math.max(data.width, data.height) : null;

  return (
    <>
      {/* Resizer handles */}
      <NodeResizer
        color={baseColor}
        isVisible={selected}
        minWidth={isTopLevel ? 400 : 250}
        minHeight={isTopLevel ? 400 : 150}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: baseColor,
          border: '2px solid #0f172a',
        }}
        lineStyle={{
          borderColor: baseColor,
          borderWidth: 2,
        }}
      />

      <div
        className={`
          relative transition-all duration-200
          ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
        `}
        style={{
          width: isTopLevel ? circleSize : data.width,
          height: isTopLevel ? circleSize : data.height,
          backgroundColor: isTopLevel ? `${baseColor}08` : `${baseColor}10`,
          border: `3px ${isTopLevel ? 'dashed' : 'solid'} ${baseColor}`,
          borderRadius: isTopLevel ? '50%' : '24px',
          boxShadow: isTopLevel
            ? `0 0 60px 20px ${baseColor}20, inset 0 0 60px ${baseColor}10`
            : `0 0 30px 5px ${baseColor}15`,
        }}
      >
        {/* Header label - positioned at top center for circles */}
        <div
          className={`
            absolute flex items-center gap-2 rounded-full
            ${isTopLevel
              ? 'left-1/2 -translate-x-1/2 -top-5 px-6 py-2.5'
              : '-top-3 left-4 px-3 py-1.5'}
          `}
          style={{
            backgroundColor: '#0f172a',
            border: `2px solid ${baseColor}`,
            boxShadow: `0 0 15px ${baseColor}30`,
          }}
        >
          {isTopLevel ? (
            <TopIcon size={20} color={baseColor} />
          ) : (
            <span style={{ color: baseColor }}>{data.role && roleIcons[data.role]}</span>
          )}
          <span
            className={`font-semibold ${isTopLevel ? 'text-base' : 'text-xs'}`}
            style={{ color: baseColor }}
          >
            {data.label}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full ml-1 ${isTopLevel ? 'text-sm' : 'text-[10px]'}`}
            style={{
              backgroundColor: `${baseColor}25`,
              color: baseColor,
            }}
          >
            {data.nodeCount}
          </span>
        </div>
      </div>
    </>
  );
}

export default memo(CategoryNode);
