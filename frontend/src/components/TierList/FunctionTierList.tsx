import { useState } from 'react';
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
} from 'lucide-react';
import { useTierList } from '../../hooks/useTierList';
import type { FunctionTierItem, TierLevel } from '../../types/tierList';
import { tierColors, tierLabels } from '../../types/tierList';
import { TierSection } from './TierSection';

interface FunctionTierListProps {
  analysisId: string | null;
  onFunctionSelect?: (func: FunctionTierItem) => void;
  onClose?: () => void;
}

export function FunctionTierList({
  analysisId,
  onFunctionSelect,
  onClose,
}: FunctionTierListProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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

  // Loading state
  if (isLoading && !tierGroups.length) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading functions...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-400 px-4 text-center">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm">{error}</span>
            <button
              onClick={refresh}
              className="text-xs text-slate-400 hover:text-white transition-colors"
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
      <div className="h-full flex flex-col bg-slate-900">
        <Header onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 px-4">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No analysis selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <Header onClose={onClose} />

      {/* Stats bar */}
      {stats && tierSummary && (
        <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {stats.total_functions} functions, {stats.total_calls} calls
            </span>
            <div className="flex items-center gap-1">
              {(['S', 'A', 'B', 'C', 'D', 'F'] as TierLevel[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                  className={`w-6 h-5 flex items-center justify-center rounded text-xs font-medium transition-all ${
                    tierFilter === tier
                      ? 'ring-1 ring-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${tierColors[tier]}30`,
                    color: tierColors[tier],
                  }}
                  title={`${tierLabels[tier]}: ${tierSummary[tier]}`}
                >
                  {tierSummary[tier]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="px-4 py-3 border-b border-slate-700 space-y-2">
        {/* Search bar */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

        {/* Filter controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Filter size={12} />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
            >
              {sortOrder === 'desc' ? <SortDesc size={12} /> : <SortAsc size={12} />}
              {sortBy === 'call_count' ? 'Calls' : sortBy === 'name' ? 'Name' : sortBy}
            </button>
          </div>

          <button
            onClick={refresh}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="pt-2 space-y-2 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
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
                className="w-full py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tier sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {tierGroups.map((group) => (
          <TierSection
            key={group.tier}
            group={group}
            onFunctionClick={handleFunctionClick}
            selectedFunctionId={selectedFunctionId}
            defaultExpanded={group.tier === 'S' || group.tier === 'A'}
          />
        ))}

        {/* Empty search result */}
        {tierGroups.every((g) => g.functions.length === 0) && (
          <div className="text-center text-slate-400 py-8">
            <p className="text-sm">No functions match your filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
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

// Header component
function Header({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-amber-400" />
        <h2 className="font-semibold text-white">Function Tier List</h2>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
