import { useState, memo } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  SortDesc,
  SortAsc,
  X,
  AlertCircle,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileCode,
  Hash,
  Zap,
  Upload,
  Play,
  Sparkles,
} from 'lucide-react';
import { useTierList } from '../../../hooks/useTierList';
import type { FunctionTierItem, TierLevel, TierGroup, FunctionType } from '../../../types/tierList';
import {
  tierLabels,
  tierDescriptions,
  functionTypeLabels,
  functionTypeColors,
} from '../../../types/tierList';

interface LightMinimalDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

// Light pastel tier colors
const lightTierColors: Record<TierLevel, string> = {
  S: '#ff6b9d', // Soft pink
  A: '#4f9eff', // Soft blue
  B: '#5fd4a0', // Mint green
  C: '#ffa94d', // Soft orange
  D: '#9775fa', // Soft purple
  F: '#868e96', // Light gray
};

const lightTierBgs: Record<TierLevel, string> = {
  S: ' #fff5f7',
  A: '#f0f7ff',
  B: '#f0fdf4',
  C: '#fff7ed',
  D: '#f8f5ff',
  F: '#f8f9fa',
};

const lightTierBorders: Record<TierLevel, string> = {
  S: 'rgba(255, 147, 178, 1)',
  A: '#dbeafe',
  B: '#d1fae5',
  C: '#fed7aa',
  D: '#e9d8fd',
  F: '#e9ecef',
};

