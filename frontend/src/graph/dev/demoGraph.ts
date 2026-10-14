/**
 * Curated demo graph for the /graph-dev harness: ~80 realistically named files
 * across a TypeScript frontend, a Python backend and a test suite, with
 * rule-based imports so every role has a believable mix of hubs and leaves.
 * Deterministic (seeded) — the same graph every time, so screenshots of theme
 * packs are comparable.
 */

import type {
  ArchitecturalRole,
  Category,
  Language,
  ReactFlowEdge,
  ReactFlowGraph,
  ReactFlowNode,
} from '../../types';
import { mulberry32 } from './syntheticGraph';

interface Spec {
  role: ArchitecturalRole;
  category: Category;
  language: Language;
  folder: string;
  files: string[];
}

const SPECS: Spec[] = [
  // ---- frontend (TypeScript) ------------------------------------------------
  { role: 'react_component', category: 'frontend', language: 'typescript', folder: 'src/components', files: [
    'App.tsx', 'Dashboard.tsx', 'Sidebar.tsx', 'NavBar.tsx', 'UserCard.tsx', 'Modal.tsx', 'Button.tsx',
    'DataTable.tsx', 'ChartPanel.tsx', 'SettingsForm.tsx', 'LoginForm.tsx', 'Avatar.tsx', 'Toast.tsx', 'Tooltip.tsx',
  ] },
  { role: 'hook', category: 'frontend', language: 'typescript', folder: 'src/hooks', files: [
    'useAuth.ts', 'useFetch.ts', 'useDebounce.ts', 'useTheme.ts', 'useLocalStorage.ts', 'usePagination.ts',
  ] },
  { role: 'context', category: 'frontend', language: 'typescript', folder: 'src/context', files: ['AuthContext.tsx', 'ThemeContext.tsx'] },
  { role: 'store', category: 'frontend', language: 'typescript', folder: 'src/store', files: ['userStore.ts', 'uiStore.ts', 'cartStore.ts'] },
  { role: 'utility', category: 'frontend', language: 'typescript', folder: 'src/utils', files: [
    'formatDate.ts', 'classNames.ts', 'debounce.ts', 'validators.ts', 'currency.ts',
  ] },
  { role: 'api_service', category: 'frontend', language: 'typescript', folder: 'src/api', files: [
    'apiClient.ts', 'userApi.ts', 'orderApi.ts', 'analyticsApi.ts',
  ] },
  { role: 'router', category: 'frontend', language: 'typescript', folder: 'src', files: ['routes.tsx'] },
  { role: 'config', category: 'config', language: 'typescript', folder: '.', files: ['vite.config.ts', 'env.ts'] },
  { role: 'config', category: 'config', language: 'javascript', folder: '.', files: ['tailwind.config.js'] },
  { role: 'model', category: 'shared', language: 'typescript', folder: 'src/types', files: ['user.ts', 'order.ts', 'api.ts'] },
  // ---- backend (Python) -----------------------------------------------------
  { role: 'controller', category: 'backend', language: 'python', folder: 'app/controllers', files: [
    'users_controller.py', 'orders_controller.py', 'auth_controller.py', 'health_controller.py',
  ] },
  { role: 'service', category: 'backend', language: 'python', folder: 'app/services', files: [
    'user_service.py', 'order_service.py', 'auth_service.py', 'email_service.py', 'billing_service.py',
  ] },
  { role: 'repository', category: 'backend', language: 'python', folder: 'app/repositories', files: [
    'user_repo.py', 'order_repo.py', 'session_repo.py',
  ] },
  { role: 'entity', category: 'backend', language: 'python', folder: 'app/models', files: ['user.py', 'order.py', 'session.py', 'invoice.py'] },
  { role: 'schema', category: 'backend', language: 'python', folder: 'app/schemas', files: ['user_schema.py', 'order_schema.py'] },
  { role: 'middleware', category: 'backend', language: 'python', folder: 'app/middleware', files: [
    'auth_middleware.py', 'logging_middleware.py', 'cors.py',
  ] },
  { role: 'utility', category: 'backend', language: 'python', folder: 'app/utils', files: ['hashing.py', 'jwt_utils.py', 'pagination.py'] },
  { role: 'config', category: 'backend', language: 'python', folder: 'app', files: ['settings.py', 'database.py'] },
  { role: 'router', category: 'backend', language: 'python', folder: 'app', files: ['api_router.py'] },
  // ---- tests ------------------------------------------------------------------
  { role: 'test', category: 'test', language: 'typescript', folder: 'src/__tests__', files: [
    'App.test.tsx', 'Dashboard.test.tsx', 'useAuth.test.ts', 'userApi.test.ts',
  ] },
  { role: 'test', category: 'test', language: 'python', folder: 'tests', files: [
    'test_user_service.py', 'test_orders.py', 'test_auth.py', 'conftest.py',
  ] },
];

