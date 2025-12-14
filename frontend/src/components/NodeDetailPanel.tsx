import { X, FileCode, Folder, ArrowRight, Hash, Code } from 'lucide-react';
import type { ReactFlowNodeData } from '../types';
import { roleColors, languageColors, roleLabels, categoryColors } from '../types';

interface NodeDetailPanelProps {
  data: ReactFlowNodeData | null;
  onClose: () => void;
}

export default function NodeDetailPanel({ data, onClose }: NodeDetailPanelProps) {
  if (!data) return null;

  const roleColor = roleColors[data.role] || roleColors.unknown;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const categoryColor = categoryColors[data.category] || categoryColors.unknown;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-slate-800 border-l border-slate-700 shadow-xl overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode size={20} className="text-slate-400" />
          <h2 className="text-lg font-semibold text-white truncate" title={data.label}>
            {data.label}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Path */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
            Path
          </label>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Folder size={14} className="text-slate-500 flex-shrink-0" />
            <code className="bg-slate-900 px-2 py-1 rounded text-xs break-all">
              {data.path}
            </code>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${roleColor}20`,
              color: roleColor,
            }}
          >
            {roleLabels[data.role]}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${langColor}20`,
              color: langColor,
            }}
          >
            {data.language}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
            }}
          >
            {data.category}
          </span>
        </div>

        {/* Description */}
        {data.description && (
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
              Description
            </label>
            <p className="text-slate-300 text-sm">{data.description}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Hash size={14} />
              <span className="text-xs uppercase tracking-wide">Lines</span>
            </div>
            <p className="text-xl font-semibold text-white">{data.line_count}</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Code size={14} />
              <span className="text-xs uppercase tracking-wide">Size</span>
            </div>
            <p className="text-xl font-semibold text-white">
              {formatBytes(data.size_bytes)}
            </p>
          </div>
        </div>

        {/* Imports */}
        {data.imports.length > 0 && (
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
              Imports ({data.imports.length})
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.imports.map((imp, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-2 py-1.5 rounded"
                >
                  <ArrowRight size={12} className="text-slate-600 flex-shrink-0" />
                  <code className="truncate" title={imp}>
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
