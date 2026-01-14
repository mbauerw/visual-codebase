import { useState, memo } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  X,
  AlertCircle,
  Loader2,
  Trophy,
  Flame,
  Zap,
  Upload,
  Play,
  FileCode,
  Hash,
  ChevronDown,
  Target,
  Star,
  Shield,
} from 'lucide-react';
import { useTierList } from '../../../hooks/useTierList';
import type { FunctionTierItem, TierLevel, TierGroup } from '../../../types/tierList';
import {
  tierColors,
  tierLabels,
  functionTypeLabels,
  functionTypeColors,
} from '../../../types/tierList';

interface GamingTierDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

// Gaming-themed tier colors with neon accents
const gamingTierColors: Record<TierLevel, { primary: string; glow: string; bg: string; gradient: string }> = {
  S: {
    primary: '#ffd700',
    glow: 'rgba(255, 215, 0, 0.5)',
    bg: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 223, 0, 0.05) 100%)',
    gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
  },
  A: {
    primary: '#ff00ff',
    glow: 'rgba(255, 0, 255, 0.4)',
    bg: 'linear-gradient(135deg, rgba(255, 0, 255, 0.12) 0%, rgba(236, 72, 153, 0.05) 100%)',
    gradient: 'linear-gradient(135deg, #ff00ff 0%, #ff69f5 100%)',
  },
  B: {
    primary: '#00d9ff',
    glow: 'rgba(0, 217, 255, 0.4)',
    bg: 'linear-gradient(135deg, rgba(0, 217, 255, 0.12) 0%, rgba(14, 165, 233, 0.05) 100%)',
    gradient: 'linear-gradient(135deg, #00d9ff 0%, #5ce1ff 100%)',
  },
  C: {
    primary: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.3)',
    bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(109, 40, 217, 0.04) 100%)',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
  },
  D: {
    primary: '#64748b',
    glow: 'rgba(100, 116, 139, 0.2)',
    bg: 'linear-gradient(135deg, rgba(100, 116, 139, 0.08) 0%, rgba(71, 85, 105, 0.03) 100%)',
    gradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
  },
  F: {
    primary: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.3)',
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.04) 100%)',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
  },
};

// Tier icons for gaming aesthetic
const tierIcons: Record<TierLevel, React.ReactNode> = {
  S: <Trophy className="w-full h-full" />,
  A: <Flame className="w-full h-full" />,
  B: <Star className="w-full h-full" />,
  C: <Shield className="w-full h-full" />,
  D: <Target className="w-full h-full" />,
  F: <X className="w-full h-full" />,
};

