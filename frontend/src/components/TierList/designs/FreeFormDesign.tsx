import { useState, memo, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  SortDesc,
  SortAsc,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileCode,
  Hash,
  Zap,
  Upload,
  Play,
  Star,
  Flame,
  Crown,
  Rocket,
  Sparkles,
  Target,
  Award,
  TrendingUp,
  GitBranch,
} from 'lucide-react';
import { useTierList } from '../../../hooks/useTierList';
import type { FunctionTierItem, TierLevel, TierGroup, FunctionType } from '../../../types/tierList';
import {
  tierLabels,
  tierDescriptions,
  functionTypeLabels,
  functionTypeColors,
} from '../../../types/tierList';

interface FreeFormDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

// Cosmic theme colors - deep space with vibrant accents
const cosmicTierColors: Record<TierLevel, { primary: string; glow: string; bg: string; accent: string }> = {
  S: {
    primary: '#ffd700', // Gold
    glow: 'rgba(255, 215, 0, 0.4)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
    accent: '#ffe066',
  },
  A: {
    primary: '#a855f7', // Purple
    glow: 'rgba(168, 85, 247, 0.4)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #1a1a2e 100%)',
    accent: '#c084fc',
  },
  B: {
    primary: '#3b82f6', // Blue
    glow: 'rgba(59, 130, 246, 0.4)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #1e3a5f 50%, #1a1a2e 100%)',
    accent: '#60a5fa',
  },
  C: {
    primary: '#10b981', // Emerald
    glow: 'rgba(16, 185, 129, 0.4)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #134e4a 50%, #1a1a2e 100%)',
    accent: '#34d399',
  },
  D: {
    primary: '#f97316', // Orange
    glow: 'rgba(249, 115, 22, 0.4)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #431407 50%, #1a1a2e 100%)',
    accent: '#fb923c',
  },
  F: {
    primary: '#6b7280', // Gray
    glow: 'rgba(107, 114, 128, 0.3)',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #1f2937 50%, #1a1a2e 100%)',
    accent: '#9ca3af',
  },
};

// Achievement badges based on function characteristics
const getAchievements = (func: FunctionTierItem) => {
  const achievements: { icon: typeof Star; label: string; color: string }[] = [];

  if (func.internal_call_count >= 50) {
    achievements.push({ icon: Flame, label: 'Hot Path', color: '#ef4444' });
  }
  if (func.internal_call_count >= 20 && func.internal_call_count < 50) {
    achievements.push({ icon: TrendingUp, label: 'Popular', color: '#f97316' });
  }
  if (func.is_entry_point) {
    achievements.push({ icon: Rocket, label: 'Entry Point', color: '#3b82f6' });
  }
  if (func.is_exported) {
    achievements.push({ icon: GitBranch, label: 'Public API', color: '#10b981' });
  }
  if (func.is_async) {
    achievements.push({ icon: Zap, label: 'Async', color: '#eab308' });
  }
  if (func.tier === 'S') {
    achievements.push({ icon: Crown, label: 'Elite', color: '#ffd700' });
  }

  return achievements;
};

// Calculate star size based on call count
const getStarSize = (callCount: number): 'small' | 'medium' | 'large' | 'supergiant' => {
  if (callCount >= 50) return 'supergiant';
  if (callCount >= 20) return 'large';
  if (callCount >= 5) return 'medium';
  return 'small';
};

