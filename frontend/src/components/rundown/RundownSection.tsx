import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
}

export default function RundownSection({ rundown, onFileClick, onLayerClick }: RundownSectionProps) {
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [isFlowsExpanded, setIsFlowsExpanded] = useState(true);

  const activeFlow = rundown.flows[activeFlowIndex];

  return (
    <section aria-label="The Rundown - Application Flow Analysis">
      {/* Overarching collapse toggle */}
      <button
        onClick={() => setIsSectionExpanded(!isSectionExpanded)}
        className="flex items-center gap-2 cursor-pointer group w-full text-left mb-6"
      >
        <span className="text-sm font-medium text-slate-500">
          {isSectionExpanded ? 'Collapse all' : 'Expand all'}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-300 ${
            isSectionExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

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
              <div>
                <button
                  onClick={() => setIsFlowsExpanded(!isFlowsExpanded)}
                  className="flex items-center gap-2 mb-3 cursor-pointer group w-full text-left"
                >
                  <h3 className="text-sm font-semibold text-slate-900">Application Flows</h3>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-300 ${
                      isFlowsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-in-out"
                  style={{ gridTemplateRows: isFlowsExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    {/* Flow tab selector */}
                    {rundown.flows.length > 1 && (
                      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                        {rundown.flows.map((flow, index) => (
                          <button
                            key={flow.id}
                            role="tab"
                            aria-selected={index === activeFlowIndex}
                            aria-controls={`flow-panel-${flow.id}`}
                            onClick={() => setActiveFlowIndex(index)}
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
