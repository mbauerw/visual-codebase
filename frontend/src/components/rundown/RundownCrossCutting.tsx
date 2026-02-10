import type { RundownCrossCutting as RundownCrossCuttingType } from '../../types';

interface RundownCrossCuttingProps {
  crossCutting: RundownCrossCuttingType[];
  onFileClick?: (filePath: string) => void;
}

export default function RundownCrossCutting({
  crossCutting,
  onFileClick,
}: RundownCrossCuttingProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {crossCutting.map((concern) => (
        <div
          key={concern.name}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <h4 className="text-sm font-semibold text-amber-900 mb-1">{concern.name}</h4>
          <p className="text-sm text-amber-800 mb-2">{concern.description}</p>
          {concern.files.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {concern.files.map((file) => (
                <button
                  key={file}
                  onClick={() => onFileClick?.(file)}
                  className="font-mono text-xs text-amber-700 hover:text-amber-900 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 rounded"
                >
                  {file}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
