// Types for the Visual Codebase application

export type Language = 'javascript' | 'typescript' | 'python' | 'unknown';

export type ImportType = 'import' | 'require' | 'from_import' | 'dynamic_import';

export type ArchitecturalRole =
  | 'react_component'
  | 'utility'
  | 'api_service'
  | 'model'
  | 'config'
  | 'test'
  | 'hook'
  | 'context'
  | 'store'
  | 'middleware'
  | 'controller'
  | 'router'
  | 'schema'
  | 'unknown';

export type Category =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'folder'
  | 'infrastructure'
  | 'test'
  | 'config'
  | 'unknown';

export type LayoutType = 'role' | 'file-hierarchy' | 'dependency';

export type AnalysisStatus =
  | 'pending'
  | 'cloning'
  | 'parsing'
  | 'analyzing'
  | 'building_graph'
  | 'generating_summary'
  | 'completed'
  | 'failed';

// GitHub types
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  size_kb?: number; // Repository size in KB (from GitHub API)
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
  updated_at: string;
  pushed_at: string;
  size: number;
  owner: {
    login: string;
    avatar_url: string;
  };
  topics?: string[];
}

export interface GitHubRepoListResponse {
  repositories: GitHubRepository[];
  total_count: number;
  has_next_page: boolean;
  next_page: number | null;
}

export interface GitHubOwnerRepoListResponse extends GitHubRepoListResponse {
  owner: string;
  is_own_repos: boolean;
}

// Request types
export interface AnalyzeRequest {
  directory_path?: string;
  github_repo?: GitHubRepoInfo;
  include_node_modules?: boolean;
  max_depth?: number;
}

// Response types
export interface AnalyzeResponse {
  analysis_id: string;
  status: AnalysisStatus;
  message: string;
}

export interface AnalysisStatusResponse {
  analysis_id: string;
  status: AnalysisStatus;
  current_step: string;
  total_files: number;
  error?: string;
}

// Graph data types
// Adding index signature for React Flow v12 compatibility
export interface ReactFlowNodeData extends Record<string, unknown> {
  label: string;
  path: string;
  folder: string;
  language: Language;
  role: ArchitecturalRole;
  description: string;
  category: Category;
  imports: string[];
  size_bytes: number;
  line_count: number;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: ReactFlowNodeData;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
  label?: string;
  style?: Record<string, unknown>;
}

// Codebase summary types
export interface TechStackInfo {
  languages: string[];
  frameworks: string[];
  key_patterns: string[];
}

export interface ModuleInfo {
  name: string;
  purpose: string;
}

export interface ComplexityInfo {
  level: 'simple' | 'moderate' | 'complex';
  reasoning: string;
}

export interface CodebaseSummary {
  project_type: string;
  primary_purpose: string;
  tech_stack: TechStackInfo;
  architecture_summary: string;
  key_modules: ModuleInfo[];
  complexity_assessment: ComplexityInfo;
  notable_aspects: string[];
}

export interface AnalysisMetadata {
  analysis_id: string;
  directory_path?: string;
  github_repo?: GitHubRepoInfo;
  file_count: number;
  edge_count: number;
  analysis_time_seconds: number;
  started_at: string;
  completed_at?: string;
  languages: Record<string, number>;
  errors: string[];
  summary?: CodebaseSummary;
  readme_detected?: boolean;
}

export interface ReactFlowGraph {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  metadata: AnalysisMetadata;
}

// Helper functions for styling
export const languageColors: Record<Language, string> = {
  javascript: '#f7df1e',
  typescript: '#3178c6',
  python: '#3776ab',
  unknown: '#6b7280',
};

export const roleColors: Record<ArchitecturalRole, string> = {
  react_component: '#61dafb',
  utility: '#10b981',
  api_service: '#8b5cf6',
  model: '#f59e0b',
  config: '#6b7280',
  test: '#ef4444',
  hook: '#06b6d4',
  context: '#ec4899',
  store: '#14b8a6',
  middleware: '#a855f7',
  controller: '#f97316',
  router: '#84cc16',
  schema: '#eab308',
  unknown: '#6b7280',
};

export const categoryColors: Record<Category, string> = {
  frontend: '#61dafb',
  backend: '#10b981',
  shared: '#8b5cf6',
  folder: '#8b5cf6',
  infrastructure: '#f59e0b',
  test: '#ef4444',
  config: '#6b7280',
  unknown: '#6b7280',
};

export const roleLabels: Record<ArchitecturalRole, string> = {
  react_component: 'React Component',
  utility: 'Utility',
  api_service: 'API Service',
  model: 'Model',
  config: 'Config',
  test: 'Test',
  hook: 'Hook',
  context: 'Context',
  store: 'Store',
  middleware: 'Middleware',
  controller: 'Controller',
  router: 'Router',
  schema: 'Schema',
  unknown: 'Unknown',
};