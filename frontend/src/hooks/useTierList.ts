import { useState, useCallback, useEffect, useMemo } from 'react';
import { getTierList, getFunctionStats } from '../api/client';
import type {
  FunctionStats,
  FunctionTierItem,
  TierLevel,
  TierListQueryParams,
  TierGroup,
} from '../types/tierList';
import { tierColors, tierLabels } from '../types/tierList';

interface UseTierListOptions {
  analysisId: string | null;
  enabled?: boolean;
  initialPerPage?: number;
}

interface UseTierListReturn {
  // Data
  tierGroups: TierGroup[];
  functions: FunctionTierItem[];
  stats: FunctionStats | null;
  tierSummary: Record<TierLevel, number> | null;

  // Loading/Error states
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;

  // Pagination
  page: number;
  totalPages: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tierFilter: TierLevel | null;
  setTierFilter: (tier: TierLevel | null) => void;
  sortBy: TierListQueryParams['sort_by'];
  setSortBy: (sort: TierListQueryParams['sort_by']) => void;
  sortOrder: TierListQueryParams['sort_order'];
  setSortOrder: (order: TierListQueryParams['sort_order']) => void;

  // Actions
  refresh: () => Promise<void>;
}

export function useTierList({
  analysisId,
  enabled = true,
  initialPerPage = 100,
}: UseTierListOptions): UseTierListReturn {
  // Data state
  const [functions, setFunctions] = useState<FunctionTierItem[]>([]);
  const [stats, setStats] = useState<FunctionStats | null>(null);
  const [tierSummary, setTierSummary] = useState<Record<TierLevel, number> | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierLevel | null>(null);
  const [sortBy, setSortBy] = useState<TierListQueryParams['sort_by']>('call_count');
  const [sortOrder, setSortOrder] = useState<TierListQueryParams['sort_order']>('desc');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build query params
  const queryParams = useMemo((): TierListQueryParams => ({
    tier: tierFilter || undefined,
    search: debouncedSearch || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    page: 1,
    per_page: initialPerPage,
  }), [tierFilter, debouncedSearch, sortBy, sortOrder, initialPerPage]);

  // Fetch tier list data
  const fetchTierList = useCallback(async (
    params: TierListQueryParams,
    append = false
  ) => {
    if (!analysisId) return;

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await getTierList(analysisId, params);

      if (append) {
        setFunctions(prev => [...prev, ...response.functions]);
      } else {
        setFunctions(response.functions);
        setTierSummary(response.tier_summary as Record<TierLevel, number>);
      }

      setPage(response.page);
      setTotalPages(response.total_pages);
      setHasMore(response.has_next);
    } catch (err) {
      console.error('Failed to fetch tier list:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tier list');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [analysisId]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!analysisId) return;

    try {
      const statsData = await getFunctionStats(analysisId);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch function stats:', err);
      // Non-critical error, don't set error state
    }
  }, [analysisId]);

  // Initial load
  useEffect(() => {
    if (!enabled || !analysisId) {
      setFunctions([]);
      setStats(null);
      setTierSummary(null);
      return;
    }

    fetchTierList(queryParams);
    fetchStats();
  }, [enabled, analysisId, queryParams, fetchTierList, fetchStats]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;

    await fetchTierList({
      ...queryParams,
      page: page + 1,
    }, true);
  }, [hasMore, isLoadingMore, queryParams, page, fetchTierList]);

  // Refresh
  const refresh = useCallback(async () => {
    setPage(1);
    await fetchTierList(queryParams);
    await fetchStats();
  }, [queryParams, fetchTierList, fetchStats]);

  // Group functions by tier
  const tierGroups = useMemo((): TierGroup[] => {
    const groups: Record<TierLevel, FunctionTierItem[]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
      F: [],
    };

    functions.forEach(func => {
      if (groups[func.tier]) {
        groups[func.tier].push(func);
      }
    });

    const tiers: TierLevel[] = ['S', 'A', 'B', 'C', 'D', 'F'];
    return tiers.map(tier => ({
      tier,
      label: tierLabels[tier],
      functions: groups[tier],
      color: tierColors[tier],
    }));
  }, [functions]);

  return {
    // Data
    tierGroups,
    functions,
    stats,
    tierSummary,

    // Loading/Error states
    isLoading,
    isLoadingMore,
    error,

    // Pagination
    page,
    totalPages,
    hasMore,
    loadMore,

    // Filters
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,

    // Actions
    refresh,
  };
}
