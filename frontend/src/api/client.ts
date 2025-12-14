import axios from 'axios';
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
