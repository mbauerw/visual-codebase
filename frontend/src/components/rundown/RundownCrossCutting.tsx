import { useState, useCallback } from 'react';
import { Route } from 'lucide-react';
import type { RundownCrossCutting as RundownCrossCuttingType } from '../../types';

interface RundownCrossCuttingProps {
  crossCutting: RundownCrossCuttingType[];
  onFileClick?: (filePath: string) => void;
}

export default function RundownCrossCutting({
  crossCutting,
  onFileClick,
}: RundownCrossCuttingProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHoveringBg, setIsHoveringBg] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const isOverCard = !!(e.target as HTMLElement).closest('[data-concern-card]');
    setIsHoveringBg(!isOverCard);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHoveringBg(false);
  }, []);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`bg-gradient-to-r border border-indigo-200 rounded-xl p-6 cursor-pointer transition-colors duration-200 ${
        isHoveringBg ? 'from-indigo-50/50 to-blue-50/50' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Route size={20} className="text-black flex-shrink-0" />
        <h3 className="text-xl font-semibold text-slate-900">Cross-Cutting Concerns</h3>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-500 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className={`overflow-hidden bg-white transition-all duration-500 ease-in-out ${isExpanded ? 'mt-6 p-4' : 'mt-0'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {crossCutting.map((concern) => (
              <div
                key={concern.name}
                data-concern-card
                className="bg-amber-50 border border-amber-200 rounded-lg p-4"
              >
                <h4 className="text-sm font-semibold text-amber-900 mb-1">{concern.name}</h4>
                <p className="text-sm text-amber-800 mb-2">{concern.description}</p>
                {concern.files.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {concern.files.map((file) => (
                      <button
                        key={file}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileClick?.(file);
                        }}
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
        </div>
      </div>
    </div>
  );
}
