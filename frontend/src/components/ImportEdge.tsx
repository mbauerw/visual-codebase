import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ReactFlowEdgeData } from '../types';

interface ImportEdgeProps extends EdgeProps {
  data?: ReactFlowEdgeData;
}

export default function ImportEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: ImportEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const importedNames = data?.imported_names || [];
  const hasImports = importedNames.length > 0;

  // Format label text
  const formatLabel = () => {
    if (!hasImports) {
      return data?.module_path || '';
    }

    if (importedNames.length === 1) {
      const name = importedNames[0];
      return name.length <= 18 ? name : name.slice(0, 15) + '...';
    } else if (importedNames.length === 2) {
      return importedNames.join(', ');
    } else {
      return `${importedNames[0]}, +${importedNames.length - 1}`;
    }
  };

  const label = formatLabel();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : (style.strokeWidth as number) || 1.5,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={`
                px-2 py-1 rounded text-xs font-mono
                bg-slate-800/90 border border-slate-600
                text-slate-300 hover:bg-slate-700 hover:text-white
                transition-colors cursor-pointer
                max-w-[150px] truncate
                ${selected ? 'ring-2 ring-blue-400 bg-slate-700' : ''}
              `}
              title={hasImports ? importedNames.join(', ') : data?.module_path || ''}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
