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
  const response = await client.post<AnalyzeResponse>('/analyze', request);
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