export function FreeFormDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: FreeFormDesignProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'constellation' | 'list'>('constellation');
  const [hoveredTier, setHoveredTier] = useState<TierLevel | null>(null);

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

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter(null);
    setSortBy('call_count');
    setSortOrder('desc');
  };

  const hasActiveFilters = searchQuery || tierFilter || sortBy !== 'call_count' || sortOrder !== 'desc';

  // Calculate total functions for the hero stat
  const totalFunctions = useMemo(() => {
    return tierGroups.reduce((acc, g) => acc + g.functions.length, 0);
  }, [tierGroups]);

  // Loading state with cosmic theme
  if (isLoading && !tierGroups.length) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%)' }}>
        <CosmicHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative p-6 bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-2xl border border-purple-500/30">
                <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-purple-300 font-medium">Mapping the codebase universe...</p>
              <p className="text-purple-500/60 text-sm mt-1">Analyzing function constellations</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%)' }}>
        <CosmicHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-red-400 px-4 text-center">
            <div className="p-4 bg-red-900/30 rounded-2xl border border-red-500/30">
              <AlertCircle className="w-10 h-10" />
            </div>
            <span className="text-sm font-medium">{error}</span>
            <button
              onClick={refresh}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
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
      <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%)' }}>
        <CosmicHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full" />
              <div className="relative p-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-3xl border border-slate-700/50">
                <Star className="w-16 h-16 text-slate-600" />
              </div>
            </div>
            <p className="text-lg font-medium text-slate-400">No universe to explore</p>
            <p className="text-sm text-slate-600 mt-2">Run an analysis to discover your function galaxy</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%)' }}
    >
      <CosmicHeader onClose={onClose} />

      {/* Hero Stats Section */}
      {stats && tierSummary && (
        <div className="px-6 py-5 border-b border-purple-900/30">
          {/* Main stat cards */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total_functions}</p>
                  <p className="text-xs text-purple-400/80">Functions Discovered</p>
                </div>
              </div>
            </div>
            <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total_calls}</p>
                  <p className="text-xs text-amber-400/80">Total Connections</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tier constellation map */}
          <div className="flex items-center justify-between gap-2">
            {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => {
              const colors = cosmicTierColors[tier];
              const count = tierSummary[tier];
              const isActive = tierFilter === tier;
              const isHovered = hoveredTier === tier;

              return (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                  onMouseEnter={() => setHoveredTier(tier)}
                  onMouseLeave={() => setHoveredTier(null)}
                  className="flex-1 relative group"
                >
                  <div
                    className={`relative p-3 rounded-xl transition-all duration-300 ${
                      isActive ? 'scale-105' : isHovered ? 'scale-102' : ''
                    }`}
                    style={{
                      background: isActive ? colors.bg : 'rgba(30, 30, 50, 0.5)',
                      border: `1px solid ${isActive ? colors.primary : 'rgba(100, 100, 150, 0.2)'}`,
                      boxShadow: isActive || isHovered ? `0 0 20px ${colors.glow}` : 'none',
                    }}
                  >
                    {/* Glow effect */}
                    {(isActive || isHovered) && (
                      <div
                        className="absolute inset-0 rounded-xl opacity-30 blur-xl"
                        style={{ background: colors.primary }}
                      />
                    )}

                    <div className="relative flex flex-col items-center gap-1">
                      <span
                        className="text-lg font-black"
                        style={{ color: colors.primary }}
                      >
                        {tier}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {count}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and View Toggle */}
      <div className="px-6 py-4 border-b border-purple-900/30">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/60"
            />
            <input
              type="text"
              placeholder="Search the galaxy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-purple-900/30 rounded-xl text-sm text-slate-200 placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-purple-400/60 hover:text-purple-300 rounded transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-900/50 rounded-xl p-1 border border-purple-900/30">
            <button
              onClick={() => setViewMode('constellation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'constellation'
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Sparkles size={14} className="inline mr-1.5" />
              Galaxy
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Filter size={14} className="inline mr-1.5" />
              List
            </button>
          </div>

          {/* Sort toggle */}
          <button
            onClick={toggleSortOrder}
            className="p-2.5 bg-slate-900/50 border border-purple-900/30 rounded-xl text-purple-400/60 hover:text-purple-300 hover:border-purple-500/30 transition-all"
          >
            {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
          </button>

          {/* Refresh */}
          <button
            onClick={refresh}
            className="p-2.5 bg-slate-900/50 border border-purple-900/30 rounded-xl text-purple-400/60 hover:text-purple-300 hover:border-purple-500/30 transition-all"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-3 w-full py-2 text-xs font-medium text-purple-400/60 hover:text-purple-300 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-900/30 rounded-lg transition-all"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-900/50 hover:[&::-webkit-scrollbar-thumb]:bg-purple-800/50 [&::-webkit-scrollbar-thumb]:rounded-full">
        {viewMode === 'constellation' ? (
          // Constellation View - Card-based galaxy layout
          tierGroups.map((group) => (
            <ConstellationSection
              key={group.tier}
              group={group}
              onFunctionClick={handleFunctionClick}
              selectedFunctionId={selectedFunctionId}
              defaultExpanded={group.tier === 'S' || group.tier === 'A'}
            />
          ))
        ) : (
          // List View - Compact rows
          tierGroups.map((group) => (
            <ListSection
              key={group.tier}
              group={group}
              onFunctionClick={handleFunctionClick}
              selectedFunctionId={selectedFunctionId}
              defaultExpanded={group.tier === 'S' || group.tier === 'A'}
            />
          ))
        )}

        {/* Empty search result */}
        {tierGroups.every((g) => g.functions.length === 0) && (
          <div className="text-center py-16">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full" />
              <div className="relative p-8 bg-slate-900/50 rounded-3xl border border-purple-900/30">
                <Search className="w-12 h-12 text-purple-900" />
              </div>
            </div>
            <p className="text-slate-400 font-medium">No stars match your search</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-purple-400 hover:text-purple-300 font-medium"
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

// Cosmic Header Component
function CosmicHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/30">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-full animate-pulse" />
          <div className="relative p-2.5 bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-xl border border-purple-500/30">
            <Star size={22} className="text-purple-300" />
          </div>
        </div>
        <div>
          <h2 className="font-bold text-white text-lg tracking-tight">Function Galaxy</h2>
          <p className="text-xs text-purple-400/60 mt-0.5">Explore your codebase universe</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 text-purple-400/60 hover:text-purple-300 hover:bg-purple-900/30 rounded-xl transition-all"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

// Constellation Section - Galaxy-style card layout
interface ConstellationSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

const ConstellationSection = memo(function ConstellationSection({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: ConstellationSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;
  const colors = cosmicTierColors[group.tier];

  if (count === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-900/30 transition-all">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all"
        style={{ background: colors.bg }}
      >
        <div className="flex items-center gap-4">
          {/* Tier badge with glow */}
          <div className="relative">
            <div
              className="absolute inset-0 blur-lg opacity-50"
              style={{ background: colors.primary }}
            />
            <div
              className="relative w-12 h-12 flex items-center justify-center rounded-xl font-black text-xl"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}30, ${colors.primary}10)`,
                border: `2px solid ${colors.primary}`,
                color: colors.primary,
                boxShadow: `0 0 20px ${colors.glow}`,
              }}
            >
              {group.tier}
            </div>
          </div>

          <div className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white text-base">{group.label}</span>
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: `${colors.primary}20`,
                  color: colors.primary,
                }}
              >
                {count} stars
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">
              {tierDescriptions[group.tier]}
            </p>
          </div>
        </div>

        <div
          className="p-2 rounded-lg transition-transform"
          style={{ background: `${colors.primary}20` }}
        >
          {isExpanded ? (
            <ChevronDown size={18} style={{ color: colors.primary }} />
          ) : (
            <ChevronRight size={18} style={{ color: colors.primary }} />
          )}
        </div>
      </button>

      {/* Function Cards Grid */}
      {isExpanded && (
        <div
          className="p-4 grid gap-3"
          style={{
            background: 'rgba(10, 10, 26, 0.8)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {group.functions.map((func) => (
            <StarCard
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
              tierColors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Star Card Component - Individual function card
interface StarCardProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  tierColors: typeof cosmicTierColors['S'];
}

const StarCard = memo(function StarCard({
  func,
  onClick,
  isSelected,
  tierColors,
}: StarCardProps) {
  const starSize = getStarSize(func.internal_call_count);
  const achievements = getAchievements(func);

  const sizeConfig = {
    small: { star: 16, ring: 32 },
    medium: { star: 20, ring: 40 },
    large: { star: 24, ring: 48 },
    supergiant: { star: 28, ring: 56 },
  };

  const config = sizeConfig[starSize];

  return (
    <button
      onClick={() => onClick(func)}
      className={`relative text-left p-4 rounded-xl transition-all duration-300 group ${
        isSelected
          ? 'scale-[1.02]'
          : 'hover:scale-[1.01]'
      }`}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${tierColors.primary}15, ${tierColors.primary}05)`
          : 'rgba(30, 30, 50, 0.5)',
        border: `1px solid ${isSelected ? tierColors.primary : 'rgba(100, 100, 150, 0.2)'}`,
        boxShadow: isSelected ? `0 0 30px ${tierColors.glow}` : 'none',
      }}
    >
      {/* Star indicator in corner */}
      <div className="absolute top-3 right-3">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: config.ring,
            height: config.ring,
          }}
        >
          {/* Animated ring for supergiants */}
          {starSize === 'supergiant' && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: tierColors.primary }}
            />
          )}
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-md"
            style={{ background: tierColors.primary }}
          />
          <Star
            size={config.star}
            className="relative"
            style={{ color: tierColors.primary }}
            fill={tierColors.primary}
          />
        </div>
      </div>

      {/* Function name */}
      <div className="pr-12 mb-3">
        <h3 className="font-bold text-white truncate text-base group-hover:text-purple-200 transition-colors">
          {func.function_name}
        </h3>
        <p className="text-xs text-slate-500 truncate mt-1 flex items-center gap-1.5">
          <FileCode size={11} />
          {func.file_path}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="px-2.5 py-1 rounded-lg flex items-center gap-1.5"
          style={{ background: `${tierColors.primary}20` }}
        >
          <span className="text-sm font-bold" style={{ color: tierColors.primary }}>
            {func.internal_call_count}
          </span>
          <span className="text-xs text-slate-500">calls</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-800/50 flex items-center gap-1.5">
          <Hash size={11} className="text-slate-500" />
          <span className="text-xs text-slate-400">L{func.start_line}</span>
        </div>
        <span
          className="px-2 py-1 rounded-lg text-xs font-medium"
          style={{
            background: `${functionTypeColors[func.function_type]}20`,
            color: functionTypeColors[func.function_type],
          }}
        >
          {functionTypeLabels[func.function_type]}
        </span>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {achievements.map((achievement, idx) => {
            const Icon = achievement.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                style={{
                  background: `${achievement.color}15`,
                  color: achievement.color,
                }}
                title={achievement.label}
              >
                <Icon size={11} />
                <span>{achievement.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
});

// List Section - Compact list view
interface ListSectionProps {
  group: TierGroup;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
  defaultExpanded?: boolean;
}

const ListSection = memo(function ListSection({
  group,
  onFunctionClick,
  selectedFunctionId,
  defaultExpanded = false,
}: ListSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = group.functions.length;
  const colors = cosmicTierColors[group.tier];

  if (count === 0) {
    return null;
  }

  return (
    <div className="rounded-xl overflow-hidden border border-purple-900/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-900/70 transition-all"
      >
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm"
            style={{
              background: `${colors.primary}20`,
              color: colors.primary,
              border: `1px solid ${colors.primary}50`,
            }}
          >
            {group.tier}
          </span>
          <span className="font-medium text-slate-300 text-sm">{group.label}</span>
          <span className="text-xs text-slate-600">({count})</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
        />
      </button>

      {/* List items */}
      {isExpanded && (
        <div className="divide-y divide-purple-900/20">
          {group.functions.map((func) => (
            <ListRow
              key={func.id}
              func={func}
              onClick={onFunctionClick}
              isSelected={selectedFunctionId === func.id}
              tierColors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// List Row Component
interface ListRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  tierColors: typeof cosmicTierColors['S'];
}

const ListRow = memo(function ListRow({
  func,
  onClick,
  isSelected,
  tierColors,
}: ListRowProps) {
  return (
    <button
      onClick={() => onClick(func)}
      className={`w-full text-left px-4 py-3 transition-all ${
        isSelected
          ? 'bg-purple-900/30'
          : 'bg-slate-900/30 hover:bg-slate-900/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-medium text-white truncate">{func.function_name}</span>
          <span className="text-xs text-slate-600 truncate hidden sm:block">{func.file_path}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {func.is_async && <Zap size={12} className="text-amber-500" />}
          {func.is_exported && <Upload size={12} className="text-green-500" />}
          {func.is_entry_point && <Play size={12} className="text-blue-500" />}
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{
              background: `${tierColors.primary}20`,
              color: tierColors.primary,
            }}
          >
            {func.internal_call_count}
          </span>
        </div>
      </div>
    </button>
  );
});
