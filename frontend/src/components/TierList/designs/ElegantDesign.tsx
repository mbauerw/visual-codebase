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

interface ElegantDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

// Elegant complementary color palette inspired by art theory
// Using purple/gold as primary complementary pair with supporting harmonies
const elegantTierColors: Record<TierLevel, { primary: string; complement: string; accent: string }> = {
  S: {
    primary: '#7C3AED',    // Deep violet
    complement: '#F59E0B', // Warm gold
    accent: '#DDD6FE',     // Soft lavender
  },
  A: {
    primary: '#0891B2',    // Teal cyan
    complement: '#F97316', // Warm coral
    accent: '#CFFAFE',     // Soft cyan
  },
  B: {
    primary: '#059669',    // Emerald
    complement: '#E11D48', // Rose red
    accent: '#D1FAE5',     // Soft mint
  },
  C: {
    primary: '#2563EB',    // Royal blue
    complement: '#EA580C', // Burnt orange
    accent: '#DBEAFE',     // Soft blue
  },
  D: {
    primary: '#7C3AED',    // Purple
    complement: '#84CC16', // Lime green
    accent: '#EDE9FE',     // Soft purple
  },
  F: {
    primary: '#64748B',    // Slate
    complement: '#94A3B8', // Light slate
    accent: '#F1F5F9',     // Soft slate
  },
};

// Gradient backgrounds that flow elegantly
const elegantTierGradients: Record<TierLevel, string> = {
  S: 'linear-gradient(135deg, #FAF5FF 0%, #FEF3C7 100%)',
  A: 'linear-gradient(135deg, #ECFEFF 0%, #FFF7ED 100%)',
  B: 'linear-gradient(135deg, #ECFDF5 0%, #FFF1F2 100%)',
  C: 'linear-gradient(135deg, #EFF6FF 0%, #FFF7ED 100%)',
  D: 'linear-gradient(135deg, #FAF5FF 0%, #F7FEE7 100%)',
  F: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
};

