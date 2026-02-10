import { useState } from 'react';
import { BookOpen, Layers, Route, Puzzle } from 'lucide-react';
import type { CodebaseRundown } from '../../types';
import { roleColors } from '../../types';
import type { ArchitecturalRole } from '../../types';
import RundownFlowTimeline from './RundownFlowTimeline';
import RundownFlowDiagram from './RundownFlowDiagram';

interface RundownSectionProps {
  rundown: CodebaseRundown;
  onFileClick?: (filePath: string) => void;
  onLayerClick?: (roles: string[]) => void;
  isSectionExpanded?: boolean;
}

const LAYER_COLORS = [
  { bg: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700', hover: 'hover:bg-sky-100' },
  { bg: 'bg-indigo-50', border: 'border-l-indigo-500', text: 'text-indigo-700', hover: 'hover:bg-indigo-100' },
  { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-700', hover: 'hover:bg-violet-100' },
  { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
  { bg: 'bg-fuchsia-50', border: 'border-l-fuchsia-500', text: 'text-fuchsia-700', hover: 'hover:bg-fuchsia-100' },
  { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', hover: 'hover:bg-rose-100' },
];

interface TabDef {
  id: string;
  label: string;
  summary: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function RundownSection({ rundown, onFileClick, onLayerClick, isSectionExpanded }: RundownSectionProps) {
  const tabs: TabDef[] = [
    ...(rundown.narrative ? [{
      id: 'overview',
      label: 'Overview',
      summary: 'High-level summary of how this codebase works',
      icon: BookOpen,
    }] : []),
    ...(rundown.layers.length > 0 ? [{
      id: 'layers',
      label: 'Layers',
      summary: 'Architecture layers and their responsibilities',
      icon: Layers,
    }] : []),
    ...(rundown.flows.length > 0 ? [{
      id: 'flows',
      label: 'Flows',
      summary: 'Application flow paths and data movement',
      icon: Route,
    }] : []),
    ...(rundown.cross_cutting.length > 0 ? [{
      id: 'cross-cutting',
      label: 'Cross-Cutting',
      summary: 'Shared concerns spanning multiple layers',
      icon: Puzzle,
    }] : []),
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'overview');
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const activeFlow = rundown.flows[activeFlowIndex];
  const sortedLayers = [...rundown.layers].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="The Rundown - Application Flow Analysis" className="bg-slate-700 w-full px-8">
      <div
        className="grid transition-[grid-template-rows] duration-500 ease-in-out"
        style={{ gridTemplateRows: isSectionExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex h-[600px] rounded-xl overflow-hidden border border-slate-600">
            {/* Tab sidebar */}
            <div className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-600 flex flex-col">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-4 border-b border-slate-700/50 transition-colors ${
                      isActive
                        ? 'bg-slate-700 border-l-2 border-l-blue-400'
                        : 'hover:bg-slate-700/50 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                      <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {tab.label}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                      {tab.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-auto bg-white">
              <div className="p-6">
                {/* Overview tab */}
                {activeTab === 'overview' && rundown.narrative && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">How This Codebase Works</h3>
                    <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
                      {rundown.narrative}
                    </p>
                  </div>
                )}

                {/* Layers tab */}
                {activeTab === 'layers' && rundown.layers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Architecture Layers</h3>
                    <ol className="space-y-3">
                      {sortedLayers.map((layer, index) => {
                        const colors = LAYER_COLORS[index % LAYER_COLORS.length];
                        return (
                          <li
                            key={layer.id}
                            className={`${colors.bg} border-l-4 ${colors.border} rounded-r-lg p-4 transition-colors ${
                              onLayerClick ? `${colors.hover} cursor-pointer` : ''
                            }`}
                            onClick={() => onLayerClick?.(layer.roles)}
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
                                <span className="text-xs text-slate-400">Click to filter</span>
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
                                    className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
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
                )}

                {/* Flows tab */}
                {activeTab === 'flows' && rundown.flows.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Application Flows</h3>
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
                    {activeFlow && (
                      <div role="tabpanel" id={`flow-panel-${activeFlow.id}`}>
                        <div className="hidden sm:block">
                          <RundownFlowDiagram
                            flow={activeFlow}
                            layers={rundown.layers}
                            entryPoints={rundown.entry_points}
                            onFileClick={onFileClick}
                          />
                        </div>
                        <div className="block sm:hidden">
                          <RundownFlowTimeline
                            flow={activeFlow}
                            layers={rundown.layers}
                            onFileClick={onFileClick}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cross-Cutting tab */}
                {activeTab === 'cross-cutting' && rundown.cross_cutting.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Cross-Cutting Concerns</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {rundown.cross_cutting.map((concern) => (
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
                                  className="font-mono text-xs text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
