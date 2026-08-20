import { describe, it, expect } from 'vitest';

import {
  computeRoleLayout,
  categorizeNode,
  calculateBaseColumns,
  calculateRectangularGridDimensions,
  calculateRectangularRoleDimensions,
  hasUniformDependencies,
  ROLE_LAYOUT_CONFIG,
  type RoleCategoryBox,
  type RoleFileBox,
  type RoleLayoutResult,
  type RoleSectionBox,
} from '../layouts/roleLayout';
import type { ArchitecturalRole, Category, ReactFlowNode, ScaleTier } from '../../types';
import { roleLabels } from '../../types';
import { mockReactFlowGraph } from '../../test/mocks/handlers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, role: ArchitecturalRole, category: Category): ReactFlowNode {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: `${id}.ts`,
      path: `/src/${id}.ts`,
      folder: '/src',
      language: 'typescript',
      role,
      description: '',
      category,
      imports: [],
      size_bytes: 10,
      line_count: 1,
    },
  };
}

function edge(source: string, target: string) {
  return { source, target };
}

/**
 * Mixed fixture: two frontend roles, two backend roles (one via
 * 'infrastructure', one via 'shared' -> frontend), a role with a wide spread of
 * dependency counts (pyramid), and test files (via role and via category).
 */
const mixedNodes: ReactFlowNode[] = [
  // frontend / react_component - varied dependency counts -> pyramid layout
  makeNode('App', 'react_component', 'frontend'),
  makeNode('Header', 'react_component', 'frontend'),
  makeNode('Footer', 'react_component', 'frontend'),
  makeNode('Sidebar', 'react_component', 'frontend'),
  makeNode('Button', 'react_component', 'frontend'),
  makeNode('Icon', 'react_component', 'frontend'),
  makeNode('Modal', 'react_component', 'frontend'),
  makeNode('Toast', 'react_component', 'frontend'),
  // frontend / hook
  makeNode('useAuth', 'hook', 'frontend'),
  makeNode('useTheme', 'hook', 'frontend'),
  // shared category -> frontend section
  makeNode('format', 'utility', 'shared'),
  // backend
  makeNode('apiClient', 'api_service', 'backend'),
  makeNode('userApi', 'api_service', 'backend'),
  makeNode('UserModel', 'model', 'backend'),
  // infrastructure category -> backend section
  makeNode('dockerCfg', 'config', 'infrastructure'),
  // tests: by role and by category
  makeNode('App.test', 'test', 'frontend'),
  makeNode('helpers', 'utility', 'test'),
];

const mixedEdges = [
  edge('App', 'Header'),
  edge('App', 'Footer'),
  edge('App', 'Sidebar'),
  edge('App', 'Button'),
  edge('App', 'Modal'),
  edge('Header', 'Button'),
  edge('Header', 'Icon'),
  edge('Sidebar', 'Button'),
  edge('Modal', 'Button'),
  edge('App', 'useAuth'),
  edge('useAuth', 'apiClient'),
  edge('userApi', 'apiClient'),
  edge('apiClient', 'UserModel'),
  edge('App.test', 'App'),
  edge('helpers', 'format'),
];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

type Box = { x: number; y: number; width: number; height: number };

function contains(outer: Box, inner: Box, eps = 1e-6): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  );
}

