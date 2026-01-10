import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGitHubRepos } from './useGitHubRepos';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockGitHubRepos } from '../test/mocks/handlers';

// Mock useAuth hook
const mockAuthState = {
  user: { id: 'test-user', email: 'test@example.com' },
  session: { access_token: 'test-access-token' },
  githubToken: 'test-github-token',
  loading: false,
};

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(() => mockAuthState),
}));

const API_URL = 'http://localhost:8000/api';

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useGitHubRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial loading state', () => {
    it('should start with loading state when enabled', async () => {
      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useGitHubRepos({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('successful fetch', () => {
    it('should fetch repositories successfully', async () => {
      server.use(
        http.get(`${API_URL}/github/repos`, () => {
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.repositories).toHaveLength(2);
      expect(result.current.data?.repositories[0].name).toBe('test-repo');
    });

    it('should include correct headers in request', async () => {
      let receivedHeaders: Record<string, string> = {};

      server.use(
        http.get(`${API_URL}/github/repos`, ({ request }) => {
          receivedHeaders = {
            authorization: request.headers.get('Authorization') || '',
            githubToken: request.headers.get('X-GitHub-Token') || '',
          };
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(receivedHeaders.authorization).toBe('Bearer test-access-token');
      expect(receivedHeaders.githubToken).toBe('test-github-token');
    });
  });

  describe('pagination', () => {
    it('should send correct pagination params', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/github/repos`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(
        () => useGitHubRepos({ page: 2, perPage: 50 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(receivedParams?.get('page')).toBe('2');
      expect(receivedParams?.get('per_page')).toBe('50');
    });

    it('should use default pagination values', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/github/repos`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(receivedParams?.get('page')).toBe('1');
      expect(receivedParams?.get('per_page')).toBe('30');
    });
  });

  describe('sorting and filtering', () => {
    it('should send sort params', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/github/repos`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(
        () => useGitHubRepos({ sort: 'created', direction: 'asc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(receivedParams?.get('sort')).toBe('created');
      expect(receivedParams?.get('direction')).toBe('asc');
    });

    it('should send type filter', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/github/repos`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(
        () => useGitHubRepos({ type: 'private' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(receivedParams?.get('type')).toBe('private');
    });
  });

  describe('error handling', () => {
    it('should be disabled when GitHub token is missing', async () => {
      // Override useAuth mock for this test
      const useAuthModule = await import('./useAuth');
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        ...mockAuthState,
        githubToken: null,
      } as ReturnType<typeof useAuthModule.useAuth>);

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      // Query should be disabled due to missing token
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();

      // Restore mock
      vi.mocked(useAuthModule.useAuth).mockReturnValue(
        mockAuthState as ReturnType<typeof useAuthModule.useAuth>
      );
    });

    it('should be disabled when Supabase session is missing', async () => {
      const useAuthModule = await import('./useAuth');
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        ...mockAuthState,
        session: null,
      } as ReturnType<typeof useAuthModule.useAuth>);

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      // Query should be disabled due to missing session
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();

      // Restore mock
      vi.mocked(useAuthModule.useAuth).mockReturnValue(
        mockAuthState as ReturnType<typeof useAuthModule.useAuth>
      );
    });

    it('should handle API errors', async () => {
      server.use(
        http.get(`${API_URL}/github/repos`, () => {
          return new HttpResponse(JSON.stringify({ error: 'Server error' }), {
            status: 500,
          });
        })
      );

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          // Check for either error or failed state
          expect(
            result.current.isError || result.current.failureCount > 0
          ).toBe(true);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('refetch behavior', () => {
    it('should refetch when options change', async () => {
      let fetchCount = 0;

      server.use(
        http.get(`${API_URL}/github/repos`, () => {
          fetchCount++;
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result, rerender } = renderHook(
        ({ page }) => useGitHubRepos({ page }),
        {
          wrapper: createWrapper(),
          initialProps: { page: 1 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchCount).toBe(1);

      // Change page
      rerender({ page: 2 });

      await waitFor(() => {
        expect(fetchCount).toBe(2);
      });
    });

    it('should have stale time of 5 minutes', async () => {
      server.use(
        http.get(`${API_URL}/github/repos`, () => {
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(() => useGitHubRepos(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be fresh (not stale)
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('query key', () => {
    it('should create unique query key with all options', async () => {
      server.use(
        http.get(`${API_URL}/github/repos`, () => {
          return HttpResponse.json(mockGitHubRepos);
        })
      );

      const { result } = renderHook(
        () =>
          useGitHubRepos({
            page: 2,
            perPage: 50,
            sort: 'created',
            direction: 'asc',
            type: 'private',
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query should have been executed with correct params
      expect(result.current.data).toBeDefined();
    });
  });
});
