import { useState, useCallback } from 'react';
import { ChevronDown, Route } from 'lucide-react';
import type { RundownLayer } from '../../types';
import { roleColors } from '../../types';
import type { ArchitecturalRole } from '../../types';

const LAYER_COLORS = [
  { bg: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700', hover: 'hover:bg-sky-100' },
  { bg: 'bg-indigo-50', border: 'border-l-indigo-500', text: 'text-indigo-700', hover: 'hover:bg-indigo-100' },
  { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-700', hover: 'hover:bg-violet-100' },
  { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
  { bg: 'bg-fuchsia-50', border: 'border-l-fuchsia-500', text: 'text-fuchsia-700', hover: 'hover:bg-fuchsia-100' },
  { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', hover: 'hover:bg-rose-100' },
];

interface RundownLayersProps {
  layers: RundownLayer[];
  onLayerClick?: (roles: string[]) => void;
  onFileClick?: (filePath: string) => void;
}

export default function RundownLayers({ layers, onLayerClick, onFileClick }: RundownLayersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHoveringBg, setIsHoveringBg] = useState(false);
  const sorted = [...layers].sort((a, b) => a.order - b.order);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const isOverLayer = !!(e.target as HTMLElement).closest('li');
    setIsHoveringBg(!isOverLayer);
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
        isHoveringBg
          ? 'from-indigo-50/50 to-blue-50/50'
          : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Route size={20} className="text-black flex-shrink-0" />
        <h3 className="text-xl font-semibold text-slate-900">Architecture Layers</h3>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-500 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className={`overflow-hidden bg-white  transition-all duration-500 ease-in-out ${isExpanded ? 'mt-6 p-4' : 'mt-0'}`}>
          <ol className="space-y-3">
            {sorted.map((layer, index) => {
              const colors = LAYER_COLORS[index % LAYER_COLORS.length];
              return (
                <li
                  key={layer.id}
                  className={`${colors.bg} border-l-4 ${colors.border} rounded-r-lg p-4 transition-colors ${
                    onLayerClick ? `${colors.hover} cursor-pointer` : ''
                  }`}
                  aria-label={`Layer ${index + 1} of ${sorted.length}: ${layer.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerClick?.(layer.roles);
                  }}
                  role={onLayerClick ? 'button' : undefined}
                  tabIndex={onLayerClick ? 0 : undefined}
                  onKeyDown={onLayerClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onLayerClick(layer.roles);
                    }
                  } : undefined}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${colors.text}`}>
                      {layer.label}
                    </span>
                    {onLayerClick && (
                      <span className="text-xs text-slate-400">
                        Click to filter
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{layer.description}</p>

                  {layer.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {layer.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${roleColors[role as ArchitecturalRole] || '#6b7280'}20`,
                            color: roleColors[role as ArchitecturalRole] || '#6b7280',
                          }}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}

                  {layer.key_files.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {layer.key_files.map((file) => (
                        <button
                          key={file}
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileClick?.(file);
                          }}
                          className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
