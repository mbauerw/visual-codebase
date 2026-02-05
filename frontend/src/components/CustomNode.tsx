import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { FileCode, Settings, TestTube, Layers, Box, Cog, Database, Archive, AlertTriangle, ListOrdered, FileType, AtSign, Puzzle, CircleDot, Link } from 'lucide-react';
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
  // Java/C# specific roles
  entity: <Database size={14} />,
  repository: <Archive size={14} />,
  service: <Cog size={14} />,
  dto: <Box size={14} />,
  exception: <AlertTriangle size={14} />,
  enum_type: <ListOrdered size={14} />,
  interface: <FileType size={14} />,
  annotation: <AtSign size={14} />,
  // C# specific roles
  extension: <Puzzle size={14} />,
  record: <CircleDot size={14} />,
  delegate: <Link size={14} />,
  // Go specific roles
  go_handler: <Box size={14} />,
  go_middleware: <Box size={14} />,
  go_repository: <Archive size={14} />,
  go_service: <Cog size={14} />,
  go_model: <Database size={14} />,
  go_cmd: <FileCode size={14} />,
  go_pkg: <Box size={14} />,
  go_internal: <Box size={14} />,
  go_transport: <Box size={14} />,
  go_config: <Settings size={14} />,
  go_util: <Cog size={14} />,
  // Rust specific roles
  rust_lib: <Box size={14} />,
  rust_bin: <FileCode size={14} />,
  rust_mod: <Box size={14} />,
  rust_trait: <FileType size={14} />,
  rust_impl: <Box size={14} />,
  rust_handler: <Box size={14} />,
  rust_error: <AlertTriangle size={14} />,
  rust_macro: <AtSign size={14} />,
  rust_types: <FileType size={14} />,
  rust_tests: <TestTube size={14} />,
  // Swift/iOS specific roles
  swift_view_controller: <Layers size={14} />,
  swift_ui_view: <Layers size={14} />,
  swift_app_delegate: <Box size={14} />,
  swift_protocol: <FileType size={14} />,
  swift_extension: <Puzzle size={14} />,
  swift_coordinator: <Box size={14} />,
  swift_view_model: <Box size={14} />,
  swift_data_source: <Database size={14} />,
  swift_network_service: <Box size={14} />,
  swift_core_data: <Database size={14} />,
  swift_observable: <CircleDot size={14} />,
  unknown: <FileCode size={14} />,
};

function CustomNode({ data, selected }: NodeProps<CustomNodeType>) {
  const roleColor = roleColors[data.role] || roleColors.unknown;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const borderColor = '#7d7d7de9';

  // Get scale tier from data (based on dependency count percentile within role)
  // Top 10% = 1.5, Next 25% = 1.25, Bottom 65% = 1.0
  const baseScale = data.scaleTier ?? 1;

  // Combine base scale with interaction states
  const getScale = () => {
    if (selected) return Math.max(baseScale * 1.1, 1.2); // Selected: at least 1.2
    return baseScale;
  };

  return (
    <div
      className={`
        relative px-3 py-4 rounded-lg min-w-[240px] max-w-[320px]
        transition-all duration-300 hover:brightness-110
        ${selected ? 'ring-8 ring-amber-500 shadow-xl shadow-amber-500 ring-offset-2 ring-offset-amber-900' : ''}
      `}
      style={{
        backgroundColor: '#1e293b',
        borderLeft: `4px solid ${borderColor}`,
        transform: `scale(${getScale()})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Source handle - exports leave from top */}
      <Handle
        type="source"
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

      {/* Target handle - imports enter from bottom */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-700"
      />
    </div>
  );
}

export default memo(CustomNode);