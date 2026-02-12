import { memo } from 'react';
import { type NodeProps, type Node, Handle, Position } from '@xyflow/react';
import { Folder } from 'lucide-react';
import { roleColors } from '../types';
import type { ArchitecturalRole, ReactFlowNodeData } from '../types';
import { roleIconComponents } from '../utils/roleIcons';

export interface CategoryNodeData extends Record<string, unknown> {
  label: string;
  category: 'frontend' | 'backend' | 'test' | 'folder';
  role?: ArchitecturalRole;
  width: number;
  height: number;
  nodeCount: number;
  level: 'top' | 'role' | 'folder';
  depth?: number; // For folder hierarchy depth coloring
}

export interface CategoryRoleData extends Record<string, unknown> {
  label: string;
  role: ArchitecturalRole;
  nodeCount: number;
  description: string;
  files?: ReactFlowNodeData[];
}

export type CategoryNodeType = Node<CategoryNodeData, 'category'>;

// Folder colors based on depth
const folderColors = [
  '#f59e0b', // amber - root
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];



function CategoryNode({ data, selected }: NodeProps<CategoryNodeType>) {
  if (data.level === 'folder') {
    const depth = data.depth || 0;
    const baseColor = folderColors[depth % folderColors.length];

    return (
      <div
        className={`
          relative transition-all duration-200 group z-2
          ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
        `}
        style={{
          width: data.width ,
          height: data.height,
          backgroundColor: `${baseColor}15`,
          border: `2px solid ${baseColor}60`,
          borderRadius: '16px',
          boxShadow: `0 0 20px 3px ${baseColor}10`,
        }}
      >
        {/* Hidden handles for edge connections */}
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />

        {/* Folder header label */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-3 py-1 hover:scale-[1.1] cursor-pointer"
          style={{
            pointerEvents: 'auto',
            backgroundColor: '#1e293b',
            border: `2px solid ${baseColor}`,
            boxShadow: `0 0 10px ${baseColor}30`,
          }}
        >
          <Folder size={26} style={{ color: baseColor }} />
          <span
            className="font-medium text-3xl"
            style={{ color: baseColor }}
          >
            {data.label}
          </span>
          {data.nodeCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: `${baseColor}25`,
                color: baseColor,
              }}
            >
              {data.nodeCount}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Role-level categories (original behavior)
  const baseColor = data.role ? roleColors[data.role] : '#6b7280';

  return (
    <div
      className={`
        relative transition-all duration-800 group
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
      `}
      style={{
        width: data.width ,
        height: data.height,
        backgroundColor: `${baseColor}40`,
        border: `3px solid ${baseColor}`,
        borderRadius: '24px',
        boxShadow: `0 0 30px 5px ${baseColor}15`,
      }}
    >
      {/* Header label */}
      <div
        className="absolute -top-8 left-[60px] flex items-center gap-5 rounded-full px-3 py-1.5  transition-all duration-800 hover:scale-[1.1]"
        style={{
          pointerEvents: 'auto',
          backgroundColor: '#0f172a',
          border: `2px solid ${baseColor}`,
          boxShadow: `0 0 15px ${baseColor}30`,
        }}
      >
        <span style={{ color: baseColor }}>
          {data.role && (() => {
            const Icon = roleIconComponents[data.role!];
            return <Icon size={50} />;
          })()}
        </span>
        <span
          className={`font-semibold ${data.label == 'API Service' ? 'text-[65px]' : 'text-7xl' }  group-hover: `}
          style={{ color: baseColor }}
        >
          {data.label}
        </span>
        <span
          className="px-5 py-0.5 rounded-full ml-1 text-5xl"
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