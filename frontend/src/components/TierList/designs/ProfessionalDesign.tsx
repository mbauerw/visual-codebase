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
  Layers,
} from 'lucide-react';
import { useTierList } from '../../../hooks/useTierList';
import type { FunctionTierItem, TierLevel, TierGroup, FunctionType } from '../../../types/tierList';
import {
  tierLabels,
  tierDescriptions,
  functionTypeLabels,
  functionTypeColors,
} from '../../../types/tierList';

interface ProfessionalDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

// Sophisticated muted tier colors - charcoal-based with subtle warm undertones
const professionalTierColors: Record<TierLevel, string> = {
  S: '#2d3748', // Deep charcoal
  A: '#4a5568', // Medium charcoal
  B: '#718096', // Cool gray
  C: '#a0aec0', // Light gray
  D: '#cbd5e0', // Pale gray
  F: '#e2e8f0', // Near white gray
};

// Subtle background tints - almost imperceptible warmth
const professionalTierBgs: Record<TierLevel, string> = {
  S: '#f7f6f5', // Warm off-white
  A: '#f8f7f6', // Slightly warm
  B: '#f9f9f8', // Nearly neutral
  C: '#fafaf9', // Very subtle
  D: '#fbfbfa', // Almost white
  F: '#fcfcfb', // Nearly pure
};

// Refined border colors
const professionalTierBorders: Record<TierLevel, string> = {
  S: '#d4d0cb', // Warm taupe
  A: '#dbd8d4', // Light taupe
  B: '#e2e0dc', // Pale taupe
  C: '#e8e6e3', // Very light
  D: '#eeedeb', // Nearly invisible
  F: '#f3f2f0', // Whisper
};

// Accent colors for tier indicators - earth tones
const professionalTierAccents: Record<TierLevel, string> = {
  S: '#8b7355', // Warm brown
  A: '#9a8570', // Medium tan
  B: '#a89786', // Light tan
  C: '#b5a899', // Pale tan
  D: '#c2b8ac', // Near neutral
  F: '#d0c9bf', // Faded
};

