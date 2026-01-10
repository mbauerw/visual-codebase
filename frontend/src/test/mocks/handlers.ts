import { http, HttpResponse } from 'msw';
import type {
  AnalyzeResponse,
  AnalysisStatusResponse,
  ReactFlowGraph,
  GitHubRepoListResponse,
} from '../../types';
import type { TierListResponse, FunctionStats } from '../../types/tierList';

const API_URL = 'http://localhost:8000/api';

// Sample data for tests
export const mockAnalysisId = 'test-analysis-123';

export const mockAnalyzeResponse: AnalyzeResponse = {
  analysis_id: mockAnalysisId,
  status: 'pending',
  message: 'Analysis started',
};

export const mockStatusPending: AnalysisStatusResponse = {
  analysis_id: mockAnalysisId,
  status: 'pending',
  current_step: 'Starting analysis...',
  total_files: 0,
  progress: 0,
};

export const mockStatusParsing: AnalysisStatusResponse = {
  analysis_id: mockAnalysisId,
  status: 'parsing',
  current_step: 'Parsing files...',
  total_files: 10,
  progress: 25,
};

export const mockStatusAnalyzing: AnalysisStatusResponse = {
  analysis_id: mockAnalysisId,
  status: 'analyzing',
  current_step: 'Analyzing code...',
  total_files: 10,
  progress: 50,
};

export const mockStatusCompleted: AnalysisStatusResponse = {
  analysis_id: mockAnalysisId,
  status: 'completed',
  current_step: 'Analysis complete',
  total_files: 10,
  progress: 100,
};

export const mockStatusFailed: AnalysisStatusResponse = {
  analysis_id: mockAnalysisId,
  status: 'failed',
  current_step: 'Analysis failed',
  total_files: 10,
  progress: 50,
  error: 'Test error message',
};

export const mockReactFlowGraph: ReactFlowGraph = {
  nodes: [
    {
      id: 'node1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'index.ts',
        path: '/src/index.ts',
        folder: '/src',
        language: 'typescript',
        role: 'react_component',
        description: 'Entry point',
        category: 'frontend',
        imports: ['./App'],
        size_bytes: 1000,
        line_count: 50,
      },
    },
    {
      id: 'node2',
      type: 'custom',
      position: { x: 100, y: 100 },
      data: {
        label: 'App.tsx',
        path: '/src/App.tsx',
        folder: '/src',
        language: 'typescript',
        role: 'react_component',
        description: 'Main App component',
        category: 'frontend',
        imports: [],
        size_bytes: 2000,
        line_count: 100,
      },
    },
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      type: 'default',
      animated: false,
    },
  ],
  metadata: {
    analysis_id: mockAnalysisId,
    directory_path: '/test/project',
    file_count: 2,
    edge_count: 1,
    analysis_time_seconds: 5.5,
    started_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:00:05Z',
    languages: { typescript: 2 },
    errors: [],
  },
};

export const mockGitHubRepos: GitHubRepoListResponse = {
  repositories: [
    {
      id: 1,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      description: 'A test repository',
      html_url: 'https://github.com/testuser/test-repo',
      clone_url: 'https://github.com/testuser/test-repo.git',
      ssh_url: 'git@github.com:testuser/test-repo.git',
      language: 'TypeScript',
      stargazers_count: 10,
      forks_count: 5,
      open_issues_count: 2,
      default_branch: 'main',
      private: false,
      updated_at: '2024-01-01T00:00:00Z',
      pushed_at: '2024-01-01T00:00:00Z',
      size: 1000,
      owner: {
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
      },
      topics: ['test', 'typescript'],
    },
    {
      id: 2,
      name: 'private-repo',
      full_name: 'testuser/private-repo',
      description: 'A private repository',
      html_url: 'https://github.com/testuser/private-repo',
      clone_url: 'https://github.com/testuser/private-repo.git',
      ssh_url: 'git@github.com:testuser/private-repo.git',
      language: 'JavaScript',
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      default_branch: 'main',
      private: true,
      updated_at: '2024-01-02T00:00:00Z',
      pushed_at: '2024-01-02T00:00:00Z',
      size: 500,
      owner: {
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
      },
    },
  ],
  total_count: 2,
  has_next_page: false,
  next_page: null,
};