export function ElegantDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: ElegantDesignProps) {
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

  // Loading state with elegant animation
  if (isLoading && !tierGroups.length) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #FAF5FF 0%, #FEF3C7 50%, #ECFEFF 100%)' }}>
        <ElegantHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div
              className="p-6 rounded-3xl shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #F59E0B 100%)',
                boxShadow: '0 20px 40px -12px rgba(124, 58, 237, 0.35)'
              }}
            >
              <Loader2 className="w-12 h-12 animate-spin text-white" />
            </div>
            <div className="text-center">
              <span className="text-lg font-medium text-gray-700">Analyzing your codebase</span>
              <p className="text-sm text-gray-500 mt-1">Discovering function relationships...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #FFF1F2 0%, #FEF3C7 100%)' }}>
        <ElegantHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 px-6 text-center">
            <div
              className="p-6 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #E11D48 0%, #F59E0B 100%)',
                boxShadow: '0 20px 40px -12px rgba(225, 29, 72, 0.35)'
              }}
            >
              <AlertCircle className="w-12 h-12 text-white" />
            </div>
            <div>
              <span className="text-lg font-medium text-gray-800">{error}</span>
              <button
                onClick={refresh}
                className="mt-4 block mx-auto px-6 py-2 text-sm font-medium text-white rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #0891B2 100%)',
                  boxShadow: '0 8px 24px -8px rgba(124, 58, 237, 0.5)'
                }}
              >
                Try again
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
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #FAF5FF 0%, #ECFEFF 100%)' }}>
        <ElegantHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div
              className="p-8 rounded-3xl inline-block mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                border: '2px solid rgba(124, 58, 237, 0.2)'
              }}
            >
              <BarChart3 className="w-16 h-16 mx-auto" style={{ color: '#7C3AED' }} />
            </div>
            <p className="text-lg font-medium text-gray-700">No analysis selected</p>
            <p className="text-sm text-gray-500 mt-2">Run an analysis to discover your function hierarchy</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #FEFBFF 0%, #FFFBF5 100%)' }}>
      <ElegantHeader onClose={onClose} />

      {/* Stats bar with complementary color accents */}
      {stats && tierSummary && (
        <div
          className="px-6 py-5 border-b"
          style={{
            background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.03) 0%, rgba(245, 158, 11, 0.05) 50%, rgba(8, 145, 178, 0.03) 100%)',
            borderColor: 'rgba(124, 58, 237, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #F59E0B 100%)' }}
                />
                <span className="text-2xl font-bold" style={{ color: '#7C3AED' }}>{stats.total_functions}</span>
                <span className="text-sm text-gray-500 font-medium">functions</span>
              </div>
              <div
                className="w-px h-8"
                style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(124, 58, 237, 0.3) 50%, transparent 100%)' }}
              />
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #0891B2 0%, #F97316 100%)' }}
                />
                <span className="text-2xl font-bold" style={{ color: '#0891B2' }}>{stats.total_calls}</span>
                <span className="text-sm text-gray-500 font-medium">total calls</span>
              </div>
            </div>

            {/* Elegant tier quick filters */}
            <div className="flex items-center gap-2">
              {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => {
                const colors = elegantTierColors[tier];
                const isActive = tierFilter === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                    className="relative min-w-[40px] h-9 px-2.5 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-300"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.complement} 100%)`
                        : colors.accent,
                      color: isActive ? '#ffffff' : colors.primary,
                      boxShadow: isActive
                        ? `0 8px 20px -6px ${colors.primary}60`
                        : 'none',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                    title={`${tierLabels[tier]}: ${tierSummary[tier]}`}
                  >
                    {tier}
                    <span className="ml-1 text-[10px] font-semibold opacity-80">
                      {tierSummary[tier]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters with artistic styling */}
      <div
        className="relative border-b"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FEFBFF 100%)',
          borderColor: 'rgba(124, 58, 237, 0.08)'
        }}
      >
        <div className={`px-6 transition-all duration-500 ease-out overflow-hidden ${expandSearch ? 'max-h-96 py-5 space-y-4 opacity-100' : 'max-h-4 h-4 py-0 opacity-0'}`}>
          {/* Elegant search bar */}
          <div className="relative">
            <Search
              size={20}
              className="absolute left-5 top-1/2 -translate-y-1/2"
              style={{ color: '#7C3AED' }}
            />
            <input
              type="text"
              placeholder="Search functions by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-12 py-4 rounded-2xl text-sm font-medium transition-all duration-300 focus:outline-none"
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04) 0%, rgba(245, 158, 11, 0.04) 100%)',
                border: '2px solid rgba(124, 58, 237, 0.12)',
                color: '#374151',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#7C3AED';
                e.target.style.boxShadow = '0 8px 32px -8px rgba(124, 58, 237, 0.25)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(124, 58, 237, 0.12)';
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-300 hover:scale-110"
                style={{
                  background: 'rgba(124, 58, 237, 0.1)',
                  color: '#7C3AED'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter controls with gradient buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300"
                style={{
                  background: showFilters || hasActiveFilters
                    ? 'linear-gradient(135deg, #7C3AED 0%, #0891B2 100%)'
                    : 'rgba(124, 58, 237, 0.08)',
                  color: showFilters || hasActiveFilters ? '#ffffff' : '#7C3AED',
                  boxShadow: showFilters || hasActiveFilters
                    ? '0 8px 24px -6px rgba(124, 58, 237, 0.4)'
                    : 'none',
                }}
              >
                <Filter size={16} />
                Filters
                {hasActiveFilters && (
                  <span
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: '#F59E0B' }}
                  />
                )}
              </button>

              <button
                onClick={toggleSortOrder}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 hover:scale-105"
                style={{
                  background: 'rgba(8, 145, 178, 0.08)',
                  color: '#0891B2',
                }}
              >
                {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
                {sortBy === 'call_count' ? 'Calls' : sortBy === 'name' ? 'Name' : sortBy}
              </button>
            </div>

            <button
              onClick={refresh}
              className="p-3 rounded-xl transition-all duration-300 hover:scale-110"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#F59E0B'
              }}
              title="Refresh"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Expanded filters with elegant styling */}
          {showFilters && (
            <div
              className="pt-4 space-y-4 border-t"
              style={{ borderColor: 'rgba(124, 58, 237, 0.1)' }}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-500 w-20">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 focus:outline-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04) 0%, rgba(8, 145, 178, 0.04) 100%)',
                    border: '2px solid rgba(124, 58, 237, 0.1)',
                    color: '#374151',
                  }}
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
                  className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
                    border: '2px solid rgba(225, 29, 72, 0.15)',
                    color: '#E11D48',
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Elegant toggle button */}
        <button
          onClick={handleExpandSearch}
          className="absolute right-3 bottom-0 p-1 rounded-lg transition-all duration-300 hover:scale-110"
          style={{ color: '#7C3AED' }}
        >
          <ChevronUp
            size={18}
            className={`transition-transform duration-500 ${expandSearch ? '' : 'rotate-180'}`}
          />
        </button>
      </div>

      {/* Tier sections with artistic card design */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 space-y-5"
        style={{
          background: 'linear-gradient(180deg, #FEFBFF 0%, #FFF9F5 50%, #F5FFFE 100%)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(124, 58, 237, 0.3) transparent'
        }}
      >
        {tierGroups.map((group) => (
          <ElegantTierSection
            key={group.tier}
            group={group}
            onFunctionClick={handleFunctionClick}
            selectedFunctionId={selectedFunctionId}
            defaultExpanded={group.tier === 'S' || group.tier === 'A'}
          />
        ))}

        {/* Empty search result */}
        {tierGroups.every((g) => g.functions.length === 0) && (
          <div className="text-center py-16">
            <div
              className="p-8 rounded-3xl inline-block mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)'
              }}
            >
              <Search className="w-14 h-14" style={{ color: '#7C3AED' }} />
            </div>
            <p className="text-lg font-medium text-gray-600">No functions match your filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #F59E0B 100%)',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px -8px rgba(124, 58, 237, 0.4)'
                }}
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

// Elegant Header with gradient accent
function ElegantHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-5 border-b"
      style={{
        background: 'linear-gradient(90deg, #FEFBFF 0%, #FFFBF5 50%, #F5FFFE 100%)',
        borderColor: 'rgba(124, 58, 237, 0.1)'
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="p-3 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #F59E0B 100%)',
            boxShadow: '0 8px 24px -8px rgba(124, 58, 237, 0.4)'
          }}
        >
          <Sparkles size={24} className="text-white" />
        </div>
        <div>
          <h2
            className="font-bold text-xl"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #0891B2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Function Rankings
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">Discover your most impactful code</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-3 rounded-xl transition-all duration-300 hover:scale-110"
          style={{
            background: 'rgba(124, 58, 237, 0.08)',
            color: '#7C3AED'
          }}
        >
          <X size={22} />
        </button>
      )}
    </div>
  );
}

// Elegant Tier Section with flowing design
interface ElegantTierSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

const ElegantTierSection = memo(function ElegantTierSection({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: ElegantTierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;
  const colors = elegantTierColors[group.tier];

  if (count === 0) {
    return null;
  }

  return (
    <div
      className="rounded-3xl overflow-hidden transition-all duration-500"
      style={{
        boxShadow: isExpanded
          ? `0 20px 50px -15px ${colors.primary}25`
          : `0 8px 24px -8px ${colors.primary}15`,
        border: `2px solid ${colors.primary}20`,
      }}
    >
      {/* Artistic header with gradient */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-5 transition-all duration-300"
        style={{ background: elegantTierGradients[group.tier] }}
      >
        <div className="flex items-center gap-5">
          {/* Tier badge with complementary gradient */}
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl font-bold text-xl shadow-lg transition-transform duration-300"
            style={{
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.complement} 100%)`,
              color: '#ffffff',
              boxShadow: `0 8px 20px -6px ${colors.primary}50`,
              transform: isExpanded ? 'rotate(-3deg) scale(1.05)' : 'rotate(0deg) scale(1)',
            }}
          >
            {group.tier}
          </div>

          {/* Label and description */}
          <div className="text-left">
            <div className="flex items-center gap-3">
              <span
                className="font-bold text-lg"
                style={{ color: colors.primary }}
              >
                {group.label}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.complement}15 100%)`,
                  color: colors.primary,
                  border: `1.5px solid ${colors.primary}30`,
                }}
              >
                {count} {count === 1 ? 'function' : 'functions'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 hidden sm:block font-medium">
              {tierDescriptions[group.tier]}
            </p>
          </div>
        </div>

        {/* Elegant expand icon */}
        <div
          className="p-2.5 rounded-xl transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}10 0%, ${colors.complement}10 100%)`,
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          <ChevronDown size={20} style={{ color: colors.primary }} />
        </div>
      </button>

      {/* Content with smooth reveal */}
      <div
        className={`transition-all duration-500 ease-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div
          className="px-4 py-3 space-y-2 overflow-y-auto max-h-[450px]"
          style={{
            background: '#ffffff',
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.primary}30 transparent`
          }}
        >
          {group.functions.map((func, index) => (
            <ElegantFunctionRow
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
              colors={colors}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// Elegant Function Row with artistic hover states
interface ElegantFunctionRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  colors: { primary: string; complement: string; accent: string };
  index: number;
}

const ElegantFunctionRow = memo(function ElegantFunctionRow({
  func,
  onClick,
  isSelected,
  colors,
  index,
}: ElegantFunctionRowProps) {
  return (
    <button
      onClick={() => onClick(func)}
      className="w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 group"
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${colors.primary}08 0%, ${colors.complement}08 100%)`
          : '#FAFAFA',
        border: isSelected
          ? `2px solid ${colors.primary}40`
          : '2px solid transparent',
        boxShadow: isSelected
          ? `0 8px 24px -8px ${colors.primary}20`
          : 'none',
        transform: isSelected ? 'scale(1.01)' : 'scale(1)',
        animationDelay: `${index * 50}ms`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = `linear-gradient(135deg, ${colors.accent}50 0%, ${colors.primary}08 100%)`;
          e.currentTarget.style.borderColor = `${colors.primary}25`;
          e.currentTarget.style.transform = 'scale(1.01) translateX(4px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = '#FAFAFA';
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Function details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {/* Mini tier badge */}
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.complement} 100%)`,
                color: '#ffffff',
                boxShadow: `0 4px 12px -4px ${colors.primary}40`,
              }}
            >
              {func.tier}
            </span>

            {/* Function name */}
            <span
              className="font-semibold text-lg truncate transition-colors duration-300"
              style={{ color: isSelected ? colors.primary : '#1F2937' }}
            >
              {func.function_name}
            </span>

            {/* Feature badges with complementary colors */}
            <div className="flex items-center gap-1.5">
              {func.is_async && (
                <div
                  className="p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                    boxShadow: '0 2px 8px -2px rgba(245, 158, 11, 0.3)'
                  }}
                  title="Async"
                >
                  <Zap size={12} className="text-amber-600" />
                </div>
              )}
              {func.is_exported && (
                <div
                  className="p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                    boxShadow: '0 2px 8px -2px rgba(5, 150, 105, 0.3)'
                  }}
                  title="Exported"
                >
                  <Upload size={12} className="text-emerald-600" />
                </div>
              )}
              {func.is_entry_point && (
                <div
                  className="p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
                    boxShadow: '0 2px 8px -2px rgba(37, 99, 235, 0.3)'
                  }}
                  title="Entry Point"
                >
                  <Play size={12} className="text-blue-600" />
                </div>
              )}
            </div>
          </div>

          {/* File info row */}
          <div className="flex items-center gap-3 text-sm">
            <span
              className="px-2.5 py-1 rounded-lg font-medium"
              style={{
                background: `${functionTypeColors[func.function_type]}15`,
                color: functionTypeColors[func.function_type],
              }}
            >
              {functionTypeLabels[func.function_type]}
            </span>
            <span className="flex items-center gap-2 text-gray-500 truncate">
              <FileCode size={14} style={{ color: colors.primary }} />
              <span className="font-medium">{func.file_path}</span>
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Hash size={14} />
              L{func.start_line}
            </span>
          </div>
        </div>

        {/* Call count with artistic display */}
        <div className="flex flex-col items-end">
          <div
            className="px-4 py-2 rounded-xl transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}10 0%, ${colors.complement}10 100%)`,
              border: `1.5px solid ${colors.primary}20`,
            }}
          >
            <span
              className="text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.complement} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {func.internal_call_count}
            </span>
          </div>
          <span
            className="text-xs font-medium mt-1"
            style={{ color: colors.primary }}
          >
            calls
          </span>
        </div>
      </div>
    </button>
  );
});