function containsPoint(outer: Box, px: number, py: number): boolean {
  return px >= outer.x && px <= outer.x + outer.width && py >= outer.y && py <= outer.y + outer.height;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

/** Structural invariants that must hold for any input. */
function expectLayoutInvariants(
  result: RoleLayoutResult,
  inputNodes: ReactFlowNode[],
  config: { nodeWidth: number; nodeHeight: number } = ROLE_LAYOUT_CONFIG
) {
  const categories = byId(result.categories);
  const sections = byId(result.sections);

  // every input node is laid out exactly once
  expect(result.files.map((f) => f.id).sort()).toEqual(inputNodes.map((n) => n.id).sort());

  // every file box lies fully inside its category box
  for (const file of result.files) {
    const cat = categories.get(file.categoryId);
    expect(cat, `category ${file.categoryId} for file ${file.id}`).toBeDefined();
    expect(contains(cat!, file), `file ${file.id} inside ${file.categoryId}`).toBe(true);
    expect(file.width).toBe(config.nodeWidth);
    expect(file.height).toBe(config.nodeHeight);
    // scaleTier present and mirrored into data
    expect(file.scaleTier).toBeGreaterThanOrEqual(1);
    expect(file.data.scaleTier).toBe(file.scaleTier);
    // category id encodes section + role and matches categorizeNode
    const section = categorizeNode(file.data.category, file.data.role);
    expect(file.categoryId).toBe(`${section}-${file.data.role}`);
    expect(cat!.role).toBe(file.data.role);
    expect(cat!.category).toBe(section);
  }

  // every category has >= 1 file and nodeCount matches
  for (const cat of result.categories) {
    const files = result.files.filter((f) => f.categoryId === cat.id);
    expect(files.length).toBeGreaterThan(0);
    expect(cat.nodeCount).toBe(files.length);
    expect(cat.label).toBe(roleLabels[cat.role]);
    expect(cat.width).toBeGreaterThan(0);
    expect(cat.height).toBeGreaterThan(0);

    // files inside one category never overlap each other
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        expect(overlaps(files[i], files[j]), `${files[i].id} vs ${files[j].id}`).toBe(false);
      }
    }

    // the category's centre lies inside its section box
    const section = sections.get(`section-${cat.category}`);
    expect(section, `section for ${cat.id}`).toBeDefined();
    expect(containsPoint(section!, cat.x + cat.width / 2, cat.y + cat.height / 2)).toBe(true);
    expect(section!.category).toBe(cat.category);
  }

  // sections: frontend + backend always present, test only when test files exist
  const sectionIds = result.sections.map((s) => s.id);
  expect(sectionIds.slice(0, 2)).toEqual(['section-frontend', 'section-backend']);
  const hasTestFiles = result.files.some((f) => f.categoryId.startsWith('test-'));
  expect(sectionIds.includes('section-test')).toBe(hasTestFiles);
  for (const section of result.sections) {
    const count = result.files.filter((f) => f.categoryId.startsWith(`${section.category}-`)).length;
    expect(section.nodeCount).toBe(count);
    expect(section.width).toBeGreaterThanOrEqual(600);
    expect(section.height).toBe(section.width);
    expect(section.color).toMatch(/^#/);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('roleLayout helpers', () => {
  it('categorizeNode routes by role first, then category', () => {
    expect(categorizeNode('frontend', 'test')).toBe('test');
    expect(categorizeNode('backend', 'test')).toBe('test');
    expect(categorizeNode('frontend', 'react_component')).toBe('frontend');
    expect(categorizeNode('backend', 'api_service')).toBe('backend');
    expect(categorizeNode('infrastructure', 'config')).toBe('backend');
    expect(categorizeNode('test', 'utility')).toBe('test');
    expect(categorizeNode('shared', 'utility')).toBe('frontend');
    expect(categorizeNode('config', 'config')).toBe('frontend');
    expect(categorizeNode('unknown', 'utility')).toBe('frontend');
  });

  it('calculateBaseColumns finds the smallest n with n*(n+2) >= count', () => {
    expect(calculateBaseColumns(0)).toBe(0);
    expect(calculateBaseColumns(1)).toBe(1);
    expect(calculateBaseColumns(2)).toBe(2);
    expect(calculateBaseColumns(3)).toBe(1);
    expect(calculateBaseColumns(4)).toBe(2);
    expect(calculateBaseColumns(8)).toBe(2);
    expect(calculateBaseColumns(9)).toBe(3);
    expect(calculateBaseColumns(15)).toBe(3);
    expect(calculateBaseColumns(16)).toBe(4);
  });

  it('calculateRectangularGridDimensions returns n x (n+2) except tiny counts', () => {
    expect(calculateRectangularGridDimensions(0)).toEqual({ cols: 0, rows: 0 });
    expect(calculateRectangularGridDimensions(1)).toEqual({ cols: 1, rows: 1 });
    expect(calculateRectangularGridDimensions(2)).toEqual({ cols: 2, rows: 1 });
    expect(calculateRectangularGridDimensions(3)).toEqual({ cols: 1, rows: 3 });
    expect(calculateRectangularGridDimensions(10)).toEqual({ cols: 3, rows: 5 });
  });

  it('calculateRectangularRoleDimensions uses the config values', () => {
    const { nodeWidth, nodeHeight, nodeGapX, nodeGapY, rolePadding, roleHeaderHeight } = ROLE_LAYOUT_CONFIG;
    // 2 nodes -> 2 cols x 1 row
    expect(calculateRectangularRoleDimensions(2)).toEqual({
      width: 2 * (nodeWidth + nodeGapX) - nodeGapX + rolePadding * 2,
      height: roleHeaderHeight + nodeHeight + rolePadding,
      rows: 1,
      maxCols: 2,
    });
    // (nodeGapY cancels for a single row; make sure the constant is what we think)
    expect(nodeGapY).toBe(85);
    expect(calculateRectangularRoleDimensions(0)).toEqual({ width: 250, height: 150, rows: 0, maxCols: 0 });
  });

  it('hasUniformDependencies compares scale tiers (missing = 1)', () => {
    const scales = new Map<string, ScaleTier>([
      ['a', 1],
      ['b', 1.25],
    ]);
    expect(hasUniformDependencies([{ id: 'a' }, { id: 'c' }], scales)).toBe(true);
    expect(hasUniformDependencies([{ id: 'a' }, { id: 'b' }], scales)).toBe(false);
    expect(hasUniformDependencies([{ id: 'b' }], scales)).toBe(true);
    expect(hasUniformDependencies([], scales)).toBe(true);
  });

  it('exports the historical layout constants', () => {
    expect(ROLE_LAYOUT_CONFIG).toEqual({
      nodeWidth: 240,
      nodeHeight: 100,
      nodeGapX: 220,
      nodeGapY: 85,
      rolePadding: 195,
      roleHeaderHeight: 150,
    });
  });
});

