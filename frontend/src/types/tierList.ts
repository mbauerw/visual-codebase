// Types for the Function Tier List feature

export type TierLevel = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export type FunctionType =
  | 'function'
  | 'method'
  | 'arrow_function'
  | 'constructor'
  | 'hook'
  | 'callback';

export interface FunctionTierItem {
  id: string;
  function_name: string;
  qualified_name: string;
  function_type: FunctionType;
  file_path: string;
  file_name: string;
  node_id: string;
  internal_call_count: number;
  external_call_count: number;
  is_exported: boolean;
  is_entry_point: boolean;
  tier: TierLevel;
  tier_percentile: number;
  start_line: number;
  end_line: number | null;
  is_async: boolean;
  parameters_count: number;
}

export interface TierListResponse {
  analysis_id: string;
  total_functions: number;
  tier_summary: Record<TierLevel, number>;
  functions: FunctionTierItem[];
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
}

export interface FunctionStats {
  total_functions: number;
  total_calls: number;
  tier_counts: Record<TierLevel, number>;
  top_functions: string[];
}

export interface FunctionDetailResponse {
  function: FunctionTierItem;
  callers: FunctionCaller[];
  callees: FunctionCallee[];
  caller_count: number;
  callee_count: number;
}

export interface FunctionCaller {
  file: string;
  line: number;
  call_type: string;
}

export interface FunctionCallee {
  name: string;
  file: string;
  line: number;
  call_type: string;
}

export interface TierGroup {
  tier: TierLevel;
  label: string;
  functions: FunctionTierItem[];
  color: string;
}

// Tier colors matching the design spec
export const tierColors: Record<TierLevel, string> = {
  S: '#fbbf24', // amber-400 (gold)
  A: '#f472b6', // pink-400
  B: '#a78bfa', // violet-400
  C: '#38bdf8', // sky-400
  D: '#64748b', // slate-500
  F: '#ef4444', // red-500
};

// Tier background colors (lighter versions)
export const tierBgColors: Record<TierLevel, string> = {
  S: 'rgba(251, 191, 36, 0.1)',
  A: 'rgba(244, 114, 182, 0.1)',
  B: 'rgba(167, 139, 250, 0.1)',
  C: 'rgba(56, 189, 248, 0.1)',
  D: 'rgba(100, 116, 139, 0.1)',
  F: 'rgba(239, 68, 68, 0.1)',
};

// Human-readable tier labels
export const tierLabels: Record<TierLevel, string> = {
  S: 'Critical Functions',
  A: 'Core Functions',
  B: 'Supporting Functions',
  C: 'Specialized Functions',
  D: 'Minor Functions',
  F: 'Unused/Dead Code',
};

// Tier descriptions for tooltips
export const tierDescriptions: Record<TierLevel, string> = {
  S: 'Top 5% - Most called functions, critical to the codebase',
  A: 'Top 6-20% - Core utility functions with high usage',
  B: 'Top 21-50% - Supporting functions with moderate usage',
  C: 'Top 51-80% - Specialized functions with limited usage',
  D: 'Top 81-95% - Minor functions with rare usage',
  F: 'Bottom 5% - Potentially unused or dead code',
};

// Function type labels
export const functionTypeLabels: Record<FunctionType, string> = {
  function: 'Function',
  method: 'Method',
  arrow_function: 'Arrow Function',
  constructor: 'Constructor',
  hook: 'Hook',
  callback: 'Callback',
};

// Function type colors
export const functionTypeColors: Record<FunctionType, string> = {
  function: '#10b981', // emerald
  method: '#8b5cf6',   // violet
  arrow_function: '#06b6d4', // cyan
  constructor: '#f59e0b', // amber
  hook: '#ec4899',     // pink
  callback: '#6366f1', // indigo
};

// Query parameters for tier list API
export interface TierListQueryParams {
  tier?: TierLevel;
  file?: string;
  type?: FunctionType;
  search?: string;
  sort_by?: 'call_count' | 'name' | 'file' | 'tier';
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
