import { memo } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import {
  Layers,
  Cog,
  Box,
  Settings,
  TestTube,
  FileCode,
} from 'lucide-react';
import { roleColors } from '../types';
import type { ArchitecturalRole } from '../types';

export interface CategoryNodeData extends Record<string, unknown> {
  label: string;
  category: 'frontend' | 'backend';
  role?: ArchitecturalRole;
  width: number;
  height: number;
  nodeCount: number;
  level: 'top' | 'role';
}

const iconSize = 20;

export type CategoryNodeType = Node<CategoryNodeData, 'category'>;

// Icons for each role
const roleIcons: Record<ArchitecturalRole, React.ReactNode> = {
  react_component: <Layers size={iconSize} />,
  utility: <Cog size={iconSize} />,
  api_service: <Box size={iconSize} />,
  model: <Box size={iconSize} />,
  config: <Settings size={iconSize} />,
  test: <TestTube size={iconSize} />,
  hook: <Layers size={iconSize} />,
  context: <Layers size={iconSize} />,
  store: <Box size={iconSize} />,
  middleware: <Box size={iconSize} />,
  controller: <Box size={iconSize} />,
  router: <Box size={iconSize} />,
  schema: <Box size={iconSize} />,
  unknown: <FileCode size={iconSize} />,
};

function CategoryNode({ data, selected }: NodeProps<CategoryNodeType>) {
  // This component now only handles role-level categories
  const baseColor = data.role ? roleColors[data.role] : '#6b7280';

  return (
    <div
      className={`
        relative transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
      `}
      style={{
        width: data.width + 150,
        height: data.height,
        backgroundColor: `${baseColor}40`,
        border: `3px solid ${baseColor}`,
        borderRadius: '24px',
        boxShadow: `0 0 30px 5px ${baseColor}15`,
      }}
    >
      {/* Header label */}
      <div
        className="absolute -top-3 left-4 flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          backgroundColor: '#0f172a',
          border: `2px solid ${baseColor}`,
          boxShadow: `0 0 15px ${baseColor}30`,
        }}
      >
        <span style={{ color: baseColor }} className='text-7xl'>
          {data.role && roleIcons[data.role]}
        </span>
        <span
          className="font-semibold text-2xl"
          style={{ color: baseColor }}
        >
          {data.label}
        </span>
        <span
          className="px-2 py-0.5 rounded-full ml-1 text-2xl"
          style={{
            backgroundColor: `${baseColor}25`,
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