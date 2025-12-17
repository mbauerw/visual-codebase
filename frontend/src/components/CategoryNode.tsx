import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Monitor, Server } from 'lucide-react';
import { categoryColors } from '../types';

export interface CategoryNodeData extends Record<string, unknown> {
  label: string;
  category: 'frontend' | 'backend';
  width: number;
  height: number;
  nodeCount: number;
}

export type CategoryNodeType = Node<CategoryNodeData, 'category'>;

function CategoryNode({ data, selected }: NodeProps<CategoryNodeType>) {
  const color = data.category === 'frontend' ? categoryColors.frontend : categoryColors.backend;
  const Icon = data.category === 'frontend' ? Monitor : Server;

  return (
    <div
      className={`
        relative rounded-[40px] transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
      `}
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: `${color}08`,
        border: `2px dashed ${color}`,
        boxShadow: `0 0 30px ${color}15`,
      }}
    >
      {/* Header label */}
      <div
        className="absolute -top-3 left-6 flex items-center gap-2 px-4 py-1.5 rounded-full"
        style={{
          backgroundColor: '#0f172a',
          border: `2px solid ${color}`,
        }}
      >
        <Icon size={18} color={color} />
        <span
          className="font-semibold text-sm"
          style={{ color }}
        >
          {data.label}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-1"
          style={{
            backgroundColor: `${color}20`,
            color,
          }}
        >
          {data.nodeCount} files
        </span>
      </div>

      {/* Connection handles for cross-category edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !border-2"
        style={{
          backgroundColor: color,
          borderColor: '#0f172a',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !border-2"
        style={{
          backgroundColor: color,
          borderColor: '#0f172a',
        }}
      />
    </div>
  );
}

export default memo(CategoryNode);
