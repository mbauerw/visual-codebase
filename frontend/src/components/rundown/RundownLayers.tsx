import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import type { RundownLayer, ReactFlowNode } from '../../types';
import { roleColors } from '../../types';
import type { ArchitecturalRole } from '../../types';
import LayerCategoryCarousel from './LayerCategoryCarousel';

interface RundownLayersProps {
  layers: RundownLayer[];
  graphNodes?: ReactFlowNode[];
  onFileClick?: (filePath: string) => void;
}

export default function RundownLayers({ layers, graphNodes, onFileClick }: RundownLayersProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = [...layers].sort((a, b) => a.order - b.order);

  const handleToggle = (id: string) => {
    setExpandedId(current => current === id ? null : id);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {sorted.map((layer, index) => {
        const isExpanded = expandedId === layer.id;

        return (
          <motion.div
            layout
            transition={{ duration: .7, ease: "easeInOut" }}
            key={layer.id}
            onClick={() => handleToggle(layer.id)}
            className={`
              relative group cursor-pointer overflow-hidden rounded-xl border bg-white
              ${isExpanded
                ? 'aspect-square border-indigo-200 shadow-xl ring-1 ring-indigo-500/10'
                : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
              }
            `}
            role="button"
            aria-expanded={isExpanded}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(layer.id);
              }
            }}
          >
            {/* layout="position" ensures the inner content stretches/moves smoothly 
               as the parent container resizes.
            */}
            <motion.div
              layout="position"
              transition={{ duration: .7, ease: "easeInOut" }}
              className={`flex h-full flex-col ${isExpanded ? 'p-8 justify-between' : 'p-5'}`}
            >

              {/* Header Section */}
              <div className="flex w-full items-start justify-between gap-4">

                {/* ANIMATED HEADER CONTAINER 
                   We switch flex alignment from 'start' to 'center' and let 'layout' handle the slide.
                */}
                <motion.div
                  layout
                  transition={{ duration: .7, ease: "easeInOut" }}
                  className={`flex flex-col w-full ${isExpanded ? 'items-center text-center' : 'items-start text-left'}`}
                >
                  <motion.span
                    layout
                    transition={{ duration: .7, ease: "easeInOut" }}
                    className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400"
                  >
                    Layer {String(index + 1).padStart(2, '0')}
                  </motion.span>

                  <motion.h3
                    layout
                    transition={{ duration: .7, ease: "easeInOut" }}
                    className={`font-semibold tracking-tight ${isExpanded ? 'text-2xl text-indigo-950' : 'text-base text-slate-900'}`}
                  >
                    {layer.label}
                  </motion.h3>
                  <motion.p
                    layout
                    transition={{ duration: .7, ease: "easeInOut" }}
                    className={`text-slate-600 leading-relaxed ${isExpanded ? 'text-center text-base max-w-lg mx-auto mt-2' : 'text-sm line-clamp-2'}`}
                  >
                    {layer.description}
                  </motion.p>
                </motion.div>

                {/* Icon (Absolute positioned to not affect flex centering flow) */}
                <div className="absolute right-5 top-5">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: .7, ease: "easeInOut" }}
                    className="text-slate-300 group-hover:text-slate-500"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </motion.div>
                </div>
              </div>

              {/* Description & Body Content */}
              <motion.div layout="position" transition={{ duration: .7, ease: "easeInOut" }} className=" flex-grow overflow-hidden">


                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-8 border-t border-slate-100 pt-6"
                  >
                    <LayerCategoryCarousel
                      roles={layer.roles}
                      keyFiles={layer.key_files}
                      graphNodes={graphNodes}
                      onFileClick={onFileClick}
                    />
                  </motion.div>
                )}
              </motion.div>

              {/* Footer / Metadata Area */}
              <motion.div layout transition={{ duration: .7, ease: "easeInOut" }} className={`mt-4 flex flex-col gap-3 ${isExpanded ? 'items-center' : ''}`}>

                {/* Roles Tags */}
                {layer.roles.length > 0 && (
                  <motion.div layout transition={{ duration: .7, ease: "easeInOut" }} className={`flex flex-wrap gap-2 ${isExpanded ? 'justify-center' : ''}`}>
                    {layer.roles.map((role) => (
                      <motion.span
                        layout
                        transition={{ duration: .7, ease: "easeInOut" }}
                        key={role}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
                        style={{
                          backgroundColor: `${roleColors[role as ArchitecturalRole] || '#64748b'}08`,
                          borderColor: `${roleColors[role as ArchitecturalRole] || '#64748b'}30`,
                          color: roleColors[role as ArchitecturalRole] || '#64748b',
                        }}
                      >
                        {role}
                      </motion.span>
                    ))}
                  </motion.div>
                )}

                {/* File Links */}
                {layer.key_files.length > 0 && (
                  <motion.div layout transition={{ duration: .7, ease: "easeInOut" }} className={`flex flex-wrap gap-x-3 gap-y-1 ${isExpanded ? 'justify-center' : ''}`}>
                    {layer.key_files.map((file) => (
                      <motion.button
                        layout
                        transition={{ duration: .7, ease: "easeInOut" }}
                        key={file}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileClick?.(file);
                        }}
                        className="group/file inline-flex items-center gap-1 font-mono text-xs text-slate-500 transition-colors hover:text-indigo-600"
                        title="Open file"
                      >
                        <KeyRound size={11} className="opacity-50 group-hover/file:opacity-100 flex-shrink-0" />
                        <span className="decoration-indigo-500/30 underline-offset-2 group-hover/file:underline">
                          {file}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>

            </motion.div>

            {/* Active State Accent Bar (Bottom) */}
            <motion.div
              layout
              className="absolute bottom-0 left-0 h-1 w-full bg-indigo-500"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isExpanded ? 1 : 0 }}
              transition={{ duration: .7, ease: "easeInOut" }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}