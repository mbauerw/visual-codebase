import { useState, memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TierGroup, FunctionTierItem } from '../../types/tierList';
import { tierBgColors, tierDescriptions } from '../../types/tierList';
import { FunctionRow } from './FunctionRow';

interface TierSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

function TierSectionComponent({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: TierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;

  if (count === 0) {
    return null;
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
        style={{ backgroundColor: tierBgColors[group.tier] }}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}

          {/* Tier badge */}
          <span
            className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-lg"
            style={{
              backgroundColor: `${group.color}30`,
              color: group.color,
            }}
          >
            {group.tier}
          </span>

          {/* Label */}
          <div className="text-left">
            <span className="font-semibold text-white">{group.label}</span>
            <p className="text-xs text-slate-400 hidden sm:block">
              {tierDescriptions[group.tier]}
            </p>
          </div>
        </div>

        {/* Count badge */}
        <span
          className="px-2.5 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: `${group.color}20`,
            color: group.color,
          }}
        >
          {count}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-2 py-2 bg-slate-800/30 space-y-1 max-h-80 overflow-y-auto">
          {group.functions.map((func) => (
            <FunctionRow
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const TierSection = memo(TierSectionComponent);
