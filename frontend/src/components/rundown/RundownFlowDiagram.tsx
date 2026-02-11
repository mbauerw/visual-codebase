import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  RundownFlow,
  RundownLayer,
  RundownEntryPoint,
} from '../../types';
import { calculateRundownLayout } from './layoutUtils';
import LayerNode from './nodes/LayerNode';
import EntryPointNode from './nodes/EntryPointNode';

const nodeTypes: NodeTypes = {
  layer: LayerNode,
  entryPoint: EntryPointNode,
};

interface RundownFlowDiagramProps {
  flow: RundownFlow;
  layers: RundownLayer[];
  entryPoints: RundownEntryPoint[];
  onFileClick?: (filePath: string) => void;
}

function RundownFlowDiagramInner({
  flow,
  layers,
  entryPoints,
}: RundownFlowDiagramProps) {
  const { nodes, edges } = useMemo(
    () => calculateRundownLayout(flow, layers, entryPoints),
    [flow, layers, entryPoints]
  );

  return (
    <div
      className="h-[560px] w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
      aria-hidden="true"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        panOnDrag={true}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#f8fafc'}}
      />
    </div>
  );
}

export default function RundownFlowDiagram(props: RundownFlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <RundownFlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