/** consumer role → [provider role, min, max] within the same section (tests may import anything). */
const RULES: Partial<Record<ArchitecturalRole, Array<[ArchitecturalRole, number, number]>>> = {
  react_component: [['hook', 1, 2], ['utility', 0, 2], ['store', 0, 1], ['context', 0, 1], ['api_service', 0, 1], ['model', 0, 1], ['react_component', 0, 2]],
  hook: [['api_service', 0, 1], ['utility', 0, 1], ['store', 0, 1], ['context', 0, 1], ['model', 0, 1]],
  context: [['store', 1, 1], ['hook', 0, 1], ['model', 1, 1]],
  store: [['api_service', 1, 1], ['model', 1, 1], ['utility', 0, 1]],
  api_service: [['model', 1, 2], ['config', 0, 1]],
  router: [['react_component', 4, 6], ['controller', 4, 4]],
  utility: [['model', 0, 1]],
  controller: [['service', 1, 2], ['schema', 1, 1], ['middleware', 0, 1], ['utility', 0, 1]],
  service: [['repository', 1, 2], ['entity', 1, 1], ['utility', 0, 1], ['config', 0, 1], ['service', 0, 1]],
  repository: [['entity', 1, 1], ['config', 1, 1]],
  schema: [['entity', 1, 1]],
  middleware: [['utility', 0, 1], ['config', 1, 1], ['service', 0, 1]],
  test: [['react_component', 0, 2], ['hook', 0, 1], ['api_service', 0, 1], ['service', 0, 2], ['controller', 0, 1], ['repository', 0, 1]],
};

const SECTION_OF: Record<Category, 'frontend' | 'backend' | 'test'> = {
  frontend: 'frontend',
  shared: 'frontend',
  config: 'frontend',
  folder: 'frontend',
  unknown: 'frontend',
  backend: 'backend',
  infrastructure: 'backend',
  test: 'test',
};

function stem(fileName: string): string {
  return fileName.replace(/\.(test|spec)?\.?[a-z]+$/i, '').replace(/\.[a-z]+$/i, '');
}

function exportName(node: ReactFlowNode): string {
  const s = stem(node.data.label);
  if (node.data.language === 'python') {
    return s.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }
  return s;
}

export function generateDemoGraph(seed = 7): ReactFlowGraph {
  const rnd = mulberry32(seed);
  const nodes: ReactFlowNode[] = [];

  SPECS.forEach((spec) => {
    spec.files.forEach((file) => {
      const i = nodes.length;
      const lines = 24 + Math.floor(rnd() * 380);
      nodes.push({
        id: `demo-${i}`,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: file,
          path: spec.folder === '.' ? file : `${spec.folder}/${file}`,
          folder: spec.folder,
          language: spec.language,
          role: spec.role,
          description: `${spec.role.replace(/_/g, ' ')} — ${stem(file)}`,
          category: spec.category,
          imports: [],
          size_bytes: lines * 38,
          line_count: lines,
        },
      });
    });
  });

  // index: section → role → nodes
  const byRole = new Map<string, ReactFlowNode[]>();
  nodes.forEach((n) => {
    const key = `${SECTION_OF[n.data.category]}:${n.data.role}`;
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key)!.push(n);
  });
  const providers = (section: string, role: ArchitecturalRole): ReactFlowNode[] => {
    if (section === 'test') {
      return [...(byRole.get(`frontend:${role}`) ?? []), ...(byRole.get(`backend:${role}`) ?? [])];
    }
    return byRole.get(`${section}:${role}`) ?? [];
  };

  const edges: ReactFlowEdge[] = [];
  const seen = new Set<string>();
  const link = (provider: ReactFlowNode, consumer: ReactFlowNode) => {
    if (provider.id === consumer.id) return;
    const key = `${provider.id}>${consumer.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      id: `demo-e${edges.length}`,
      source: provider.id,
      target: consumer.id,
      type: 'import',
      animated: false,
      label: exportName(provider),
      style: {},
      data: {
        import_type: provider.data.language === 'python' ? 'from_import' : 'import',
        imported_names: [exportName(provider)],
        module_path: `./${stem(provider.data.label)}`,
        source_language: provider.data.language,
        target_language: consumer.data.language,
        is_cross_language: provider.data.language !== consumer.data.language,
      },
    });
  };

  nodes.forEach((consumer) => {
    const section = SECTION_OF[consumer.data.category];
    const rules = RULES[consumer.data.role] ?? [];
    rules.forEach(([role, min, max]) => {
      const pool = providers(section, role).filter((p) => p.id !== consumer.id);
      if (pool.length === 0) return;
      const n = Math.min(pool.length, min + Math.floor(rnd() * (max - min + 1)));
      const shuffled = [...pool].sort(() => rnd() - 0.5);
      for (let k = 0; k < n; k++) link(shuffled[k], consumer);
    });
  });

  // A few deliberate hubs so scale tiers show up.
  const byLabel = (label: string) => nodes.find((n) => n.data.label === label)!;
  ['userApi.ts', 'orderApi.ts', 'analyticsApi.ts'].forEach((l) => link(byLabel('apiClient.ts'), byLabel(l)));
  ['Dashboard.tsx', 'Sidebar.tsx', 'NavBar.tsx', 'Modal.tsx', 'Toast.tsx'].forEach((l) => link(byLabel(l), byLabel('App.tsx')));
  ['UserCard.tsx', 'DataTable.tsx', 'SettingsForm.tsx', 'LoginForm.tsx', 'Avatar.tsx'].forEach((l) => link(byLabel('Button.tsx'), byLabel(l)));
  ['user_service.py', 'order_service.py', 'auth_service.py', 'billing_service.py'].forEach((l) => link(byLabel('database.py'), byLabel(l)));
  ['users_controller.py', 'orders_controller.py', 'auth_controller.py'].forEach((l) => link(byLabel('auth_middleware.py'), byLabel(l)));

  return {
    nodes,
    edges,
    metadata: {
      analysis_id: `demo-${seed}`,
      file_count: nodes.length,
      edge_count: edges.length,
      analysis_time_seconds: 0,
      started_at: new Date(0).toISOString(),
      languages: { typescript: 0, python: 0 },
      errors: [],
    },
  };
}

export const demoGraph: ReactFlowGraph = generateDemoGraph();
