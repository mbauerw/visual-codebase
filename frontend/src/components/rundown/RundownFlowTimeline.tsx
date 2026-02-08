import type { RundownFlow, RundownLayer } from '../../types';

const STEP_COLORS = [
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-rose-500',
];

interface RundownFlowTimelineProps {
  flow: RundownFlow;
  layers: RundownLayer[];
  onFileClick?: (filePath: string) => void;
}

export default function RundownFlowTimeline({
  flow,
  layers,
  onFileClick,
}: RundownFlowTimelineProps) {
  // Build layer lookup for resolving layer_id -> label and order
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4 italic">{flow.description}</p>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-300" />

        <div className="space-y-6">
          {flow.steps.map((step, index) => {
            const layer = layerMap.get(step.layer_id);
            const colorClass = STEP_COLORS[index % STEP_COLORS.length];

            return (
              <div key={index} className="relative">
                {/* Dot */}
                <div
                  className={`absolute left-[-19px] top-1 w-4 h-4 rounded-full ${colorClass} border-2 border-white shadow-sm`}
                />

                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {layer?.label || step.layer_id}
                  </span>
                  <p className="text-sm text-slate-700 mt-0.5">{step.action}</p>

                  {step.key_files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {step.key_files.map((file) => (
                        <button
                          key={file}
                          onClick={() => onFileClick?.(file)}
                          className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
