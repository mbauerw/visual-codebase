import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { FileCode, Settings, TestTube, Layers, Box, Cog } from 'lucide-react';
import type { ReactFlowNodeData, ArchitecturalRole } from '../types';
import { roleColors, languageColors, roleLabels } from '../types';

// Define the custom node type for React Flow v12
export type CustomNodeType = Node<ReactFlowNodeData, 'custom'>;

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

function CustomNode({ data, selected }: NodeProps<CustomNodeType>) {
  const roleColor = roleColors[data.role] || roleColors.unknown;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const borderColor = '#7d7d7de9' ;

  return (
    <div
      className={`
        relative px-3 py-4 rounded-lg shadow-lg min-w-[240px] max-w-[320px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
      `}
      style={{
        backgroundColor: '#1e293b',
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-700"
      />

      {/* Header with file name */}
      <div className="flex justify-center items-center gap-2 mb-1">
        <span style={{ color: langColor }}>{roleIcons[data.role]}</span>
        <span className="text-2xl font-medium text-white truncate" title={data.label}>
          {data.label}
        </span>
      </div>

      {/* Role badge */}
      <div className="flex items-center justify-center gap-3 mb-1">
        <span
          className="text-md px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${roleColor}20`,
            color: roleColor,
          }}
        >
          {roleLabels[data.role]}
        </span>
        <span
          className="text-md px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${langColor}20`,
            color: langColor,
          }}
        >
          {data.language}
        </span>
      </div>

      {/* Description */}
      {/* {data.description && (
        <p
          className="text-md text-slate-400 line-clamp-2 mt-1"
          title={data.description}
        >
          {data.description}
        </p>
      )} */}

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-700"
      />
    </div>
  );
}

export default memo(CustomNode);