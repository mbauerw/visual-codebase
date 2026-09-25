/**
 * Every role theme pack must keep the layout's containment contract:
 *
 *   section ⊃ category ⊃ file
 *
 * and the engine's node conventions (kinds, parentId, depth, unique ids).
 * Collapsible packs must hide files until a category is expanded and
 * re-route their edges to the category.
 */

import { describe, expect, it } from 'vitest';
import type { GraphNode, GraphScene, Rect } from '../core/types';
import { roleThemePacks } from '../themes';
import type { RoleThemePack, ThemeSceneState } from '../themes/types';
import { demoGraph } from '../dev/demoGraph';

const contains = (outer: Rect, inner: Rect, tolerance = 0.5) =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance;

const rect = (n: GraphNode): Rect => ({ x: n.x, y: n.y, width: n.width, height: n.height });

function build(pack: RoleThemePack, expanded: Iterable<string> = []): GraphScene {
  const state: ThemeSceneState = { expanded: new Set(expanded) };
  return pack.buildScene({ nodes: demoGraph.nodes, edges: demoGraph.edges, state });
}

function assertContainment(scene: GraphScene) {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  expect(byId.size).toBe(scene.nodes.length); // unique ids
  const sections = scene.nodes.filter((n) => n.kind === 'section');
  const categories = scene.nodes.filter((n) => n.kind === 'category');
  const files = scene.nodes.filter((n) => n.kind === 'file');
  expect(sections.length).toBeGreaterThan(0);
  expect(categories.length).toBeGreaterThan(0);

  for (const c of categories) {
    expect(c.depth).toBe(0);
    const host = sections.find((s) => contains(rect(s), rect(c)));
    expect(host, `category ${c.id} lies inside a section`).toBeDefined();
  }
  for (const f of files) {
    expect(f.depth).toBe(1);
    expect(f.parentId).toBeDefined();
    const parent = byId.get(f.parentId!);
    expect(parent?.kind, `file ${f.id} parent is a category`).toBe('category');
    expect(contains(rect(parent!), rect(f)), `file ${f.id} lies inside ${parent!.id}`).toBe(true);
  }
  for (const e of scene.edges) {
    expect(byId.has(e.source) && byId.has(e.target), `edge ${e.id} endpoints exist`).toBe(true);
  }
}

describe.each(roleThemePacks.map((p) => [p.id, p] as const))('theme pack "%s"', (_id, pack) => {
  it('keeps section ⊃ category ⊃ file containment', () => {
    const scene = build(pack);
    assertContainment(scene);
    if (!pack.collapsible) {
      expect(scene.nodes.filter((n) => n.kind === 'file')).toHaveLength(demoGraph.nodes.length);
    }
  });

  it('is deterministic', () => {
    expect(build(pack)).toEqual(build(pack));
  });

  if (pack.collapsible) {
    it('hides files until their category is expanded and bundles their edges', () => {
      const folded = build(pack);
      expect(folded.nodes.some((n) => n.kind === 'file')).toBe(false);
      // every edge is a category-level bundle
      const catIds = new Set(folded.nodes.filter((n) => n.kind === 'category').map((n) => n.id));
      expect(folded.edges.length).toBeGreaterThan(0);
      for (const e of folded.edges) {
        expect(catIds.has(e.source) && catIds.has(e.target)).toBe(true);
        expect(e.styleOverride?.strokeWidth).toBeGreaterThan(0);
      }

      const first = folded.nodes.find((n) => n.kind === 'category')!;
      const open = build(pack, [first.id]);
      assertContainment(open);
      const files = open.nodes.filter((n) => n.kind === 'file');
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.parentId === first.id)).toBe(true);
      // opened files keep the API id and data
      const apiIds = new Set(demoGraph.nodes.map((n) => n.id));
      expect(files.every((f) => apiIds.has(f.id))).toBe(true);
    });
  }
});
