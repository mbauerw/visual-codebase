/**
 * Deterministic synthetic ReactFlowGraph generator for the /graph-dev harness
 * and perf tests. Not used in production.
 */

import type { ArchitecturalRole, Category, Language, ReactFlowEdge, ReactFlowGraph, ReactFlowNode } from '../../types';

const ROLES: ArchitecturalRole[] = [
  'react_component', 'utility', 'api_service', 'model', 'config', 'test', 'hook', 'context', 'store',
  'middleware', 'controller', 'router', 'schema', 'service', 'repository', 'entity', 'dto',
];
const LANGS: Language[] = ['typescript', 'javascript', 'python', 'java', 'csharp'];
const CATS: Category[] = ['frontend', 'backend', 'shared', 'test'];

/** Small seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticGraph(nodeCount: number, edgeCount: number, seed = 42): ReactFlowGraph {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  const nodes: ReactFlowNode[] = Array.from({ length: nodeCount }, (_, i) => {
    const role = pick(ROLES);
    const language = pick(LANGS);
    const category: Category = role === 'test' ? 'test' : pick(CATS);
    const folder = `src/${category}/${role}`;
    return {
      id: `n${i}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: `${role}_${i}.${language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'csharp' ? 'cs' : 'ts'}`,
        path: `${folder}/file_${i}.ts`,
        folder,
        language,
        role,
        description: `Synthetic file ${i}`,
        category,
        imports: [],
        size_bytes: 500 + Math.floor(rnd() * 5000),
        line_count: 10 + Math.floor(rnd() * 400),
      },
    };
  });

  const edges: ReactFlowEdge[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (edges.length < edgeCount && attempts < edgeCount * 10) {
    attempts++;
    const a = Math.floor(rnd() * nodeCount);
    const b = Math.floor(rnd() * nodeCount);
    if (a === b) continue;
    const key = `${a}-${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const source = nodes[a];
    const target = nodes[b];
    edges.push({
      id: `e${edges.length}`,
      source: source.id,
      target: target.id,
      type: 'import',
      animated: false,
      label: `sym${edges.length}`,
      style: {},
      data: {
        import_type: 'import',
        imported_names: [`sym${edges.length}`],
        module_path: `./${target.data.label}`,
        source_language: source.data.language,
        target_language: target.data.language,
        is_cross_language: source.data.language !== target.data.language,
      },
    });
  }

  return {
    nodes,
    edges,
    metadata: {
      analysis_id: `synthetic-${seed}`,
      file_count: nodeCount,
      edge_count: edges.length,
      analysis_time_seconds: 0,
      started_at: new Date(0).toISOString(),
      languages: {},
      errors: [],
    },
  };
}