describe('computeRoleLayout', () => {
  describe('with mockReactFlowGraph', () => {
    const result = computeRoleLayout(mockReactFlowGraph.nodes, mockReactFlowGraph.edges);

    it('satisfies the structural invariants', () => {
      expectLayoutInvariants(result, mockReactFlowGraph.nodes);
    });

    it('produces one frontend react_component category with both files', () => {
      expect(result.categories.map((c) => c.id)).toEqual(['frontend-react_component']);
      expect(result.categories[0]).toMatchObject<Partial<RoleCategoryBox>>({
        role: 'react_component',
        label: 'React Component',
        category: 'frontend',
        nodeCount: 2,
      });
      expect(result.files.map((f) => f.id).sort()).toEqual(['node1', 'node2']);
    });

    it('creates frontend + backend sections but no test section', () => {
      expect(result.sections.map((s) => s.id)).toEqual(['section-frontend', 'section-backend']);
      expect(result.sections[0].nodeCount).toBe(2);
      expect(result.sections[1].nodeCount).toBe(0);
    });

    it('keeps the original node data (plus scaleTier) on each file', () => {
      for (const file of result.files) {
        const original = mockReactFlowGraph.nodes.find((n) => n.id === file.id)!;
        expect(file.data).toEqual({ ...original.data, scaleTier: file.scaleTier });
      }
    });

    it('is deterministic', () => {
      const again = computeRoleLayout(mockReactFlowGraph.nodes, mockReactFlowGraph.edges);
      expect(again).toEqual(result);
    });
  });

  describe('with a mixed roles / categories fixture', () => {
    const result = computeRoleLayout(mixedNodes, mixedEdges);

    it('satisfies the structural invariants', () => {
      expectLayoutInvariants(result, mixedNodes);
    });

    it('groups files into the expected sections and roles', () => {
      const catIds = result.categories.map((c) => c.id).sort();
      expect(catIds).toEqual(
        [
          'frontend-react_component',
          'frontend-hook',
          'frontend-utility', // shared -> frontend
          'backend-api_service',
          'backend-model',
          'backend-config', // infrastructure -> backend
          'test-test', // role test
          'test-utility', // category test
        ].sort()
      );
      expect(result.sections.map((s) => s.id)).toEqual(['section-frontend', 'section-backend', 'section-test']);
      expect(result.sections.find((s) => s.id === 'section-test')!.nodeCount).toBe(2);
    });

    it('orders categories by section (frontend, backend, test) and files after their categories', () => {
      const sectionOrder = result.categories.map((c) => c.category);
      const firstBackend = sectionOrder.indexOf('backend');
      const firstTest = sectionOrder.indexOf('test');
      expect(sectionOrder.lastIndexOf('frontend')).toBeLessThan(firstBackend);
      expect(sectionOrder.lastIndexOf('backend')).toBeLessThan(firstTest);

      // files follow the same section order
      const fileSections = result.files.map((f) => f.categoryId.split('-')[0]);
      expect(fileSections.lastIndexOf('frontend')).toBeLessThan(fileSections.indexOf('backend'));
      expect(fileSections.lastIndexOf('backend')).toBeLessThan(fileSections.indexOf('test'));
    });

    it('sorts role groups and files by dependency count (highest first)', () => {
      // frontend: react_component (many deps) comes before hook before utility
      const frontendRoles = result.categories.filter((c) => c.category === 'frontend').map((c) => c.role);
      expect(frontendRoles).toEqual(['react_component', 'hook', 'utility']);

      // App has the most dependencies -> first file of react_component
      const rcFiles = result.files.filter((f) => f.categoryId === 'frontend-react_component');
      expect(rcFiles[0].id).toBe('App');
      // Button (4 deps) before Icon (1 dep) before Toast (0 deps)
      const idx = (id: string) => rcFiles.findIndex((f) => f.id === id);
      expect(idx('Button')).toBeLessThan(idx('Icon'));
      expect(idx('Icon')).toBeLessThan(idx('Toast'));
    });

    it('uses a pyramid (varied scale tiers, top row on top) for the react_component role', () => {
      const rcFiles = result.files.filter((f) => f.categoryId === 'frontend-react_component');
      const tiers = new Set(rcFiles.map((f) => f.scaleTier));
      expect(tiers.size).toBeGreaterThan(1);
      // The highest tier sits above the lowest tier
      const top = rcFiles.filter((f) => f.scaleTier === Math.max(...rcFiles.map((x) => x.scaleTier)));
      const bottom = rcFiles.filter((f) => f.scaleTier === 1);
      expect(Math.max(...top.map((f) => f.y))).toBeLessThan(Math.min(...bottom.map((f) => f.y)));
      // The top-tier file(s) are the most-connected ones
      expect(top.map((f) => f.id)).toContain('App');
    });

    it('uses a uniform grid (all scaleTier 1) for roles whose files have equal dependency counts', () => {
      // useAuth (2 deps) vs useTheme (0 deps) -> not uniform; model has one file -> uniform
      const modelFiles = result.files.filter((f) => f.categoryId === 'backend-model');
      expect(modelFiles.map((f) => f.scaleTier)).toEqual([1]);
      // Both test files are alone in their role -> uniform, tier 1
      const testFiles = result.files.filter((f) => f.categoryId.startsWith('test-'));
      expect(testFiles.every((f) => f.scaleTier === 1)).toBe(true);
    });

    it('is deterministic (same input -> deep-equal output)', () => {
      const a = computeRoleLayout(mixedNodes, mixedEdges);
      const b = computeRoleLayout(mixedNodes, mixedEdges);
      expect(a).toEqual(b);
      expect(a).toEqual(result);
    });

    it('does not mutate the input arrays', () => {
      const nodesBefore = JSON.stringify(mixedNodes);
      const edgesBefore = JSON.stringify(mixedEdges);
      computeRoleLayout(mixedNodes, mixedEdges);
      expect(JSON.stringify(mixedNodes)).toBe(nodesBefore);
      expect(JSON.stringify(mixedEdges)).toBe(edgesBefore);
      // and never injects scaleTier into the caller's node data
      expect(mixedNodes.every((n) => n.data.scaleTier === undefined)).toBe(true);
    });

    it('places the sections left-to-right (frontend, backend) with tests below backend', () => {
      const [frontend, backend, test] = result.sections as [RoleSectionBox, RoleSectionBox, RoleSectionBox];
      expect(backend.x).toBeGreaterThan(frontend.x + frontend.width - 1e-6);
      expect(test.y).toBeGreaterThan(backend.y + backend.height - 1e-6);
    });
  });

  describe('edge cases', () => {
    it('handles an empty graph', () => {
      const result = computeRoleLayout([], []);
      expect(result.files).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.sections.map((s) => s.id)).toEqual(['section-frontend', 'section-backend']);
      expect(result.sections.every((s) => s.nodeCount === 0)).toBe(true);
    });

    it('ignores edges that reference unknown nodes', () => {
      const nodes = [makeNode('a', 'utility', 'frontend'), makeNode('b', 'utility', 'frontend')];
      const withGhost = computeRoleLayout(nodes, [edge('a', 'ghost'), edge('ghost', 'b')]);
      const without = computeRoleLayout(nodes, []);
      expect(withGhost).toEqual(without);
    });

    it('lays out a single file centred in a single role box', () => {
      const result = computeRoleLayout([makeNode('only', 'store', 'frontend')], []);
      expectLayoutInvariants(result, [makeNode('only', 'store', 'frontend')]);
      const [cat] = result.categories;
      const [file] = result.files as [RoleFileBox];
      // horizontally centred inside its category
      expect(file.x + file.width / 2).toBeCloseTo(cat.x + cat.width / 2, 6);
      expect(file.y - cat.y).toBe(ROLE_LAYOUT_CONFIG.roleHeaderHeight);
    });

    it('honours config overrides', () => {
      const nodes = [makeNode('a', 'utility', 'frontend'), makeNode('b', 'utility', 'frontend')];
      const base = computeRoleLayout(nodes, []);
      const wide = computeRoleLayout(nodes, [], { nodeWidth: 440 });
      expect(wide.files.every((f) => f.width === 440)).toBe(true);
      expect(wide.categories[0].width).toBeGreaterThan(base.categories[0].width);
      expectLayoutInvariants(wide, nodes, { ...ROLE_LAYOUT_CONFIG, nodeWidth: 440 });
    });

    it('keeps files inside categories for larger pseudo-random graphs', () => {
      // deterministic LCG so the fixture is stable
      let seed = 42;
      const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const roles: ArchitecturalRole[] = ['react_component', 'hook', 'utility', 'api_service', 'model', 'controller', 'test', 'config', 'service'];
      const cats: Category[] = ['frontend', 'backend', 'test', 'shared', 'infrastructure', 'unknown'];
      const nodes: ReactFlowNode[] = [];
      for (let i = 0; i < 150; i++) {
        nodes.push(makeNode(`n${i}`, roles[Math.floor(rand() * roles.length)], cats[Math.floor(rand() * cats.length)]));
      }
      const edges: { source: string; target: string }[] = [];
      for (let i = 0; i < 400; i++) {
        edges.push(edge(`n${Math.floor(rand() * nodes.length)}`, `n${Math.floor(rand() * nodes.length)}`));
      }
      const result = computeRoleLayout(nodes, edges);
      expectLayoutInvariants(result, nodes);
      expect(computeRoleLayout(nodes, edges)).toEqual(result);
    });
  });
});
