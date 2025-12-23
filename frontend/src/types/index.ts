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
  | 'parsing'
  | 'analyzing'
  | 'building_graph'
  | 'completed'
  | 'failed';

// Request types
export interface AnalyzeRequest {
  directory_path: string;
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
  progress: number;
  current_step: string;
  files_processed: number;
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

export interface AnalysisMetadata {
  analysis_id: string;
  directory_path: string;
  file_count: number;
  edge_count: number;
  analysis_time_seconds: number;
  started_at: string;
  completed_at?: string;
  languages: Record<string, number>;
  errors: string[];
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