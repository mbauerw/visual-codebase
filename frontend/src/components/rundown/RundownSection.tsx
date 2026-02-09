import { useState, useCallback } from 'react';
import { Route } from 'lucide-react';
import type { CodebaseRundown } from '../../types';
import RundownNarrative from './RundownNarrative';
import RundownLayers from './RundownLayers';
import RundownFlowTimeline from './RundownFlowTimeline';
import RundownFlowDiagram from './RundownFlowDiagram';
import RundownCrossCutting from './RundownCrossCutting';

interface RundownSectionProps {
  rundown: CodebaseRundown;
  onFileClick?: (filePath: string) => void;
  onLayerClick?: (roles: string[]) => void;
  isSectionExpanded?: boolean;
}

export default function RundownSection({ rundown, onFileClick, onLayerClick, isSectionExpanded }: RundownSectionProps) {
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const [isFlowsExpanded, setIsFlowsExpanded] = useState(true);
  const [isFlowsHoveringBg, setIsFlowsHoveringBg] = useState(false);

  const handleFlowsMouseMove = useCallback((e: React.MouseEvent) => {
    const isOverInteractive = !!(e.target as HTMLElement).closest('[data-flow-interactive]');
    setIsFlowsHoveringBg(!isOverInteractive);
  }, []);

  const handleFlowsMouseLeave = useCallback(() => {
    setIsFlowsHoveringBg(false);
  }, []);

  const activeFlow = rundown.flows[activeFlowIndex];

  return (
    <section aria-label="The Rundown - Application Flow Analysis" className="bg-slate-700 w-full px-8">

      <div
        className="grid transition-[grid-template-rows] duration-500 ease-in-out"
        style={{ gridTemplateRows: isSectionExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-4">
            {/* Narrative */}
            {rundown.narrative && <RundownNarrative narrative={rundown.narrative} />}

            {/* Layers */}
            {rundown.layers.length > 0 && (
              <RundownLayers
                layers={rundown.layers}
                onLayerClick={onLayerClick}
                onFileClick={onFileClick}
              />
            )}

            {/* Flows */}
            {rundown.flows.length > 0 && (
              <div
                onClick={() => setIsFlowsExpanded(!isFlowsExpanded)}
                onMouseMove={handleFlowsMouseMove}
                onMouseLeave={handleFlowsMouseLeave}
                className={`bg-gradient-to-r border border-indigo-200 rounded-xl p-6 cursor-pointer transition-colors duration-200 ${
                  isFlowsHoveringBg ? 'from-indigo-50/50 to-blue-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Route size={20} className="text-black flex-shrink-0" />
                  <h3 className="text-xl font-semibold text-slate-900">Application Flows</h3>
                </div>

                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-in-out"
                  style={{ gridTemplateRows: isFlowsExpanded ? '1fr' : '0fr' }}
                >
                  <div className={`overflow-hidden bg-white transition-all duration-500 ease-in-out ${isFlowsExpanded ? 'mt-6 p-4' : 'mt-0'}`}>
                    {/* Flow tab selector */}
                    {rundown.flows.length > 1 && (
                      <div className="flex flex-wrap gap-2 mb-4" role="tablist" data-flow-interactive>
                        {rundown.flows.map((flow, index) => (
                          <button
                            key={flow.id}
                            role="tab"
                            aria-selected={index === activeFlowIndex}
                            aria-controls={`flow-panel-${flow.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFlowIndex(index);
                            }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                              index === activeFlowIndex
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {flow.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active flow content */}
                    {activeFlow && (
                      <div
                        role="tabpanel"
                        id={`flow-panel-${activeFlow.id}`}
                        data-flow-interactive
                      >
                        {/* Desktop: Flow diagram */}
                        <div className="hidden sm:block">
                          <RundownFlowDiagram
                            flow={activeFlow}
                            layers={rundown.layers}
                            entryPoints={rundown.entry_points}
                            onFileClick={onFileClick}
                          />
                        </div>

                        {/* Mobile: Flow timeline */}
                        <div className="block sm:hidden bg-white border border-slate-200 rounded-xl p-5">
                          <h4 className="text-sm font-semibold text-slate-800 mb-2">{activeFlow.name}</h4>
                          <RundownFlowTimeline
                            flow={activeFlow}
                            layers={rundown.layers}
                            onFileClick={onFileClick}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cross-cutting concerns */}
            {rundown.cross_cutting.length > 0 && (
              <RundownCrossCutting crossCutting={rundown.cross_cutting} onFileClick={onFileClick} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
