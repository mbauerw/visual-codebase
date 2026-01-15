import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTierList } from './useTierList';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  mockTierListResponse,
  mockFunctionStats,
  mockAnalysisId,
} from '../test/mocks/handlers';

// Mock the Supabase client
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  },
}));

const API_URL = '/api';

describe('useTierList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty functions and loading state', async () => {
      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      expect(result.current.functions).toEqual([]);
      expect(result.current.isLoading).toBe(true);
    });

    it('should not fetch when analysisId is null', async () => {
      const { result } = renderHook(() => useTierList({ analysisId: null }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.functions).toEqual([]);
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId, enabled: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.functions).toEqual([]);
    });
  });

  describe('fetching tier list', () => {
    it('should fetch tier list on mount', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.functions).toHaveLength(2);
      expect(result.current.functions[0].function_name).toBe('handleClick');
    });

    it('should fetch stats along with tier list', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.stats).toBeDefined();
        },
        { timeout: 3000 }
      );

      expect(result.current.stats?.total_functions).toBe(50);
      expect(result.current.stats?.total_calls).toBe(200);
    });

    it('should set tier summary from response', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.tierSummary).toBeDefined();
        },
        { timeout: 3000 }
      );

      expect(result.current.tierSummary?.S).toBe(1);
      expect(result.current.tierSummary?.A).toBe(1);
    });
  });

  describe('filtering', () => {
    it('should filter by tier', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.setTierFilter('S');
      });

      await waitFor(
        () => {
          expect(receivedParams?.get('tier')).toBe('S');
        },
        { timeout: 3000 }
      );
    });

    it('should send search query to API after debounce', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.setSearchQuery('handleClick');
      });

      // Wait for debounce (300ms) and refetch
      await waitFor(
        () => {
          expect(receivedParams?.get('search')).toBe('handleClick');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('sorting', () => {
    it('should send sort params to API', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        result.current.setSortBy('name');
        result.current.setSortOrder('asc');
      });

      await waitFor(
        () => {
          expect(receivedParams?.get('sort_by')).toBe('name');
          expect(receivedParams?.get('sort_order')).toBe('asc');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('pagination', () => {
    it('should track pagination state', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json({
            ...mockTierListResponse,
            page: 1,
            total_pages: 3,
            has_next: true,
          });
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(3);
      expect(result.current.hasMore).toBe(true);
    });

    it('should load more when hasMore is true', async () => {
      const page1Functions = mockTierListResponse.functions;
      const page2Functions = [
        {
          ...mockTierListResponse.functions[0],
          id: 'func3',
          function_name: 'newFunction',
        },
      ];

      let requestPage = 1;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          const url = new URL(request.url);
          requestPage = parseInt(url.searchParams.get('page') || '1');

          if (requestPage === 1) {
            return HttpResponse.json({
              ...mockTierListResponse,
              functions: page1Functions,
              page: 1,
              total_pages: 2,
              has_next: true,
            });
          } else {
            return HttpResponse.json({
              ...mockTierListResponse,
              functions: page2Functions,
              page: 2,
              total_pages: 2,
              has_next: false,
            });
          }
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.functions).toHaveLength(2);

      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(
        () => {
          expect(result.current.functions).toHaveLength(3);
        },
        { timeout: 3000 }
      );

      expect(result.current.hasMore).toBe(false);
    });

    it('should not load more when hasMore is false', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          fetchCount++;
          return HttpResponse.json({
            ...mockTierListResponse,
            page: 1,
            total_pages: 1,
            has_next: false,
          });
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      const initialFetchCount = fetchCount;

      await act(async () => {
        await result.current.loadMore();
      });

      // Should not have fetched again
      expect(fetchCount).toBe(initialFetchCount);
    });
  });

  describe('tier groups', () => {
    it('should group functions by tier', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.tierGroups).toHaveLength(6); // S, A, B, C, D, F

      const sTierGroup = result.current.tierGroups.find((g) => g.tier === 'S');
      expect(sTierGroup?.functions).toHaveLength(1);
      expect(sTierGroup?.functions[0].function_name).toBe('handleClick');

      const aTierGroup = result.current.tierGroups.find((g) => g.tier === 'A');
      expect(aTierGroup?.functions).toHaveLength(1);
      expect(aTierGroup?.functions[0].function_name).toBe('useCustomHook');
    });

    it('should have correct labels and colors for tier groups', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      const sTierGroup = result.current.tierGroups.find((g) => g.tier === 'S');
      expect(sTierGroup?.label).toBe('Critical Functions');
      expect(sTierGroup?.color).toBe('#fbbf24');
    });
  });

  describe('refresh', () => {
    it('should refresh data when refresh is called', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          fetchCount++;
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      const initialFetchCount = fetchCount;

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(
        () => {
          expect(fetchCount).toBeGreaterThan(initialFetchCount);
        },
        { timeout: 3000 }
      );
    });

    it('should reset page to 1 on refresh', async () => {
      let requestPage = 1;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          const url = new URL(request.url);
          requestPage = parseInt(url.searchParams.get('page') || '1');
          return HttpResponse.json({
            ...mockTierListResponse,
            page: requestPage,
            total_pages: 2,
            has_next: requestPage < 2,
          });
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Load second page
      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(
        () => {
          expect(result.current.page).toBe(2);
        },
        { timeout: 3000 }
      );

      // Refresh should reset to page 1
      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(
        () => {
          expect(result.current.page).toBe(1);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('error handling', () => {
    it('should set error on API failure', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.error).toBeDefined();
        },
        { timeout: 3000 }
      );

      expect(result.current.isLoading).toBe(false);
    });

    it('should not set error for stats API failure (non-critical)', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() =>
        useTierList({ analysisId: mockAnalysisId })
      );

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Stats failure should not set error (it's non-critical)
      expect(result.current.error).toBeNull();
      expect(result.current.functions).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('should clear state when analysisId becomes null', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        }),
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const { result, rerender } = renderHook(
        ({ analysisId }) => useTierList({ analysisId }),
        { initialProps: { analysisId: mockAnalysisId as string | null } }
      );

      await waitFor(
        () => {
          expect(result.current.functions).toHaveLength(2);
        },
        { timeout: 3000 }
      );

      // Clear analysisId
      rerender({ analysisId: null });

      expect(result.current.functions).toEqual([]);
      expect(result.current.stats).toBeNull();
      expect(result.current.tierSummary).toBeNull();
    });
  });
});
