import { memo } from 'react';
import {
  FileCode,
  Hash,
  Zap,
  Upload,
  Play,
} from 'lucide-react';
import type { FunctionTierItem } from '../../types/tierList';
import {
  tierColors,
  functionTypeLabels,
  functionTypeColors,
} from '../../types/tierList';

interface FunctionRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
}

function FunctionRowComponent({ func, onClick, isSelected }: FunctionRowProps) {
  return (
    <button
      onClick={() => onClick(func)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 group ${
        isSelected
          ? 'bg-slate-700 ring-2 ring-blue-400'
          : 'hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Function name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Tier badge */}
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${tierColors[func.tier]}20`,
                color: tierColors[func.tier],
              }}
            >
              {func.tier}
            </span>

            {/* Function name */}
            <span className="font-medium text-white truncate">
              {func.function_name}
            </span>

            {/* Badges */}
            <div className="flex items-center gap-1">
              {func.is_async && (
                <span title="Async">
                  <Zap size={12} className="text-yellow-400" />
                </span>
              )}
              {func.is_exported && (
                <span title="Exported">
                  <Upload size={12} className="text-green-400" />
                </span>
              )}
              {func.is_entry_point && (
                <span title="Entry Point">
                  <Play size={12} className="text-blue-400" />
                </span>
              )}
            </div>
          </div>

          {/* File path and type */}
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{
                backgroundColor: `${functionTypeColors[func.function_type]}15`,
                color: functionTypeColors[func.function_type],
              }}
            >
              {functionTypeLabels[func.function_type]}
            </span>
            <span className="flex items-center gap-1 truncate">
              <FileCode size={10} />
              {func.file_path}
            </span>
            <span className="flex items-center gap-1">
              <Hash size={10} />
              L{func.start_line}
            </span>
          </div>
        </div>

        {/* Call count */}
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-white">
            {func.internal_call_count}
          </span>
          <span className="text-xs text-slate-500">calls</span>
        </div>
      </div>
    </button>
  );
}

export const FunctionRow = memo(FunctionRowComponent);
