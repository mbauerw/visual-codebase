import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysis } from './useAnalysis';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  mockAnalyzeResponse,
  mockStatusCompleted,
  mockStatusFailed,
  mockReactFlowGraph,
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

// Mock the network logger
vi.mock('../utils/networkLogger', () => ({
  logAnalysisStart: vi.fn(),
  logStatusPoll: vi.fn(),
  logAnalysisComplete: vi.fn(),
  logAnalysisError: vi.fn(),
}));

const API_URL = '/api';

describe('useAnalysis', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return initial state with no loading, status, result, or error', () => {
      const { result } = renderHook(() => useAnalysis());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should provide analyze and reset functions', () => {
      const { result } = renderHook(() => useAnalysis());

      expect(typeof result.current.analyze).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('analyze function', () => {
    it('should start analysis with local directory path', async () => {
      let analyzeRequestReceived = false;

      server.use(
        http.post(`${API_URL}/analyze`, async ({ request }) => {
          const body = (await request.json()) as { directory_path?: string };
          if (body.directory_path === '/test/local/path') {
            analyzeRequestReceived = true;
          }
          return HttpResponse.json(mockAnalyzeResponse);
        }),
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusCompleted);
        }),
        http.get(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json(mockReactFlowGraph);
        })
      );

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.analyze({ directory_path: '/test/local/path' });
      });

      expect(analyzeRequestReceived).toBe(true);
    });

    it('should start analysis with GitHub repo', async () => {
      let githubRepoReceived = false;

      server.use(
        http.post(`${API_URL}/analyze`, async ({ request }) => {
          const body = (await request.json()) as {
            github_repo?: { owner: string; repo: string };
          };
          if (
            body.github_repo?.owner === 'testowner' &&
            body.github_repo?.repo === 'testrepo'
          ) {
            githubRepoReceived = true;
          }
          return HttpResponse.json(mockAnalyzeResponse);
        }),
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusCompleted);
        }),
        http.get(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json(mockReactFlowGraph);
        })
      );

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.analyze({
          github_repo: { owner: 'testowner', repo: 'testrepo' },
        });
      });

      expect(githubRepoReceived).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should set error when startAnalysis fails', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.analyze({ directory_path: '/test/path' });
      });

      await waitFor(
        () => {
          expect(result.current.error).toBeDefined();
        },
        { timeout: 3000 }
      );

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('reset function', () => {
    it('should reset all state to initial values', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return HttpResponse.json(mockAnalyzeResponse);
        }),
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusCompleted);
        }),
        http.get(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json(mockReactFlowGraph);
        })
      );

      const { result } = renderHook(() => useAnalysis());

      // Start an analysis
      await act(async () => {
        result.current.analyze({ directory_path: '/test/path' });
      });

      // State should have changed
      expect(result.current.status).not.toBeNull();

      // Reset
      await act(async () => {
        result.current.reset();
      });

      // State should be back to initial
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('completion flow', () => {
    it('should complete analysis and fetch result', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return HttpResponse.json(mockAnalyzeResponse);
        }),
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusCompleted);
        }),
        http.get(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json(mockReactFlowGraph);
        })
      );

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.analyze({ directory_path: '/test/path' });
      });

      // Wait for the polling to complete and result to be fetched
      await waitFor(
        () => {
          expect(result.current.result).not.toBeNull();
        },
        { timeout: 5000 }
      );

      expect(result.current.result?.nodes).toHaveLength(2);
      expect(result.current.result?.edges).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle failed analysis', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return HttpResponse.json(mockAnalyzeResponse);
        }),
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusFailed);
        })
      );

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.analyze({ directory_path: '/test/path' });
      });

      // Wait for the polling to detect failure
      await waitFor(
        () => {
          expect(result.current.error).toBeDefined();
        },
        { timeout: 5000 }
      );

      expect(result.current.error).toContain('error');
      expect(result.current.isLoading).toBe(false);
    });
  });
});