export function LightMinimalDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: LightMinimalDesignProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandSearch, setExpandSearch] = useState(true);

  const {
    tierGroups,
    stats,
    tierSummary,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    refresh,
  } = useTierList({
    analysisId,
    enabled: !!analysisId,
  });

  

  const handleFunctionClick = (func: FunctionTierItem) => {
    setSelectedFunctionId(func.id);
    onFunctionSelect?.(func);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const handleExpandSearch = () => {
    setExpandSearch(prev => !prev);
  };


  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter(null);
    setSortBy('call_count');
    setSortOrder('desc');
  };

  const hasActiveFilters = searchQuery || tierFilter || sortBy !== 'call_count' || sortOrder !== 'desc';

  // Loading state
  if (isLoading && !tierGroups.length) {
    return (
      <div className="h-full flex flex-col bg-white">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
            <span className="text-sm font-medium">Loading functions...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-white">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-red-500 px-4 text-center">
            <div className="p-4 bg-red-50 rounded-2xl">
              <AlertCircle className="w-10 h-10" />
            </div>
            <span className="text-sm font-medium">{error}</span>
            <button
              onClick={refresh}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!analysisId) {
    return (
      <div className="h-full flex flex-col bg-white">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400 px-4">
            <div className="p-6 bg-gray-50 rounded-3xl inline-block mb-4">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No analysis selected</p>
            <p className="text-xs text-gray-400 mt-2">Run an analysis to see function rankings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <Header onClose={onClose} />

      {/* Stats bar - Clean white with subtle shadows */}
      {stats && tierSummary && (
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                <span className="font-semibold text-gray-900">{stats.total_functions}</span>
                <span className="text-gray-500">functions</span>
              </div>
              <div className="w-px h-4 bg-gray-200"></div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                <span className="font-semibold text-gray-900">{stats.total_calls}</span>
                <span className="text-gray-500">total calls</span>
              </div>
            </div>

            {/* Tier quick filters */}
            <div className="flex items-center gap-1.5">
              {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                  className={`min-w-[32px] h-7 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${tierFilter === tier
                      ? 'shadow-md scale-105'
                      : 'hover:scale-105 hover:shadow-sm opacity-80 hover:opacity-100'
                    }`}
                  style={{
                    backgroundColor: tierFilter === tier ? lightTierColors[tier] : lightTierBgs[tier],
                    color: tierFilter === tier ? '#ffffff' : lightTierColors[tier],
                    border: tierFilter === tier ? 'none' : `1.5px solid ${lightTierBorders[tier]}`,
                  }}
                  title={`${tierLabels[tier]}: ${tierSummary[tier]}`}
                >
                  {tier}
                  <span className="ml-1 text-[10px] font-semibold">
                    {tierSummary[tier]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters - Minimal white design */}
      <div className="relative border-b border-gray-100 bg-white">
        {/* Collapsible content */}
        <div className={`px-6 transition-all duration-300 ease-in-out overflow-hidden ${expandSearch ? 'max-h-96 py-4 space-y-3 opacity-100' : 'max-h-4 h-4 py-0 opacity-0'}`}>
          {/* Search bar */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search functions by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-200 transition-all"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${showFilters || hasActiveFilters
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                <Filter size={14} />
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={toggleSortOrder}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
              >
                {sortOrder === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />}
                {sortBy === 'call_count' ? 'Calls' : sortBy === 'name' ? 'Name' : sortBy}
              </button>
            </div>

            <button
              onClick={refresh}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="pt-3 space-y-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 w-16">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border-2 border-gray-100 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-200"
                >
                  <option value="call_count">Call Count</option>
                  <option value="name">Name</option>
                  <option value="file">File</option>
                  <option value="tier">Tier</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border-2 border-gray-100 rounded-lg transition-all"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
        {/* Toggle button - always visible */}
        <button
          onClick={handleExpandSearch}
          className="absolute right-2 bottom-0 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all z-10"
        >
          <ChevronUp size={16} className={`transition-transform duration-300 ${expandSearch ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Tier sections - Light cards with generous spacing */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-4 bg-gradient-to-b from-neutral-0 to-neutral-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgb(203,213,225)_transparent]">
        {tierGroups.map((group) => (
          <LightTierSection
            key={group.tier}
            group={group}
            onFunctionClick={handleFunctionClick}
            selectedFunctionId={selectedFunctionId}
            defaultExpanded={group.tier === 'S' || group.tier === 'A'}
          />
        ))}

        {/* Empty search result */}
        {tierGroups.every((g) => g.functions.length === 0) && (
          <div className="text-center text-gray-400 py-12">
            <div className="p-6 bg-gray-50 rounded-3xl inline-block mb-4">
              <Search className="w-12 h-12 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No functions match your filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-500 hover:text-blue-600 font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Header component - Clean white with subtle shadow
function Header({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
          <Sparkles size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-lg">Function Rankings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Discover your most impactful code</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

// Light Tier Section Component
interface LightTierSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

const LightTierSection = memo(function LightTierSection({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: LightTierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;

  if (count === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg overflow-hidden shadow-sm border-2 transition-all hover:shadow-md"
      style={{ borderColor: lightTierBorders[group.tier] }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all hover:opacity-90"
        style={{ backgroundColor: lightTierBgs[group.tier] }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl font-bold text-lg shadow-sm"
            style={{
              backgroundColor: 'white',
              color: lightTierColors[group.tier],
              border: `2px solid ${lightTierBorders[group.tier]}`,
            }}
          >
            {group.tier}
          </div>

          {/* Label */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-base">{group.label}</span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${lightTierColors[group.tier]}20`,
                  color: lightTierColors[group.tier],
                }}
              >
                {count}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
              {tierDescriptions[group.tier]}
            </p>
          </div>
        </div>

        {/* Expand icon */}
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${lightTierColors[group.tier]}15` }}
        >
          {isExpanded ? (
            <ChevronDown size={18} style={{ color: lightTierColors[group.tier] }} />
          ) : (
            <ChevronRight size={18} style={{ color: lightTierColors[group.tier] }} />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-0 py-0 bg-white space-y-0 max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgb(203,213,225)_transparent]">
          {group.functions.map((func) => (
            <LightFunctionRow
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
              tierColor={lightTierColors[group.tier]}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Light Function Row Component
interface LightFunctionRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  tierColor: string;
}

const LightFunctionRow = memo(function LightFunctionRow({
  func,
  onClick,
  isSelected,
  tierColor,
}: LightFunctionRowProps) {
  return (
    <div className={`w-full h-full min-h-32 flex items-center border-t-2 py-2 px-2`}
      style={{ borderColor: tierColor + '20' }}>
      <button
        onClick={() => onClick(func)}
        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${isSelected
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 shadow-md border-2 border-blue-200 scale-[1.02]'
            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
          }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Function name and info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Tier badge */}
              <span
                className="text-sm font-bold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${tierColor}20`,
                  color: tierColor,
                }}
              >
                {func.tier}
              </span>
              {/* Function name */}
              <span className="font-semibold text-gray-900 truncate text-lg">
                {func.function_name}
              </span>
              {/* Badges */}
              <div className="flex items-center gap-1.5">
                {func.is_async && (
                  <div
                    className="p-1 rounded-md"
                    style={{ backgroundColor: '#fef3c7' }}
                    title="Async"
                  >
                    <Zap size={11} className="text-amber-600" />
                  </div>
                )}
                {func.is_exported && (
                  <div
                    className="p-1 rounded-md"
                    style={{ backgroundColor: '#d1fae5' }}
                    title="Exported"
                  >
                    <Upload size={11} className="text-green-600" />
                  </div>
                )}
                {func.is_entry_point && (
                  <div
                    className="p-1 rounded-md"
                    style={{ backgroundColor: '#dbeafe' }}
                    title="Entry Point"
                  >
                    <Play size={11} className="text-blue-600" />
                  </div>
                )}
              </div>
            </div>
            {/* File path and type */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className="px-2 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: `${functionTypeColors[func.function_type]}15`,
                  color: functionTypeColors[func.function_type],
                }}
              >
                {functionTypeLabels[func.function_type]}
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 truncate">
                <FileCode size={11} />
                <span className="font-medium">{func.file_path}</span>
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <Hash size={11} />
                L{func.start_line}
              </span>
            </div>
          </div>
          {/* Call count */}
          <div className="flex flex-col items-end">
            <div
              className="px-3 py-1 rounded-lg"
              style={{
                backgroundColor: `${tierColor}15`,
              }}
            >
              <span className="text-base font-bold" style={{ color: tierColor }}>
                {func.internal_call_count}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">calls</span>
          </div>
        </div>
      </button>
    </div>
  );
});
