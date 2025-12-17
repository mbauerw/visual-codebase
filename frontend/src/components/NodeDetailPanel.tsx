import { X, FileCode, Folder, ArrowRight, Hash, Code, Layers } from 'lucide-react';
import type { ReactFlowNodeData } from '../types';
import { roleColors, languageColors, roleLabels, categoryColors } from '../types';

interface NodeDetailPanelProps {
  data: ReactFlowNodeData | null;
  onClose: () => void;
}

export default function NodeDetailPanel({ data, onClose }: NodeDetailPanelProps) {
  if (!data) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4">
          <Layers size={48} className="text-slate-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-400 mb-2">No File Selected</h3>
        <p className="text-sm text-slate-500 max-w-[200px]">
          Click on a file node in the visualization to view its details
        </p>
      </div>
    );
  }

  const roleColor = roleColors[data.role] || roleColors.unknown;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const categoryColor = categoryColors[data.category] || categoryColors.unknown;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <div className="p-6 border-b border-slate-800 bg-slate-800/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 flex-shrink-0">
                <FileCode size={24} className="text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate" title={data.label}>
                  {data.label}
                </h2>
                <p className="text-sm text-slate-500 mt-1">File Details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-105 flex-shrink-0"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Badges Section */}
        <div className="flex flex-wrap gap-2">
          <span
            className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-transform hover:scale-105"
            style={{
              backgroundColor: `${roleColor}15`,
              color: roleColor,
              borderColor: `${roleColor}30`,
            }}
          >
            {roleLabels[data.role]}
          </span>
          <span
            className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-transform hover:scale-105"
            style={{
              backgroundColor: `${langColor}15`,
              color: langColor,
              borderColor: `${langColor}30`,
            }}
          >
            {data.language}
          </span>
          <span
            className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-transform hover:scale-105"
            style={{
              backgroundColor: `${categoryColor}15`,
              color: categoryColor,
              borderColor: `${categoryColor}30`,
            }}
          >
            {data.category}
          </span>
        </div>

        {/* Path Section */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Folder size={16} />
            <span className="text-xs uppercase tracking-wider font-semibold">File Path</span>
          </div>
          <code className="text-sm text-slate-300 break-all leading-relaxed block">
            {data.path}
          </code>
        </div>

        {/* Description */}
        {data.description && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3 block">
              Description
            </label>
            <p className="text-slate-300 text-sm leading-relaxed">{data.description}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-5 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                <Hash size={14} className="text-indigo-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold">Lines</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.line_count.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-5 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <div className="p-1.5 bg-purple-500/20 rounded-lg">
                <Code size={14} className="text-purple-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold">Size</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatBytes(data.size_bytes)}
            </p>
          </div>
        </div>

        {/* Imports Section */}
        {data.imports.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <ArrowRight size={16} />
                <span className="text-xs uppercase tracking-wider font-semibold">Imports</span>
              </div>
              <span className="text-xs bg-slate-700/50 text-slate-400 px-2.5 py-1 rounded-full font-medium">
                {data.imports.length}
              </span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {data.imports.map((imp, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 text-sm text-slate-300 bg-slate-900/50 px-3 py-2.5 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors"
                >
                  <ArrowRight size={12} className="text-indigo-400 flex-shrink-0" />
                  <code className="truncate text-xs" title={imp}>
                    {imp}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