export const mockTierListResponse: TierListResponse = {
  analysis_id: mockAnalysisId,
  total_functions: 5,
  tier_summary: {
    S: 1,
    A: 1,
    B: 1,
    C: 1,
    D: 1,
    F: 0,
  },
  functions: [
    {
      id: 'func1',
      function_name: 'handleClick',
      qualified_name: 'App.handleClick',
      function_type: 'function',
      file_path: '/src/App.tsx',
      file_name: 'App.tsx',
      node_id: 'node2',
      internal_call_count: 10,
      external_call_count: 5,
      is_exported: true,
      is_entry_point: true,
      tier: 'S',
      tier_percentile: 98,
      start_line: 10,
      end_line: 20,
      is_async: false,
      parameters_count: 1,
    },
    {
      id: 'func2',
      function_name: 'useCustomHook',
      qualified_name: 'useCustomHook',
      function_type: 'hook',
      file_path: '/src/hooks/useCustomHook.ts',
      file_name: 'useCustomHook.ts',
      node_id: 'node3',
      internal_call_count: 8,
      external_call_count: 2,
      is_exported: true,
      is_entry_point: false,
      tier: 'A',
      tier_percentile: 85,
      start_line: 5,
      end_line: 30,
      is_async: false,
      parameters_count: 2,
    },
  ],
  page: 1,
  per_page: 100,
  total_pages: 1,
  has_next: false,
};

export const mockFunctionStats: FunctionStats = {
  total_functions: 50,
  total_calls: 200,
  tier_counts: {
    S: 5,
    A: 10,
    B: 15,
    C: 10,
    D: 8,
    F: 2,
  },
  top_functions: ['handleClick', 'useCustomHook', 'fetchData'],
};

export const mockUserAnalyses = {
  analyses: [
    {
      id: mockAnalysisId,
      status: 'completed',
      file_count: 10,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
};

// Default handlers
export const handlers = [
  // Health check
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Start analysis
  http.post(`${API_URL}/analyze`, () => {
    return HttpResponse.json(mockAnalyzeResponse);
  }),

  // Get analysis status
  http.get(`${API_URL}/analysis/:id/status`, () => {
    return HttpResponse.json(mockStatusCompleted);
  }),

  // Get analysis result
  http.get(`${API_URL}/analysis/:id`, ({ params }) => {
    if (params.id === mockAnalysisId) {
      return HttpResponse.json(mockReactFlowGraph);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  // Get user analyses
  http.get(`${API_URL}/user/analyses`, () => {
    return HttpResponse.json(mockUserAnalyses);
  }),

  // Delete analysis
  http.delete(`${API_URL}/analysis/:id`, () => {
    return HttpResponse.json({ message: 'Analysis deleted' });
  }),

  // Update analysis title
  http.patch(`${API_URL}/analysis/:id`, () => {
    return HttpResponse.json({ message: 'Title updated' });
  }),

  // Get file content
  http.get(`${API_URL}/analysis/:id/file/:nodeId/content`, () => {
    return HttpResponse.json({
      content: 'export const test = "hello";',
      source: 'database',
      available: true,
    });
  }),

  // GitHub repos (needs both base URL and /api prefix for different hook implementations)
  http.get(`${API_URL}/github/repos`, () => {
    return HttpResponse.json(mockGitHubRepos);
  }),
  http.get('http://localhost:8000/api/github/repos', () => {
    return HttpResponse.json(mockGitHubRepos);
  }),

  // Tier list endpoints
  http.get(`${API_URL}/analysis/:id/functions/tier-list`, () => {
    return HttpResponse.json(mockTierListResponse);
  }),

  http.get(`${API_URL}/analysis/:id/functions/stats`, () => {
    return HttpResponse.json(mockFunctionStats);
  }),

  http.get(`${API_URL}/analysis/:id/functions/:funcId`, () => {
    return HttpResponse.json({
      function: mockTierListResponse.functions[0],
      callers: [],
      callees: [],
      caller_count: 0,
      callee_count: 0,
    });
  }),
];
