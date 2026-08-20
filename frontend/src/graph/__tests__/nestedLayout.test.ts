import { describe, it, expect } from 'vitest';

import {
  computeNestedLayout,
  toNestedScene,
  buildTree,
  countFiles,
  getDominantCategory,
  DEFAULT_NESTED_LAYOUT_CONFIG,
  type NestedFileBox,
  type NestedFolderBox,
  type NestedLayoutResult,
} from '../layouts/nestedLayout';
import type { Category, ReactFlowNode } from '../../types';
import { mockReactFlowGraph } from '../../test/mocks/handlers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, path: string, category: Category = 'frontend'): ReactFlowNode {
  const parts = path.split('/').filter(Boolean);
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: parts[parts.length - 1],
      path,
      folder: parts.slice(0, -1).join('/'),
      language: 'typescript',
      role: 'react_component',
      description: '',
      category,
      imports: [],
      size_bytes: 10,
      line_count: 1,
    },
  };
}

const treeNodes: ReactFlowNode[] = [
  makeNode('a', 'src/App.tsx'),
  makeNode('b', 'src/components/Button.tsx'),
  makeNode('c', 'src/components/Card.tsx'),
  makeNode('d', 'src/components/ui/Icon.tsx'),
  makeNode('e', 'src/hooks/useAuth.ts'),
  makeNode('f', 'backend/app/main.py', 'backend'),
  makeNode('g', 'backend/app/models.py', 'backend'),
  makeNode('h', 'backend/tests/test_main.py', 'test'),
  makeNode('i', 'README.md', 'shared'),
];

function contains(outer: { x: number; y: number; width: number; height: number }, inner: { x: number; y: number; width: number; height: number }) {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-6
  );
}

function folderById(layout: NestedLayoutResult): Map<string, NestedFolderBox> {
  return new Map(layout.folders.map((f) => [f.id, f]));
}

// ---------------------------------------------------------------------------
// computeNestedLayout
// ---------------------------------------------------------------------------