export function GamingTierDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: GamingTierDesignProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Set<TierLevel>>(new Set(['S', 'A']));

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

  const toggleTier = (tier: TierLevel) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
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
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <GamingHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
              <div className="absolute inset-0 w-16 h-16 bg-cyan-400/20 blur-xl animate-pulse" />
            </div>
            <span className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
              Loading Battle Data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <GamingHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 px-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <span className="text-sm text-red-400 font-medium">{error}</span>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors"
            >
              Retry Mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!analysisId) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <GamingHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 px-4">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No Battle Selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-magenta-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <GamingHeader onClose={onClose} />

        {/* Epic stats bar with power level display */}
        {stats && tierSummary && (
          <div className="px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-slate-900/50 via-slate-800/50 to-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              {/* Stats */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                    <Flame className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xs">
                    <div className="text-cyan-300 font-bold">{stats.total_functions}</div>
                    <div className="text-slate-500 uppercase tracking-wide">Functions</div>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-700" />
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-magenta-500/20 rounded-lg">
                    <Target className="w-4 h-4 text-magenta-400" />
                  </div>
                  <div className="text-xs">
                    <div className="text-magenta-300 font-bold">{stats.total_calls}</div>
                    <div className="text-slate-500 uppercase tracking-wide">Calls</div>
                  </div>
                </div>
              </div>

              {/* Tier quick filters */}
              <div className="flex items-center gap-1.5">
                {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => {
                  const colors = gamingTierColors[tier];
                  const isActive = tierFilter === tier;
                  return (
                    <button
                      key={tier}
                      onClick={() => setTierFilter(isActive ? null : tier)}
                      className={`relative group`}
                      title={`${tierLabels[tier]}: ${tierSummary[tier]} functions`}
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs transition-all ${
                          isActive ? 'scale-110 ring-2 ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                        }`}
                        style={{
                          background: colors.gradient,
                          boxShadow: isActive ? `0 0 20px ${colors.glow}` : 'none',
                        }}
                      >
                        <span className="text-slate-950">{tier}</span>
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          isActive ? 'animate-pulse' : ''
                        }`}
                        style={{
                          backgroundColor: colors.primary,
                          color: '#0f172a',
                        }}
                      >
                        {tierSummary[tier]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search and filters */}
        <div className="px-4 py-3 border-b border-slate-800 space-y-3">
          {/* Search bar with gaming aesthetic */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-magenta-500/10 rounded-lg blur-sm" />
            <div className="relative flex items-center">
              <Search
                size={18}
                className="absolute left-3 text-cyan-400"
              />
              <input
                type="text"
                placeholder="Search functions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-900/80 border border-cyan-500/30 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all backdrop-blur-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filter controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  showFilters || hasActiveFilters
                    ? 'bg-gradient-to-r from-cyan-500 to-magenta-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50'
                } border border-transparent`}
              >
                <Filter size={14} />
                FILTERS
                {hasActiveFilters && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-400 transition-colors"
                >
                  CLEAR ALL
                </button>
              )}
            </div>

            <button
              onClick={refresh}
              className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="pt-3 space-y-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 block">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full px-2 py-2 text-xs font-medium bg-slate-800 border border-slate-700 rounded-lg text-cyan-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  >
                    <option value="call_count">Power Level</option>
                    <option value="name">Name</option>
                    <option value="file">File</option>
                    <option value="tier">Tier</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 block">
                    Order
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full px-2 py-2 text-xs font-medium bg-slate-800 border border-slate-700 rounded-lg text-cyan-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tier sections with gaming card layout */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {tierGroups.map((group) => (
            <GamingTierSection
              key={group.tier}
              group={group}
              isExpanded={expandedTiers.has(group.tier)}
              onToggle={() => toggleTier(group.tier)}
              onFunctionClick={handleFunctionClick}
              selectedFunctionId={selectedFunctionId}
            />
          ))}

          {/* Empty search result */}
          {tierGroups.every((g) => g.functions.length === 0) && (
            <div className="text-center text-slate-400 py-12">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No functions match your filters</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  RESET FILTERS
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Gaming header component
function GamingHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="relative px-4 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-magenta-500 rounded-xl blur-lg opacity-50" />
            <div className="relative p-2 bg-gradient-to-br from-cyan-500 to-magenta-500 rounded-xl">
              <Trophy size={24} className="text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-magenta-400 uppercase tracking-wide">
              Function Tier List
            </h2>
            <p className="text-xs text-slate-500 font-medium">Battle-tested code rankings</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

// Gaming tier section component
interface GamingTierSectionProps {
  group: TierGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onFunctionClick: (func: FunctionTierItem) => void;
  selectedFunctionId?: string | null;
}

const GamingTierSection = memo(function GamingTierSection({
  group,
  isExpanded,
  onToggle,
  onFunctionClick,
  selectedFunctionId,
}: GamingTierSectionProps) {
  if (group.functions.length === 0) {
    return null;
  }

  const colors = gamingTierColors[group.tier];

  return (
    <div className="relative">
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-xl blur-xl opacity-20"
        style={{ background: colors.gradient }}
      />

      <div className="relative border-2 rounded-xl overflow-hidden transition-all"
        style={{ borderColor: colors.primary + '40' }}
      >
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-4 hover:brightness-110 transition-all group"
          style={{ background: colors.bg }}
        >
          <div className="flex items-center gap-4">
            {/* Tier badge with icon */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-xl blur-md"
                style={{ backgroundColor: colors.glow }}
              />
              <div
                className="relative w-14 h-14 flex items-center justify-center rounded-xl font-black text-2xl shadow-2xl"
                style={{
                  background: colors.gradient,
                  boxShadow: `0 0 30px ${colors.glow}`,
                }}
              >
                <div className="w-7 h-7 text-slate-950">
                  {tierIcons[group.tier]}
                </div>
              </div>
            </div>

            {/* Label */}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span
                  className="text-xl font-black uppercase tracking-wider"
                  style={{ color: colors.primary }}
                >
                  {group.tier} TIER
                </span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  style={{ color: colors.primary }}
                />
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {group.label}
              </p>
            </div>
          </div>

          {/* Count badge */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-md"
              style={{ backgroundColor: colors.glow }}
            />
            <div
              className="relative px-4 py-2 rounded-full font-black text-sm"
              style={{
                background: colors.gradient,
                color: '#0f172a',
              }}
            >
              {group.functions.length}
            </div>
          </div>
        </button>

        {/* Content - Gaming cards */}
        {isExpanded && (
          <div className="p-3 space-y-2 bg-slate-900/50 backdrop-blur-sm">
            {group.functions.map((func) => (
              <GamingFunctionCard
                key={func.id}
                func={func}
                onClick={onFunctionClick}
                isSelected={selectedFunctionId === func.id}
                tierColor={colors.primary}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// Gaming function card component
interface GamingFunctionCardProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected: boolean;
  tierColor: string;
}

const GamingFunctionCard = memo(function GamingFunctionCard({
  func,
  onClick,
  isSelected,
  tierColor,
}: GamingFunctionCardProps) {
  const maxCalls = 1000; // Normalize to this value for display
  const powerLevel = Math.min(100, (func.internal_call_count / maxCalls) * 100);
  const typeColor = functionTypeColors[func.function_type];

  return (
    <button
      onClick={() => onClick(func)}
      className={`w-full group relative overflow-hidden rounded-lg transition-all duration-200 ${
        isSelected
          ? 'scale-[1.02]'
          : 'hover:scale-[1.01]'
      }`}
    >
      {/* Card glow on hover/select */}
      <div
        className={`absolute inset-0 rounded-lg blur-xl transition-opacity ${
          isSelected ? 'opacity-30' : 'opacity-0 group-hover:opacity-20'
        }`}
        style={{ backgroundColor: tierColor }}
      />

      {/* Card content */}
      <div
        className={`relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 rounded-lg p-3 backdrop-blur-sm transition-all ${
          isSelected
            ? 'ring-2 ring-offset-2 ring-offset-slate-900'
            : ''
        }`}
        style={{
          borderColor: isSelected ? tierColor : 'rgba(71, 85, 105, 0.5)',
          ringColor: isSelected ? tierColor : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left side - Function info */}
          <div className="flex-1 min-w-0">
            {/* Function name and badges */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-white text-sm truncate">
                {func.function_name}
              </span>
              <div className="flex items-center gap-1">
                {func.is_async && (
                  <div
                    className="p-1 rounded"
                    style={{ backgroundColor: '#fbbf2420' }}
                    title="Async"
                  >
                    <Zap size={10} className="text-yellow-400" />
                  </div>
                )}
                {func.is_exported && (
                  <div
                    className="p-1 rounded"
                    style={{ backgroundColor: '#10b98120' }}
                    title="Exported"
                  >
                    <Upload size={10} className="text-green-400" />
                  </div>
                )}
                {func.is_entry_point && (
                  <div
                    className="p-1 rounded"
                    style={{ backgroundColor: '#3b82f620' }}
                    title="Entry Point"
                  >
                    <Play size={10} className="text-blue-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Function metadata */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className="px-2 py-0.5 rounded-md font-bold uppercase"
                style={{
                  backgroundColor: `${typeColor}20`,
                  color: typeColor,
                }}
              >
                {functionTypeLabels[func.function_type]}
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <FileCode size={10} />
                {func.file_name}
              </span>
              <span className="text-slate-600 flex items-center gap-1">
                <Hash size={10} />
                {func.start_line}
              </span>
            </div>
          </div>

          {/* Right side - Power level display */}
          <div className="flex flex-col items-center gap-1">
            {/* Radial progress */}
            <div className="relative w-14 h-14">
              {/* Background circle */}
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="rgba(71, 85, 105, 0.3)"
                  strokeWidth="3"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke={tierColor}
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - powerLevel / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  style={{
                    filter: `drop-shadow(0 0 4px ${tierColor})`,
                  }}
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-lg font-black"
                  style={{ color: tierColor }}
                >
                  {func.internal_call_count}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Calls
            </span>
          </div>
        </div>

        {/* Power level bar */}
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 font-medium">Power Level</span>
            <span
              className="font-bold"
              style={{ color: tierColor }}
            >
              {powerLevel.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${powerLevel}%`,
                background: `linear-gradient(90deg, ${tierColor} 0%, ${tierColor}dd 100%)`,
                boxShadow: `0 0 8px ${tierColor}80`,
              }}
            />
          </div>
        </div>
      </div>
    </button>
  );
});
