// Types for the Codebase Remap application

export type Language = 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'go' | 'rust' | 'swift' | 'unknown';

export type ImportType = 'import' | 'require' | 'from_import' | 'dynamic_import' | 'static_import' | 'wildcard_import' | 'using' | 'static_using' | 'alias_using' | 'global_using' | 'go_import' | 'go_dot_import' | 'go_blank_import' | 'go_alias_import' | 'use' | 'use_wildcard' | 'use_self' | 'extern_crate' | 'mod' | 'swift_import' | 'swift_import_kind' | 'swift_testable_import';

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
  // Java/C# specific roles
  | 'entity'
  | 'repository'
  | 'service'
  | 'dto'
  | 'exception'
  | 'enum_type'
  | 'interface'
  | 'annotation'
  // C# specific roles
  | 'extension'
  | 'record'
  | 'delegate'
  // Go specific roles
  | 'go_handler'
  | 'go_middleware'
  | 'go_repository'
  | 'go_service'
  | 'go_model'
  | 'go_cmd'
  | 'go_pkg'
  | 'go_internal'
  | 'go_transport'
  | 'go_config'
  | 'go_util'
  // Rust specific roles
  | 'rust_lib'
  | 'rust_bin'
  | 'rust_mod'
  | 'rust_trait'
  | 'rust_impl'
  | 'rust_handler'
  | 'rust_error'
  | 'rust_macro'
  | 'rust_types'
  | 'rust_tests'
  // Swift/iOS specific roles
  | 'swift_view_controller'
  | 'swift_ui_view'
  | 'swift_app_delegate'
  | 'swift_protocol'
  | 'swift_extension'
  | 'swift_coordinator'
  | 'swift_view_model'
  | 'swift_data_source'
  | 'swift_network_service'
  | 'swift_core_data'
  | 'swift_observable'
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

export type LayoutType = 'role' | 'file-hierarchy' | 'dependency' | 'nested';

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
  progress: number;
  error?: string;
}

// Scale tier for dependency-based node sizing
export type ScaleTier = 1 | 1.25 | 1.5 | 2 | 2.5 | 3;

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
  scaleTier?: ScaleTier; // Scale based on dependency count percentile within role
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: ReactFlowNodeData;
}

export interface ReactFlowEdgeData {
  imported_names: string[];
  module_path: string | null;
  import_type: ImportType;
  source_language?: Language;
  target_language?: Language;
  is_cross_language?: boolean;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
  label?: string;
  style?: Record<string, unknown>;
  data?: ReactFlowEdgeData;
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
  user_title?: string;
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
  java: '#b07219',
  csharp: '#178600',
  go: '#00add8',
  rust: '#dea584',
  swift: '#f05138',
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
  // Java/C# specific roles
  entity: '#3b82f6',
  repository: '#8b5cf6',
  service: '#10b981',
  dto: '#f59e0b',
  exception: '#ef4444',
  enum_type: '#6366f1',
  interface: '#14b8a6',
  annotation: '#ec4899',
  // C# specific roles
  extension: '#84cc16',
  record: '#0ea5e9',
  delegate: '#f97316',
  // Go specific roles
  go_handler: '#00add8',
  go_middleware: '#00a29c',
  go_repository: '#8b5cf6',
  go_service: '#10b981',
  go_model: '#f59e0b',
  go_cmd: '#ef4444',
  go_pkg: '#3b82f6',
  go_internal: '#6366f1',
  go_transport: '#f97316',
  go_config: '#6b7280',
  go_util: '#84cc16',
  // Rust specific roles
  rust_lib: '#dea584',
  rust_bin: '#b7410e',
  rust_mod: '#c87533',
  rust_trait: '#8b5cf6',
  rust_impl: '#10b981',
  rust_handler: '#3b82f6',
  rust_error: '#ef4444',
  rust_macro: '#ec4899',
  rust_types: '#f59e0b',
  rust_tests: '#6366f1',
  // Swift/iOS specific roles
  swift_view_controller: '#f05138',
  swift_ui_view: '#0c73e0',
  swift_app_delegate: '#b7410e',
  swift_protocol: '#8b5cf6',
  swift_extension: '#84cc16',
  swift_coordinator: '#f97316',
  swift_view_model: '#10b981',
  swift_data_source: '#6366f1',
  swift_network_service: '#3b82f6',
  swift_core_data: '#f59e0b',
  swift_observable: '#ec4899',
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
  // Java/C# specific roles
  entity: 'Entity',
  repository: 'Repository',
  service: 'Service',
  dto: 'DTO',
  exception: 'Exception',
  enum_type: 'Enum',
  interface: 'Interface',
  annotation: 'Annotation',
  // C# specific roles
  extension: 'Extension',
  record: 'Record',
  delegate: 'Delegate',
  // Go specific roles
  go_handler: 'Go Handler',
  go_middleware: 'Go Middleware',
  go_repository: 'Go Repository',
  go_service: 'Go Service',
  go_model: 'Go Model',
  go_cmd: 'Go Cmd',
  go_pkg: 'Go Pkg',
  go_internal: 'Go Internal',
  go_transport: 'Go Transport',
  go_config: 'Go Config',
  go_util: 'Go Util',
  // Rust specific roles
  rust_lib: 'Rust Library',
  rust_bin: 'Rust Binary',
  rust_mod: 'Rust Module',
  rust_trait: 'Rust Trait',
  rust_impl: 'Rust Impl',
  rust_handler: 'Rust Handler',
  rust_error: 'Rust Error',
  rust_macro: 'Rust Macro',
  rust_types: 'Rust Types',
  rust_tests: 'Rust Tests',
  // Swift/iOS specific roles
  swift_view_controller: 'View Controller',
  swift_ui_view: 'SwiftUI View',
  swift_app_delegate: 'App Delegate',
  swift_protocol: 'Protocol',
  swift_extension: 'Extension',
  swift_coordinator: 'Coordinator',
  swift_view_model: 'View Model',
  swift_data_source: 'Data Source',
  swift_network_service: 'Network Service',
  swift_core_data: 'Core Data',
  swift_observable: 'Observable',
  unknown: 'Unknown',
};