describe('computeNestedLayout', () => {
  it('returns empty lists for no nodes', () => {
    expect(computeNestedLayout([])).toEqual({ folders: [], files: [] });
  });

  it('creates one folder per distinct directory with `folder-<path>` ids', () => {
    const layout = computeNestedLayout(treeNodes);
    const ids = layout.folders.map((f) => f.id).sort();
    expect(ids).toEqual(
      [
        'folder-src',
        'folder-src/components',
        'folder-src/components/ui',
        'folder-src/hooks',
        'folder-backend',
        'folder-backend/app',
        'folder-backend/tests',
      ].sort()
    );
    const src = folderById(layout).get('folder-src')!;
    expect(src.label).toBe('src');
    expect(src.path).toBe('src');
  });

  it('emits one file box per input node with the API id, original node and containing folder', () => {
    const layout = computeNestedLayout(treeNodes);
    expect(layout.files).toHaveLength(treeNodes.length);
    const byId = new Map(layout.files.map((f) => [f.id, f]));
    treeNodes.forEach((n) => {
      const box = byId.get(n.id)!;
      expect(box).toBeDefined();
      expect(box.node).toBe(n);
      expect(box.width).toBe(DEFAULT_NESTED_LAYOUT_CONFIG.fileNodeWidth);
      expect(box.height).toBe(DEFAULT_NESTED_LAYOUT_CONFIG.fileNodeHeight);
    });
    expect(byId.get('b')!.parentId).toBe('folder-src/components');
    expect(byId.get('d')!.parentId).toBe('folder-src/components/ui');
    expect(byId.get('a')!.parentId).toBe('folder-src');
    // root-level file has no parent
    expect(byId.get('i')!.parentId).toBeUndefined();
  });

  it('places every file box inside its folder box (absolute coordinates)', () => {
    const layout = computeNestedLayout(treeNodes);
    const folders = folderById(layout);
    layout.files.forEach((file: NestedFileBox) => {
      if (!file.parentId) return;
      const folder = folders.get(file.parentId)!;
      expect(folder, `folder for ${file.id}`).toBeDefined();
      expect(contains(folder, file), `${file.id} inside ${folder.id}`).toBe(true);
    });
  });

  it('places every folder inside its parent folder', () => {
    const layout = computeNestedLayout(treeNodes);
    const folders = folderById(layout);
    layout.folders.forEach((folder) => {
      if (!folder.parentId) return;
      const parent = folders.get(folder.parentId)!;
      expect(parent).toBeDefined();
      expect(contains(parent, folder), `${folder.id} inside ${parent.id}`).toBe(true);
    });
  });

  it('files sit below the folder header and never overlap siblings', () => {
    const layout = computeNestedLayout(treeNodes);
    const folders = folderById(layout);
    layout.files.forEach((file) => {
      if (!file.parentId) return;
      const folder = folders.get(file.parentId)!;
      expect(file.y).toBeGreaterThanOrEqual(folder.y + DEFAULT_NESTED_LAYOUT_CONFIG.headerHeight);
    });
    // no two file boxes overlap
    for (let i = 0; i < layout.files.length; i++) {
      for (let j = i + 1; j < layout.files.length; j++) {
        const a = layout.files[i];
        const b = layout.files[j];
        const overlap =
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('depth increments by one from folder to child folder / file', () => {
    const layout = computeNestedLayout(treeNodes);
    const folders = folderById(layout);
    expect(folders.get('folder-src')!.depth).toBe(1);
    expect(folders.get('folder-src/components')!.depth).toBe(2);
    expect(folders.get('folder-src/components/ui')!.depth).toBe(3);
    layout.folders.forEach((f) => {
      if (f.parentId) expect(f.depth).toBe(folders.get(f.parentId)!.depth + 1);
    });
    layout.files.forEach((f) => {
      if (f.parentId) expect(f.depth).toBe(folders.get(f.parentId)!.depth + 1);
      else expect(f.depth).toBe(1);
    });
  });

  it('lists parents before their children (folders precede contents)', () => {
    const layout = computeNestedLayout(treeNodes);
    const order = new Map(layout.folders.map((f, i) => [f.id, i]));
    layout.folders.forEach((f) => {
      if (f.parentId) expect(order.get(f.parentId)!).toBeLessThan(order.get(f.id)!);
    });
  });

  it('lays top-level folders side by side separated by topLevelGap', () => {
    const layout = computeNestedLayout(treeNodes);
    // Shallow paths are inserted first, so the root-level file leads the row
    const rootFile = layout.files.find((f) => f.id === 'i')!;
    expect(rootFile.x).toBe(0);
    expect(rootFile.y).toBe(0);
    const tops = layout.folders.filter((f) => !f.parentId).sort((a, b) => a.x - b.x);
    expect(tops.map((t) => t.id)).toEqual(['folder-src', 'folder-backend']);
    expect(tops[0].x).toBe(rootFile.width + DEFAULT_NESTED_LAYOUT_CONFIG.topLevelGap);
    expect(tops[0].y).toBe(0);
    expect(tops[1].x).toBe(tops[0].x + tops[0].width + DEFAULT_NESTED_LAYOUT_CONFIG.topLevelGap);
    expect(tops[1].y).toBe(0);
  });

  it('computes fileCount (recursive) and the dominant category per folder', () => {
    const layout = computeNestedLayout(treeNodes);
    const folders = folderById(layout);
    expect(folders.get('folder-src')!.fileCount).toBe(5);
    expect(folders.get('folder-src/components')!.fileCount).toBe(3);
    expect(folders.get('folder-src/components/ui')!.fileCount).toBe(1);
    expect(folders.get('folder-backend')!.fileCount).toBe(3);
    expect(folders.get('folder-backend/tests')!.fileCount).toBe(1);
    expect(folders.get('folder-src')!.category).toBe('frontend');
    expect(folders.get('folder-backend')!.category).toBe('backend');
    expect(folders.get('folder-backend/tests')!.category).toBe('test');
  });

  it('respects a custom config (slot size and min container size)', () => {
    const layout = computeNestedLayout(treeNodes, { fileNodeWidth: 200, fileNodeHeight: 80, minContainerWidth: 500 });
    layout.files.forEach((f) => {
      expect(f.width).toBe(200);
      expect(f.height).toBe(80);
    });
    layout.folders.forEach((f) => expect(f.width).toBeGreaterThanOrEqual(500));
  });

  it('is deterministic and does not depend on input order', () => {
    const a = computeNestedLayout(treeNodes);
    const b = computeNestedLayout(treeNodes);
    expect(a).toEqual(b);
    const shuffled = [...treeNodes].reverse();
    const c = computeNestedLayout(shuffled);
    // same folders, same sizes; folder ids identical
    expect(c.folders.map((f) => f.id).sort()).toEqual(a.folders.map((f) => f.id).sort());
    expect(c.files).toHaveLength(a.files.length);
  });

  it('handles the mock analysis graph (leading-slash paths)', () => {
    const layout = computeNestedLayout(mockReactFlowGraph.nodes);
    expect(layout.folders.map((f) => f.id)).toEqual(['folder-src']);
    expect(layout.files.map((f) => f.id).sort()).toEqual(['node1', 'node2']);
    layout.files.forEach((f) => expect(f.parentId).toBe('folder-src'));
  });
});

// ---------------------------------------------------------------------------
// tree helpers
// ---------------------------------------------------------------------------

describe('buildTree / countFiles / getDominantCategory', () => {
  it('builds a root with one child per top-level entry', () => {
    const root = buildTree(treeNodes);
    expect(root.id).toBe('root');
    // shallowest paths first: the root file, then the two top-level folders
    expect(root.children.map((c) => c.id)).toEqual(['i', 'folder-src', 'folder-backend']);
    expect(countFiles(root)).toBe(treeNodes.length);
    expect(getDominantCategory(root)).toBe('frontend');
  });

  it('empty folder tree reports the "folder" category', () => {
    const root = buildTree([]);
    expect(getDominantCategory(root)).toBe('folder');
    expect(countFiles(root)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toNestedScene
// ---------------------------------------------------------------------------

describe('toNestedScene', () => {
  const layout = computeNestedLayout(treeNodes);
  const edges = [
    { id: 'e1', source: 'b', target: 'a' },
    { id: 'e2', source: 'zzz', target: 'a' }, // dangling → dropped
  ];
  const scene = toNestedScene(layout, edges);

  it('maps folders to kind "folder" with NestedFolderNodeData and interactive true', () => {
    const folders = scene.nodes.filter((n) => n.kind === 'folder');
    expect(folders).toHaveLength(layout.folders.length);
    const src = folders.find((n) => n.id === 'folder-src')!;
    expect(src.interactive).toBe(true);
    expect(src.depth).toBe(1);
    expect(src.parentId).toBeUndefined();
    expect(src.data).toEqual({ label: 'src', path: 'src', depth: 1, fileCount: 5, category: 'frontend' });
    const ui = folders.find((n) => n.id === 'folder-src/components/ui')!;
    expect(ui.parentId).toBe('folder-src/components');
    expect(ui.depth).toBe(3);
  });

  it('maps files to kind "file" carrying the ORIGINAL ReactFlowNodeData and the folder parentId', () => {
    const files = scene.nodes.filter((n) => n.kind === 'file');
    expect(files).toHaveLength(treeNodes.length);
    const b = files.find((n) => n.id === 'b')!;
    expect(b.data).toBe(treeNodes[1].data);
    expect(b.parentId).toBe('folder-src/components');
    expect(b.depth).toBe(3);
    expect(b.width).toBe(DEFAULT_NESTED_LAYOUT_CONFIG.fileNodeWidth);
    // no camelCase renaming
    expect((b.data as Record<string, unknown>).size_bytes).toBe(10);
    expect((b.data as Record<string, unknown>).sizeBytes).toBeUndefined();
  });

  it('keeps folder → file order (folders precede their files) and computes bounds', () => {
    const firstFileIdx = scene.nodes.findIndex((n) => n.kind === 'file');
    const lastFolderIdx = scene.nodes.map((n) => n.kind).lastIndexOf('folder');
    expect(lastFolderIdx).toBeLessThan(firstFileIdx);
    expect(scene.bounds.x).toBe(0);
    expect(scene.bounds.y).toBe(0);
    expect(scene.bounds.width).toBeGreaterThan(0);
    expect(scene.bounds.height).toBeGreaterThan(0);
  });

  it('keeps edges between present nodes and drops dangling ones', () => {
    expect(scene.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('positions match the layout boxes (absolute)', () => {
    const b = scene.nodes.find((n) => n.id === 'b')!;
    const box = layout.files.find((f) => f.id === 'b')!;
    expect(b.x).toBe(box.x);
    expect(b.y).toBe(box.y);
    const parent = scene.nodes.find((n) => n.id === 'folder-src/components')!;
    expect(contains(parent, b)).toBe(true);
  });
});
