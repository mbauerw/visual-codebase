import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ReactFlowEdgeData, Language } from '../types';
import { languageColors } from '../types';

interface ImportEdgeProps extends EdgeProps {
  data?: ReactFlowEdgeData;
}

// Short language labels for cross-language indicator
const languageShortLabels: Record<Language, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'Py',
  java: 'Java',
  csharp: 'C#',
  unknown: '?',
};

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
  const isCrossLanguage = data?.is_cross_language || false;
  const sourceLanguage = data?.source_language || 'unknown';
  const targetLanguage = data?.target_language || 'unknown';

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

  // Cross-language indicator
  const crossLangLabel = isCrossLanguage
    ? `${languageShortLabels[sourceLanguage]} → ${languageShortLabels[targetLanguage]}`
    : null;

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
      {(label || isCrossLanguage) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan flex flex-col items-center gap-0.5"
          >
            {isCrossLanguage && (
              <div
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-amber-950 border border-amber-400"
                title={`Cross-language: ${sourceLanguage} to ${targetLanguage}`}
              >
                {crossLangLabel}
              </div>
            )}
            {label && (
              <div
                className={`
                  px-2 py-1 rounded text-xs font-mono
                  ${isCrossLanguage
                    ? 'bg-amber-900/90 border border-amber-600 text-amber-100 hover:bg-amber-800'
                    : 'bg-slate-800/90 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}
                  transition-colors cursor-pointer
                  max-w-[150px] truncate
                  ${selected ? 'ring-2 ring-blue-400 bg-slate-700' : ''}
                `}
                title={hasImports ? importedNames.join(', ') : data?.module_path || ''}
              >
                {label}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