export function ProfessionalDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: ProfessionalDesignProps) {
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
      <div className="h-full flex flex-col bg-[#fafaf9]">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-[#718096]">
            <div className="p-5 border border-[#e2e0dc] rounded bg-white">
              <Loader2 className="w-8 h-8 animate-spin text-[#8b7355]" />
            </div>
            <span className="text-sm font-light tracking-wide uppercase">Loading Analysis</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9]">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-[#8b7355] px-6 text-center">
            <div className="p-5 border border-[#d4d0cb] rounded bg-white">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <span className="text-sm font-light tracking-wide block">{error}</span>
              <button
                onClick={refresh}
                className="mt-4 text-xs text-[#718096] hover:text-[#4a5568] transition-colors font-normal tracking-wider uppercase"
              >
                Retry Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!analysisId) {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9]">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#a0aec0] px-6">
            <div className="p-8 border border-[#e2e0dc] rounded bg-white inline-block mb-6">
              <BarChart3 className="w-12 h-12 mx-auto text-[#cbd5e0]" />
            </div>
            <p className="text-sm font-light tracking-wide text-[#718096]">No Analysis Selected</p>
            <p className="text-xs text-[#a0aec0] mt-3 font-light">
              Run an analysis to view function rankings
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#fafaf9]">
      <Header onClose={onClose} />

      {/* Stats bar - Refined with subtle grid lines */}
      {stats && tierSummary && (
        <div className="px-8 py-5 bg-white border-b border-[#e8e6e3]">
          <div className="flex flex-col items-center gap-6 justify-center">
            <div className="flex items-center  gap-6">
              <div className="flex items-center gap-3 text-sm text-[#4a5568]">
                <span className="text-2xl font-extralight text-[#2d3748] tabular-nums">{stats.total_functions}</span>
                <span className="text-xs font-light tracking-wider uppercase text-[#a0aec0]">Functions</span>
              </div>
              <div className="w-px h-8 bg-[#e8e6e3]"></div>
              <div className="flex items-center gap-3 px-3 text-sm text-[#4a5568]">
                <span className="text-2xl font-extralight text-[#2d3748] tabular-nums">{stats.total_calls}</span>
                <span className="text-xs font-light tracking-wider uppercase text-[#a0aec0]">Total Calls</span>
              </div>
            </div>

            {/* Tier quick filters - Elegant minimal badges */}
            <div className="flex items-center gap-2">
              {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                  className={`min-w-[40px] h-8 px-2.5 flex items-center justify-center text-xs transition-all ${
                    tierFilter === tier
                      ? 'bg-[#2d3748] text-white'
                      : 'bg-transparent text-[#718096] hover:text-[#4a5568] border border-[#e8e6e3] hover:border-[#d4d0cb]'
                  }`}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontWeight: tierFilter === tier ? 500 : 400,
                  }}
                  title={`${tierLabels[tier]}: ${tierSummary[tier]}`}
                >
                  {tier}
                  <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">
                    {tierSummary[tier]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters - Clean architectural lines */}
      <div className="relative border-b border-[#e8e6e3] bg-white">
        <div className={`px-8 transition-all duration-300 ease-in-out overflow-hidden ${expandSearch ? 'max-h-96 py-5 space-y-4 opacity-100' : 'max-h-4 h-4 py-0 opacity-0'}`}>
          {/* Search bar */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0aec0]"
            />
            <input
              type="text"
              placeholder="Search by function name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-[#fafaf9] border border-[#e8e6e3] text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:border-[#d4d0cb] transition-colors"
              style={{
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
              }}
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a0aec0] hover:text-[#718096] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 text-xs tracking-wider uppercase transition-all ${
                  showFilters || hasActiveFilters
                    ? 'bg-[#2d3748] text-white'
                    : 'bg-transparent text-[#718096] hover:text-[#4a5568] border border-[#e8e6e3] hover:border-[#d4d0cb]'
                }`}
              >
                <Filter size={12} />
                Filters
                {hasActiveFilters && !showFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b7355]" />
                )}
              </button>

              <button
                onClick={toggleSortOrder}
                className="flex items-center gap-2 px-4 py-2 text-xs tracking-wider uppercase bg-transparent text-[#718096] hover:text-[#4a5568] border border-[#e8e6e3] hover:border-[#d4d0cb] transition-all"
              >
                {sortOrder === 'desc' ? <SortDesc size={12} /> : <SortAsc size={12} />}
                {sortBy === 'call_count' ? 'Calls' : sortBy === 'name' ? 'Name' : sortBy}
              </button>
            </div>

            <button
              onClick={refresh}
              className="p-2 text-[#a0aec0] hover:text-[#718096] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="pt-4 space-y-4 border-t border-[#e8e6e3]">
              <div className="flex items-center gap-4">
                <span className="text-xs font-light tracking-wider uppercase text-[#a0aec0] w-20">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 px-4 py-2.5 text-sm bg-[#fafaf9] border border-[#e8e6e3] text-[#4a5568] focus:outline-none focus:border-[#d4d0cb] transition-colors"
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
                  className="w-full py-2.5 text-xs tracking-wider uppercase text-[#718096] hover:text-[#4a5568] bg-transparent border border-[#e8e6e3] hover:border-[#d4d0cb] transition-all"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
        {/* Toggle button */}
        <button
          onClick={handleExpandSearch}
          className="absolute right-3 bottom-0 p-0 text-[#a0aec0] hover:text-[#718096] transition-colors z-10"
        >
          <ChevronUp size={14} className={`transition-transform duration-300 ${expandSearch ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Tier sections - Grid-like precision */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e2e0dc] hover:[&::-webkit-scrollbar-thumb]:bg-[#d4d0cb] [&::-webkit-scrollbar-thumb]:rounded-full">
        {tierGroups.map((group) => (
          <ProfessionalTierSection
            key={group.tier}
            group={group}
            onFunctionClick={handleFunctionClick}
            selectedFunctionId={selectedFunctionId}
            defaultExpanded={true}
          />
        ))}

        {/* Empty search result */}
        {tierGroups.every((g) => g.functions.length === 0) && (
          <div className="text-center text-[#a0aec0] py-16">
            <div className="p-8 border border-[#e8e6e3] bg-white inline-block mb-6">
              <Search className="w-10 h-10 text-[#cbd5e0]" />
            </div>
            <p className="text-sm font-light tracking-wide text-[#718096]">No Matching Functions</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-xs tracking-wider uppercase text-[#8b7355] hover:text-[#4a5568] transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Header component - Refined with architectural sensibility
function Header({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-[#e8e6e3] bg-white">
      <div className="flex items-center gap-4">
        <div className="p-2.5 border border-[#e8e6e3]">
          <Layers size={18} className="text-[#8b7355]" />
        </div>
        <div>
          <h2
            className="text-[#2d3748] text-lg tracking-wide"
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontWeight: 400,
            }}
          >
            Function Analysis
          </h2>
          <p className="text-xs text-[#a0aec0] mt-1 font-light tracking-wider uppercase">
            Architectural Overview
          </p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 text-[#a0aec0] hover:text-[#718096] transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

// Professional Tier Section Component
interface ProfessionalTierSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

const ProfessionalTierSection = memo(function ProfessionalTierSection({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: ProfessionalTierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;

  return (
    <div
      className="overflow-hidden !bg-white border transition-all"
      style={{ borderColor: professionalTierBorders[group.tier] }}
    >
      {/* Header */}
      <button
        onClick={() => count > 0 && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-6 py-4 hover:bg-[#fafaf9] ${isExpanded && count > 0 ? 'border-b border-[#e8e6e3]' : ''} ${count === 0 ? 'opacity-50 cursor-default' : ''}`}
        style={{ 
          backgroundColor: professionalTierBgs[group.tier],
          borderColor: professionalTierBorders[group.tier],}}
      >
        <div className="flex items-center gap-5">
          {/* Tier indicator - Refined monospace */}
          <div
            className="w-12 h-12 flex items-center justify-center border text-lg"
            style={{
              backgroundColor: 'white',
              color: professionalTierAccents[group.tier],
              borderColor: professionalTierBorders[group.tier],
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontWeight: 500,
            }}
          >
            {group.tier}
          </div>

          {/* Label */}
          <div className="text-left">
            <div className="flex items-center gap-3">
              <span
                className="text-[#2d3748] text-base"
                style={{
                  fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                  fontWeight: 400,
                }}
              >
                {group.label}
              </span>
              <span
                className="px-2 py-0.5 text-xs tabular-nums"
                style={{
                  backgroundColor: professionalTierBgs[group.tier],
                  color: professionalTierColors[group.tier],
                  border: `1px solid ${professionalTierBorders[group.tier]}`,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                }}
              >
                {count}
              </span>
            </div>
            <p className="text-xs text-[#a0aec0] mt-1 font-light hidden sm:block">
              {tierDescriptions[group.tier]}
            </p>
          </div>
        </div>

        {/* Expand icon */}
        <div className="text-[#a0aec0]">
          {isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && count > 0 && (
        <div className="bg-white max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e8e6e3] hover:[&::-webkit-scrollbar-thumb]:bg-[#d4d0cb] [&::-webkit-scrollbar-thumb]:rounded-full">
          {group.functions.map((func, index) => (
            <ProfessionalFunctionRow
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
              tierAccent={professionalTierAccents[group.tier]}
              isLast={index === group.functions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Professional Function Row Component
interface ProfessionalFunctionRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  tierAccent: string;
  isLast?: boolean;
}

const ProfessionalFunctionRow = memo(function ProfessionalFunctionRow({
  func,
  onClick,
  isSelected,
  tierAccent,
  isLast,
}: ProfessionalFunctionRowProps) {
  return (
    <button
      onClick={() => onClick(func)}
      className={`w-full text-left px-6 py-4 transition-all duration-150 ${
        !isLast ? 'border-b border-[#f3f2f0]' : ''
      } ${
        isSelected
          ? 'bg-[#f7f6f5] border-l-2'
          : 'hover:bg-[#fafaf9] border-l-2 border-l-transparent'
      }`}
      style={{
        borderLeftColor: isSelected ? tierAccent : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-6">
        {/* Function name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {/* Function name - Monospace for code */}
            <span
              className="text-[#2d3748] truncate"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {func.function_name}
            </span>
            {/* Badges - Subtle indicators */}
            <div className="flex items-center gap-2">
              {func.is_async && (
                <div
                  className="p-1 border"
                  style={{ borderColor: '#e8e6e3', backgroundColor: '#fafaf9' }}
                  title="Async"
                >
                  <Zap size={10} className="text-[#a0aec0]" />
                </div>
              )}
              {func.is_exported && (
                <div
                  className="p-1 border"
                  style={{ borderColor: '#e8e6e3', backgroundColor: '#fafaf9' }}
                  title="Exported"
                >
                  <Upload size={10} className="text-[#a0aec0]" />
                </div>
              )}
              {func.is_entry_point && (
                <div
                  className="p-1 border"
                  style={{ borderColor: '#e8e6e3', backgroundColor: '#fafaf9' }}
                  title="Entry Point"
                >
                  <Play size={10} className="text-[#a0aec0]" />
                </div>
              )}
            </div>
          </div>
          {/* File path and metadata */}
          <div className="flex items-center gap-4 text-xs text-[#a0aec0]">
            <span
              className="px-2 py-0.5 border"
              style={{
                borderColor: '#e8e6e3',
                backgroundColor: '#fafaf9',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '10px',
              }}
            >
              {functionTypeLabels[func.function_type]}
            </span>
            <span className="flex items-center gap-1.5 truncate font-light">
              <FileCode size={11} />
              <span>{func.file_path}</span>
            </span>
            <span className="flex items-center gap-1 text-[#cbd5e0] tabular-nums">
              <Hash size={10} />
              {func.start_line}
            </span>
          </div>
        </div>
        {/* Call count - Elegant numerical display */}
        <div className="flex flex-col items-end">
          <span
            className="text-xl tabular-nums"
            style={{
              color: tierAccent,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

              fontWeight: 300,
            }}
          >
            {func.internal_call_count}
          </span>
          <span className="text-[10px] text-[#cbd5e0] font-light tracking-wider uppercase mt-0.5">
            calls
          </span>
        </div>
      </div>
    </button>
  );
});
