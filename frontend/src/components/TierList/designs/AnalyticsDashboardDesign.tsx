import { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  X,
  AlertCircle,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Upload,
  Play,
  ChevronDown,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { useTierList } from '../../../hooks/useTierList';
import type { FunctionTierItem, TierLevel, FunctionType } from '../../../types/tierList';
import {
  tierColors,
  tierLabels,
  functionTypeLabels,
  functionTypeColors,
} from '../../../types/tierList';

interface AnalyticsDashboardDesignProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

export function AnalyticsDashboardDesign({
  analysisId,
  onFunctionSelect,
  onClose,
}: AnalyticsDashboardDesignProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Flatten all functions for table view
  const allFunctions = useMemo(() => {
    return tierGroups.flatMap((group) => group.functions);
  }, [tierGroups]);

  // Calculate max call count for bar scaling
  const maxCallCount = useMemo(() => {
    return Math.max(...allFunctions.map((f) => f.internal_call_count), 1);
  }, [allFunctions]);

  // Loading state
  if (isLoading && !tierGroups.length) {
    return (
      <div className="h-full flex flex-col bg-slate-950">
        <AnalyticsHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <span className="text-sm">Analyzing function metrics...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-slate-950">
        <AnalyticsHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-400 px-4 text-center">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm">{error}</span>
            <button
              onClick={refresh}
              className="text-xs text-slate-400 hover:text-white transition-colors mt-2 px-4 py-2 bg-slate-800 rounded-lg"
            >
              Retry Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!analysisId) {
    return (
      <div className="h-full flex flex-col bg-slate-950">
        <AnalyticsHeader onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 px-4">
            <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No Analysis Loaded</p>
            <p className="text-xs text-slate-500 mt-1">
              Select an analysis to view function metrics
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <AnalyticsHeader onClose={onClose} />

      {/* Metrics Dashboard */}
      {stats && tierSummary && (
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Total Functions Card */}
            <MetricCard
              label="Total Functions"
              value={stats.total_functions}
              icon={<Activity className="w-5 h-5" />}
              color="blue"
              trend={null}
            />

            {/* Total Calls Card */}
            <MetricCard
              label="Total Calls"
              value={stats.total_calls}
              icon={<TrendingUp className="w-5 h-5" />}
              color="emerald"
              trend={null}
            />

            {/* Avg Calls Card */}
            <MetricCard
              label="Avg Calls/Function"
              value={(stats.total_calls / stats.total_functions).toFixed(1)}
              icon={<BarChart3 className="w-5 h-5" />}
              color="orange"
              trend={null}
            />
          </div>

          {/* Tier Distribution Heatmap */}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-2">
              <SlidersHorizontal className="w-3 h-3" />
              TIER DISTRIBUTION
            </div>
            <div className="grid grid-cols-6 gap-2">
              {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => {
                const count = tierSummary[tier] || 0;
                const percentage = (count / stats.total_functions) * 100;
                return (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                    className={`relative overflow-hidden rounded-lg p-3 transition-all ${
                      tierFilter === tier
                        ? 'ring-2 ring-white scale-105'
                        : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: `${tierColors[tier]}20`,
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `linear-gradient(180deg, ${tierColors[tier]} 0%, transparent 100%)`,
                        height: `${percentage}%`,
                        bottom: 0,
                        top: 'auto',
                      }}
                    />
                    <div className="relative">
                      <div
                        className="text-2xl font-bold mb-1"
                        style={{ color: tierColors[tier] }}
                      >
                        {tier}
                      </div>
                      <div className="text-lg font-semibold text-white">{count}</div>
                      <div className="text-xs text-slate-400">{percentage.toFixed(0)}%</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Search functions by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="call_count">Sort: Call Count</option>
            <option value="name">Sort: Name</option>
            <option value="file">Sort: File</option>
            <option value="tier">Sort: Tier</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            title={`Sort ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
          >
            <ArrowUpDown size={16} />
          </button>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showAdvancedFilters
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
            title="Advanced Filters"
          >
            <Filter size={16} />
          </button>

          {/* Refresh */}
          <button
            onClick={refresh}
            className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Active Filters */}
        {(tierFilter || searchQuery) && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500 font-medium">ACTIVE FILTERS:</span>
            {tierFilter && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${tierColors[tierFilter]}20`,
                  color: tierColors[tierFilter],
                }}
              >
                Tier {tierFilter}
                <button
                  onClick={() => setTierFilter(null)}
                  className="hover:opacity-70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:opacity-70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {allFunctions.length > 0 ? (
          <div className="space-y-2">
            {allFunctions.map((func) => (
              <FunctionDataRow
                key={func.id}
                func={func}
                onClick={handleFunctionClick}
                isSelected={selectedFunctionId === func.id}
                isExpanded={expandedRows.has(func.id)}
                onToggleExpand={toggleRowExpanded}
                maxCallCount={maxCallCount}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No functions match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setTierFilter(null);
              }}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Header Component
function AnalyticsHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-lg border border-blue-500/30">
          <Activity size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="font-bold text-white text-lg">Function Analytics</h2>
          <p className="text-xs text-slate-400">Performance metrics and call patterns</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'orange';
  trend: 'up' | 'down' | null;
}

function MetricCard({ label, value, icon, color, trend }: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
    emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
  };

  return (
    <div
      className={`p-4 rounded-lg border bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label}
        </div>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-white">{value}</div>
        {trend && (
          <div className={trend === 'up' ? 'text-emerald-400' : 'text-red-400'}>
            {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
        )}
      </div>
    </div>
  );
}

// Function Data Row Component
interface FunctionDataRowProps {
  func: FunctionTierItem;
  onClick: (func: FunctionTierItem) => void;
  isSelected?: boolean;
  isExpanded?: boolean;
  onToggleExpand: (id: string) => void;
  maxCallCount: number;
}

function FunctionDataRow({
  func,
  onClick,
  isSelected,
  isExpanded,
  onToggleExpand,
  maxCallCount,
}: FunctionDataRowProps) {
  const barWidth = (func.internal_call_count / maxCallCount) * 100;

  return (
    <div
      className={`group bg-slate-900 border rounded-lg overflow-hidden transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Main Row */}
      <div
        onClick={() => onClick(func)}
        className="cursor-pointer p-4 grid grid-cols-12 gap-4 items-center"
      >
        {/* Tier Badge */}
        <div className="col-span-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border-2"
            style={{
              backgroundColor: `${tierColors[func.tier]}20`,
              color: tierColors[func.tier],
              borderColor: `${tierColors[func.tier]}40`,
            }}
          >
            {func.tier}
          </div>
        </div>

        {/* Function Info */}
        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white truncate">{func.function_name}</span>
            <div className="flex items-center gap-1">
              {func.is_async && (
                <div className="p-1 bg-yellow-500/20 rounded" title="Async">
                  <Zap size={10} className="text-yellow-400" />
                </div>
              )}
              {func.is_exported && (
                <div className="p-1 bg-green-500/20 rounded" title="Exported">
                  <Upload size={10} className="text-green-400" />
                </div>
              )}
              {func.is_entry_point && (
                <div className="p-1 bg-blue-500/20 rounded" title="Entry Point">
                  <Play size={10} className="text-blue-400" />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className="px-2 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${functionTypeColors[func.function_type]}20`,
                color: functionTypeColors[func.function_type],
              }}
            >
              {functionTypeLabels[func.function_type]}
            </span>
            <span className="truncate">{func.file_name}</span>
          </div>
        </div>

        {/* Call Count Bar Chart */}
        <div className="col-span-5">
          <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${barWidth}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="text-xs font-medium text-white z-10">
                {func.internal_call_count} calls
              </span>
              <span className="text-xs text-slate-300 z-10">
                {((func.internal_call_count / maxCallCount) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <div className="col-span-2 flex items-center justify-end gap-2">
          <div className="text-xs text-slate-400">Line {func.start_line}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(func.id);
            }}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-950/50">
          <div className="grid grid-cols-3 gap-4">
            <DetailMetric
              label="Internal Calls"
              value={func.internal_call_count}
              color="blue"
            />
            <DetailMetric
              label="External Calls"
              value={func.external_call_count}
              color="emerald"
            />
            <DetailMetric
              label="Parameters"
              value={func.parameters_count}
              color="orange"
            />
          </div>
          <div className="mt-3 text-xs text-slate-400">
            <div className="font-mono bg-slate-900 p-2 rounded">
              {func.file_path}:{func.start_line}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Detail Metric Component
interface DetailMetricProps {
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'orange';
}

function DetailMetric({ label, value, color }: DetailMetricProps) {
  const colorClasses = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="bg-slate-900 p-3 rounded-lg">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}
