import axios from 'axios';
import { supabase } from '../config/supabase';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisStatusResponse,
  ReactFlowGraph,
} from '../types';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
client.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
});

export async function startAnalysis(
  request: AnalyzeRequest
): Promise<AnalyzeResponse> {
  // Get GitHub token from localStorage if analyzing a GitHub repo
  const headers: Record<string, string> = {};

  if (request.github_repo) {
    const githubToken = localStorage.getItem('github_provider_token');
    if (githubToken) {
      headers['X-GitHub-Token'] = githubToken;
    }
  }

  const response = await client.post<AnalyzeResponse>('/analyze', request, {
    headers,
  });
  return response.data;
}

export async function getAnalysisStatus(
  analysisId: string
): Promise<AnalysisStatusResponse> {
  const response = await client.get<AnalysisStatusResponse>(
    `/analysis/${analysisId}/status`
  );
  return response.data;
}

export async function getAnalysisResult(
  analysisId: string
): Promise<ReactFlowGraph> {
  const response = await client.get<ReactFlowGraph>(`/analysis/${analysisId}`);
  return response.data;
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await client.get<{ status: string }>('/health');
  return response.data;
}

export async function getUserAnalyses(): Promise<{ analyses: any[] }> {
  const response = await client.get<{ analyses: any[] }>('/user/analyses');
  return response.data;
}

export async function deleteAnalysis(analysisId: string): Promise<{ message: string }> {
  const response = await client.delete<{ message: string }>(`/analysis/${analysisId}`);
  return response.data;
}

export async function updateAnalysisTitle(
  analysisId: string,
  userTitle: string | null
): Promise<{ message: string }> {
  const response = await client.patch<{ message: string }>(`/analysis/${analysisId}`, {
    user_title: userTitle,
  });
  return response.data;
}

export interface FileContentResponse {
  content: string | null;
  source: 'database' | 'filesystem';
  available: boolean;
  error?: string;
}

export async function getFileContent(
  analysisId: string,
  nodeId: string
): Promise<FileContentResponse> {
  const response = await client.get<FileContentResponse>(
    `/analysis/${analysisId}/file/${encodeURIComponent(nodeId)}/content`
  );
  return response.data;
}
