import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
  checkHealth,
  getUserAnalyses,
  deleteAnalysis,
  updateAnalysisTitle,
  getFileContent,
  getTierList,
  getFunctionDetail,
  getFunctionStats,
} from './client';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  mockAnalysisId,
  mockAnalyzeResponse,
  mockStatusCompleted,
  mockReactFlowGraph,
  mockTierListResponse,
  mockFunctionStats,
  mockUserAnalyses,
} from '../test/mocks/handlers';

// Mock the Supabase client
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-access-token' } },
        error: null,
      }),
    },
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const API_URL = '/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('startAnalysis', () => {
    it('should start analysis with local directory', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return HttpResponse.json(mockAnalyzeResponse);
        })
      );

      const response = await startAnalysis({
        directory_path: '/test/path',
      });

      expect(response.analysis_id).toBe(mockAnalysisId);
      expect(response.status).toBe('pending');
    });

    it('should start analysis with GitHub repo', async () => {
      let receivedBody: { github_repo?: { owner: string; repo: string } } | null = null;

      server.use(
        http.post(`${API_URL}/analyze`, async ({ request }) => {
          receivedBody = await request.json() as typeof receivedBody;
          return HttpResponse.json(mockAnalyzeResponse);
        })
      );

      await startAnalysis({
        github_repo: { owner: 'testowner', repo: 'testrepo' },
      });

      expect(receivedBody?.github_repo?.owner).toBe('testowner');
      expect(receivedBody?.github_repo?.repo).toBe('testrepo');
    });

    it('should include GitHub token header for GitHub repos', async () => {
      localStorageMock.setItem('github_provider_token', 'test-github-token');

      let receivedHeaders: Record<string, string> = {};

      server.use(
        http.post(`${API_URL}/analyze`, ({ request }) => {
          receivedHeaders = {
            githubToken: request.headers.get('X-GitHub-Token') || '',
          };
          return HttpResponse.json(mockAnalyzeResponse);
        })
      );

      await startAnalysis({
        github_repo: { owner: 'testowner', repo: 'testrepo' },
      });

      expect(receivedHeaders.githubToken).toBe('test-github-token');
    });

    it('should not include GitHub token for local analysis', async () => {
      localStorageMock.setItem('github_provider_token', 'test-github-token');

      let receivedHeaders: Record<string, string> = {};

      server.use(
        http.post(`${API_URL}/analyze`, ({ request }) => {
          receivedHeaders = {
            githubToken: request.headers.get('X-GitHub-Token') || '',
          };
          return HttpResponse.json(mockAnalyzeResponse);
        })
      );

      await startAnalysis({
        directory_path: '/test/path',
      });

      expect(receivedHeaders.githubToken).toBe('');
    });

    it('should include auth token in request', async () => {
      let receivedAuth = '';

      server.use(
        http.post(`${API_URL}/analyze`, ({ request }) => {
          receivedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json(mockAnalyzeResponse);
        })
      );

      await startAnalysis({
        directory_path: '/test/path',
      });

      expect(receivedAuth).toBe('Bearer test-access-token');
    });
  });

  describe('getAnalysisStatus', () => {
    it('should fetch analysis status', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return HttpResponse.json(mockStatusCompleted);
        })
      );

      const status = await getAnalysisStatus(mockAnalysisId);

      expect(status.status).toBe('completed');
      expect(status.progress).toBe(100);
    });

    it('should throw on 404', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/status`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(getAnalysisStatus('invalid-id')).rejects.toThrow();
    });
  });

  describe('getAnalysisResult', () => {
    it('should fetch analysis result', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json(mockReactFlowGraph);
        })
      );

      const result = await getAnalysisResult(mockAnalysisId);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.metadata.analysis_id).toBe(mockAnalysisId);
    });
  });

  describe('checkHealth', () => {
    it('should return health status', async () => {
      server.use(
        http.get(`${API_URL}/health`, () => {
          return HttpResponse.json({ status: 'ok' });
        })
      );

      const health = await checkHealth();

      expect(health.status).toBe('ok');
    });
  });

  describe('getUserAnalyses', () => {
    it('should fetch user analyses', async () => {
      server.use(
        http.get(`${API_URL}/user/analyses`, () => {
          return HttpResponse.json(mockUserAnalyses);
        })
      );

      const result = await getUserAnalyses();

      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].id).toBe(mockAnalysisId);
    });
  });

  describe('deleteAnalysis', () => {
    it('should delete analysis', async () => {
      server.use(
        http.delete(`${API_URL}/analysis/:id`, () => {
          return HttpResponse.json({ message: 'Analysis deleted' });
        })
      );

      const result = await deleteAnalysis(mockAnalysisId);

      expect(result.message).toBe('Analysis deleted');
    });

    it('should throw on 403 (not owned)', async () => {
      server.use(
        http.delete(`${API_URL}/analysis/:id`, () => {
          return new HttpResponse(JSON.stringify({ detail: 'Not authorized' }), {
            status: 403,
          });
        })
      );

      await expect(deleteAnalysis(mockAnalysisId)).rejects.toThrow();
    });
  });

  describe('updateAnalysisTitle', () => {
    it('should update analysis title', async () => {
      let receivedBody: { user_title?: string } | null = null;

      server.use(
        http.patch(`${API_URL}/analysis/:id`, async ({ request }) => {
          receivedBody = await request.json() as typeof receivedBody;
          return HttpResponse.json({ message: 'Title updated' });
        })
      );

      await updateAnalysisTitle(mockAnalysisId, 'New Title');

      expect(receivedBody?.user_title).toBe('New Title');
    });

    it('should clear title when null is passed', async () => {
      let receivedBody: { user_title?: string | null } | null = null;

      server.use(
        http.patch(`${API_URL}/analysis/:id`, async ({ request }) => {
          receivedBody = await request.json() as typeof receivedBody;
          return HttpResponse.json({ message: 'Title updated' });
        })
      );

      await updateAnalysisTitle(mockAnalysisId, null);

      expect(receivedBody?.user_title).toBeNull();
    });
  });

  describe('getFileContent', () => {
    it('should fetch file content', async () => {
      const mockContent = {
        content: 'export const test = "hello";',
        source: 'database' as const,
        available: true,
      };

      server.use(
        http.get(`${API_URL}/analysis/:id/file/:nodeId/content`, () => {
          return HttpResponse.json(mockContent);
        })
      );

      const result = await getFileContent(mockAnalysisId, 'node1');

      expect(result.content).toBe('export const test = "hello";');
      expect(result.source).toBe('database');
      expect(result.available).toBe(true);
    });

    it('should encode node ID in URL', async () => {
      let requestedUrl = '';

      server.use(
        http.get(`${API_URL}/analysis/:id/file/:nodeId/content`, ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json({
            content: null,
            source: 'database',
            available: false,
          });
        })
      );

      await getFileContent(mockAnalysisId, 'src/components/App.tsx');

      // Node ID should be URL encoded
      expect(requestedUrl).toContain('src%2Fcomponents%2FApp.tsx');
    });

    it('should handle unavailable content', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/file/:nodeId/content`, () => {
          return HttpResponse.json({
            content: null,
            source: 'filesystem',
            available: false,
            error: 'File not found',
          });
        })
      );

      const result = await getFileContent(mockAnalysisId, 'nonexistent.ts');

      expect(result.content).toBeNull();
      expect(result.available).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('getTierList', () => {
    it('should fetch tier list without params', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
          return HttpResponse.json(mockTierListResponse);
        })
      );

      const result = await getTierList(mockAnalysisId);

      expect(result.functions).toHaveLength(2);
      expect(result.total_functions).toBe(5);
    });

    it('should include query params', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        })
      );

      await getTierList(mockAnalysisId, {
        tier: 'S',
        search: 'handle',
        sort_by: 'name',
        sort_order: 'asc',
        page: 2,
        per_page: 50,
      });

      expect(receivedParams?.get('tier')).toBe('S');
      expect(receivedParams?.get('search')).toBe('handle');
      expect(receivedParams?.get('sort_by')).toBe('name');
      expect(receivedParams?.get('sort_order')).toBe('asc');
      expect(receivedParams?.get('page')).toBe('2');
      expect(receivedParams?.get('per_page')).toBe('50');
    });

    it('should include file and type filters', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        })
      );

      await getTierList(mockAnalysisId, {
        file: 'App.tsx',
        type: 'hook',
      });

      expect(receivedParams?.get('file')).toBe('App.tsx');
      expect(receivedParams?.get('type')).toBe('hook');
    });

    it('should omit undefined params', async () => {
      let receivedParams: URLSearchParams | null = null;

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/tier-list`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockTierListResponse);
        })
      );

      await getTierList(mockAnalysisId, {
        tier: 'S',
        // Other params undefined
      });

      expect(receivedParams?.get('tier')).toBe('S');
      expect(receivedParams?.has('search')).toBe(false);
      expect(receivedParams?.has('file')).toBe(false);
    });
  });

  describe('getFunctionDetail', () => {
    it('should fetch function detail', async () => {
      const mockDetail = {
        function: mockTierListResponse.functions[0],
        callers: [
          { file: '/src/index.ts', line: 10, call_type: 'direct' },
        ],
        callees: [
          { name: 'setState', file: '/src/App.tsx', line: 15, call_type: 'method' },
        ],
        caller_count: 1,
        callee_count: 1,
      };

      server.use(
        http.get(`${API_URL}/analysis/:id/functions/:funcId`, () => {
          return HttpResponse.json(mockDetail);
        })
      );

      const result = await getFunctionDetail(mockAnalysisId, 'func1');

      expect(result.function.function_name).toBe('handleClick');
      expect(result.callers).toHaveLength(1);
      expect(result.callees).toHaveLength(1);
    });
  });

  describe('getFunctionStats', () => {
    it('should fetch function stats', async () => {
      server.use(
        http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
          return HttpResponse.json(mockFunctionStats);
        })
      );

      const stats = await getFunctionStats(mockAnalysisId);

      expect(stats.total_functions).toBe(50);
      expect(stats.total_calls).toBe(200);
      expect(stats.tier_counts.S).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should throw on network error', async () => {
      server.use(
        http.get(`${API_URL}/health`, () => {
          return HttpResponse.error();
        })
      );

      await expect(checkHealth()).rejects.toThrow();
    });

    it('should throw on server error', async () => {
      server.use(
        http.get(`${API_URL}/health`, () => {
          return new HttpResponse(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
          });
        })
      );

      await expect(checkHealth()).rejects.toThrow();
    });

    it('should throw on validation error (422)', async () => {
      server.use(
        http.post(`${API_URL}/analyze`, () => {
          return new HttpResponse(
            JSON.stringify({
              detail: [{ loc: ['body', 'directory_path'], msg: 'required' }],
            }),
            { status: 422 }
          );
        })
      );

      await expect(startAnalysis({})).rejects.toThrow();
    });
  });

  describe('auth interceptor', () => {
    it('should add Authorization header from Supabase session', async () => {
      let receivedAuth = '';

      server.use(
        http.get(`${API_URL}/health`, ({ request }) => {
          receivedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({ status: 'ok' });
        })
      );

      await checkHealth();

      expect(receivedAuth).toBe('Bearer test-access-token');
    });

    it('should work without session (public endpoints)', async () => {
      const supabaseModule = await import('../config/supabase');
      vi.mocked(supabaseModule.supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      let receivedAuth = '';

      server.use(
        http.get(`${API_URL}/health`, ({ request }) => {
          receivedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({ status: 'ok' });
        })
      );

      await checkHealth();

      // No auth header when no session
      expect(receivedAuth).toBe('');
    });
  });
});
