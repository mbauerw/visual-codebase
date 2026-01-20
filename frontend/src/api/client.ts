import axios from 'axios';
import { supabase } from '../config/supabase';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisStatusResponse,
  ReactFlowGraph,
} from '../types';
import type {
  TierListResponse,
  FunctionDetailResponse,
  FunctionStats,
  TierListQueryParams,
} from '../types/tierList';
import type {
  ChatRequest,
  ChatResponse,
  ChatHistoryResponse,
} from '../types/chat';

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

// ==================== Function Tier List API ====================

export async function getTierList(
  analysisId: string,
  params?: TierListQueryParams
): Promise<TierListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.tier) queryParams.append('tier', params.tier);
  if (params?.file) queryParams.append('file', params.file);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.per_page) queryParams.append('per_page', params.per_page.toString());

  const queryString = queryParams.toString();
  const url = `/analysis/${analysisId}/functions/tier-list${queryString ? `?${queryString}` : ''}`;

  const response = await client.get<TierListResponse>(url);
  return response.data;
}

export async function getFunctionDetail(
  analysisId: string,
  functionId: string
): Promise<FunctionDetailResponse> {
  const response = await client.get<FunctionDetailResponse>(
    `/analysis/${analysisId}/functions/${functionId}`
  );
  return response.data;
}

export async function getFunctionStats(
  analysisId: string
): Promise<FunctionStats> {
  const response = await client.get<FunctionStats>(
    `/analysis/${analysisId}/functions/stats`
  );
  return response.data;
}

// ==================== Profile Management API ====================

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  default_view: 'graph' | 'list';
  graph_layout: 'hierarchical' | 'force';
  notifications: {
    email_analysis_complete: boolean;
    email_weekly_digest: boolean;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  preferences: UserPreferences;
  auth_provider: 'email' | 'github' | 'google';
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateRequest {
  display_name?: string | null;
  avatar_url?: string | null;
  preferences?: Partial<UserPreferences>;
}

export async function getUserProfile(): Promise<UserProfile> {
  const response = await client.get<UserProfile>('/user/profile');
  return response.data;
}

export async function updateUserProfile(
  updates: ProfileUpdateRequest
): Promise<UserProfile> {
  const response = await client.patch<UserProfile>('/user/profile', updates);
  return response.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const response = await client.post<{ success: boolean; message: string }>(
    '/user/profile/password',
    {
      current_password: currentPassword,
      new_password: newPassword,
    }
  );
  return response.data;
}

// ==================== Password Validation API ====================

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  history_count: number;
}

export interface PasswordValidationCriteria {
  criterion: string;
  passed: boolean;
  message: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  score: number;
  criteria: PasswordValidationCriteria[];
  suggestions: string[];
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const response = await client.get<PasswordPolicy>('/auth/password-policy');
  return response.data;
}

export async function validatePassword(
  password: string
): Promise<PasswordValidationResult> {
  const response = await client.post<PasswordValidationResult>(
    '/auth/validate-password',
    { password }
  );
  return response.data;
}

// ==================== Account Deletion API ====================

export interface AccountDeletionResponse {
  deletion_id: string;
  scheduled_deletion_at: string;
  status: 'pending' | 'cancelled' | 'completed';
  export_requested: boolean;
  export_id: string | null;
  message: string;
}

export interface AccountDeletionStatus {
  deletion_id: string;
  scheduled_deletion_at: string;
  status: 'pending' | 'cancelled' | 'completed';
  days_remaining: number;
  can_cancel: boolean;
}

export async function requestAccountDeletion(
  reason?: string,
  exportData?: boolean
): Promise<AccountDeletionResponse> {
  const response = await client.post<AccountDeletionResponse>(
    '/user/account/delete',
    {
      reason,
      export_data: exportData,
    }
  );
  return response.data;
}

export async function getAccountDeletionStatus(): Promise<AccountDeletionStatus | null> {
  try {
    const response = await client.get<AccountDeletionStatus>(
      '/user/account/deletion-status'
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function cancelAccountDeletion(): Promise<{
  message: string;
  account_restored: boolean;
}> {
  const response = await client.post<{
    message: string;
    account_restored: boolean;
  }>('/user/account/cancel-deletion');
  return response.data;
}

// ==================== Data Export API ====================

export interface DataExportResponse {
  export_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  estimated_time_seconds?: number;
}

export interface DataExportStatus {
  export_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  download_url?: string;
  expires_at?: string;
  file_size_bytes?: number;
}

export async function requestDataExport(
  exportType: 'full' | 'analyses_only' | 'profile_only' = 'full'
): Promise<DataExportResponse> {
  const response = await client.post<DataExportResponse>('/user/data/export', {
    export_type: exportType,
  });
  return response.data;
}

export async function getDataExportStatus(
  exportId: string
): Promise<DataExportStatus> {
  const response = await client.get<DataExportStatus>(
    `/user/data/export/${exportId}`
  );
  return response.data;
}

// ==================== Chat API ====================

export async function sendChatMessage(
  analysisId: string,
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await client.post<ChatResponse>(
    `/chat/${analysisId}`,
    request
  );
  return response.data;
}

export async function getChatHistory(
  analysisId: string,
  conversationId: string
): Promise<ChatHistoryResponse> {
  const response = await client.get<ChatHistoryResponse>(
    `/chat/${analysisId}/history/${conversationId}`
  );
  return response.data;
}

export async function deleteChatHistory(
  analysisId: string,
  conversationId: string
): Promise<{ message: string }> {
  const response = await client.delete<{ message: string }>(
    `/chat/${analysisId}/history/${conversationId}`
  );
  return response.data;
}
