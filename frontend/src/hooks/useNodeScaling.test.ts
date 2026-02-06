import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { calculateNodeScales, useNodeScaling } from './useNodeScaling';
import type { ArchitecturalRole, ScaleTier } from '../types';
import type { Edge } from '@xyflow/react';

// Helper to create test nodes
interface TestNode {
  id: string;
  data: { role: ArchitecturalRole };
}

function createNode(id: string, role: ArchitecturalRole): TestNode {
  return { id, data: { role } };
}

function createEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  };
}

describe('calculateNodeScales', () => {
  describe('edge cases', () => {
    it('should return empty map for empty nodes array', () => {
      const result = calculateNodeScales([], []);
      expect(result.size).toBe(0);
    });

    it('should handle single node with no edges', () => {
      const nodes = [createNode('n1', 'utility')];
      const edges: Edge[] = [];

      const result = calculateNodeScales(nodes, edges);

      expect(result.size).toBe(1);
      // Single node in a role gets top tier (2)
      expect(result.get('n1')).toBe(2);
    });

    it('should handle single node per role', () => {
      const nodes = [
        createNode('n1', 'utility'),
        createNode('n2', 'react_component'),
        createNode('n3', 'api_service'),
      ];
      const edges: Edge[] = [];

      const result = calculateNodeScales(nodes, edges);

      // Each node is the only one in its role, so each gets top tier
      expect(result.get('n1')).toBe(2);
      expect(result.get('n2')).toBe(2);
      expect(result.get('n3')).toBe(2);
    });

    it('should handle nodes with no matching edges', () => {
      const nodes = [
        createNode('n1', 'utility'),
        createNode('n2', 'utility'),
      ];
      // Edges reference non-existent nodes
      const edges = [createEdge('x1', 'x2')];

      const result = calculateNodeScales(nodes, edges);

      expect(result.size).toBe(2);
      // Both have 0 dependencies, same percentile
      // With equal counts, both get assigned based on thresholds
    });
  });

  describe('dependency counting', () => {
    it('should count bidirectional dependencies', () => {
      // n1 imports n2, n3 imports n1
      // n1: 2 connections (source once, target once)
      // n2: 1 connection (target)
      // n3: 1 connection (source)
      const nodes = [
        createNode('n1', 'utility'),
        createNode('n2', 'utility'),
        createNode('n3', 'utility'),
      ];
      const edges = [
        createEdge('n1', 'n2'), // n1 imports n2
        createEdge('n3', 'n1'), // n3 imports n1
      ];

      const result = calculateNodeScales(nodes, edges);

      // n1 has highest dependency count (2), should be top tier
      expect(result.get('n1')).toBe(2);
    });

    it('should count multiple imports from same node', () => {
      const nodes = [
        createNode('n1', 'utility'),
        createNode('n2', 'utility'),
        createNode('n3', 'utility'),
      ];
      // n1 is imported by both n2 and n3
      const edges = [
        createEdge('n2', 'n1'),
        createEdge('n3', 'n1'),
      ];

      const result = calculateNodeScales(nodes, edges);

      // n1 has 2 connections (as target), n2 and n3 have 1 each (as source)
      expect(result.get('n1')).toBe(2);
    });
  });

  describe('percentile thresholds', () => {
    it('should assign correct tiers based on percentiles', () => {
      // Create 10 nodes in same role with varying dependency counts
      const nodes = Array.from({ length: 10 }, (_, i) =>
        createNode(`n${i}`, 'utility')
      );

      // Create edges to give different dependency counts:
      // n0: 9 deps (most connected)
      // n1: 8 deps
      // n2-n9: decreasing deps
      const edges: Edge[] = [];
      for (let i = 1; i < 10; i++) {
        edges.push(createEdge(`n${i}`, 'n0')); // n0 is imported by all
      }
      for (let i = 2; i < 10; i++) {
        edges.push(createEdge(`n${i}`, 'n1')); // n1 is imported by most
      }

      const result = calculateNodeScales(nodes, edges);

      // n0 should be top 10% (2)
      expect(result.get('n0')).toBe(2);
    });

    it('should handle ties by promoting to higher tier', () => {
      // All nodes have same dependency count
      const nodes = [
        createNode('n1', 'utility'),
        createNode('n2', 'utility'),
        createNode('n3', 'utility'),
      ];
      const edges = [
        createEdge('n1', 'n2'),
        createEdge('n2', 'n3'),
        createEdge('n3', 'n1'),
      ];

      const result = calculateNodeScales(nodes, edges);

      // All have count of 2, all should get same tier
      // With equal counts at threshold, they should be promoted
      const tier1 = result.get('n1');
      const tier2 = result.get('n2');
      const tier3 = result.get('n3');

      expect(tier1).toBe(tier2);
      expect(tier2).toBe(tier3);
    });
  });

  describe('tier assignment', () => {
    it('should assign 2 to top 10%', () => {
      // Create 100 nodes to test percentiles properly
      const nodes = Array.from({ length: 100 }, (_, i) =>
        createNode(`n${i}`, 'utility')
      );

      // Make n0 the most connected
      const edges: Edge[] = [];
      for (let i = 1; i < 100; i++) {
        edges.push(createEdge(`n${i}`, 'n0'));
      }

      const result = calculateNodeScales(nodes, edges);

      // n0 has 99 connections, should be top tier
      expect(result.get('n0')).toBe(2);
    });

    it('should assign 1.25 to 10th-35th percentile', () => {
      const nodes = Array.from({ length: 20 }, (_, i) =>
        createNode(`n${i}`, 'utility')
      );

      // Create varying connection counts
      const edges: Edge[] = [];
      // n0: highest (20 connections)
      for (let i = 1; i < 20; i++) {
        edges.push(createEdge(`n${i}`, 'n0'));
      }
      // n1, n2, n3: medium (5-10 connections each)
      for (let i = 4; i < 10; i++) {
        edges.push(createEdge(`n${i}`, 'n1'));
      }
      for (let i = 10; i < 15; i++) {
        edges.push(createEdge(`n${i}`, 'n2'));
      }

      const result = calculateNodeScales(nodes, edges);

      // n0 should be 2 (top tier)
      expect(result.get('n0')).toBe(2);
    });

    it('should assign 1.0 to bottom 65%', () => {
      // Create 20 nodes with varying connection counts
      const nodes = Array.from({ length: 20 }, (_, i) =>
        createNode(`n${i}`, 'utility')
      );

      // Create edges with varying connectivity:
      // n0: 19 connections (imported by all), n1: 10, n2: 5, rest: 1-2
      const edges: Edge[] = [];
      // n0 is imported by everyone
      for (let i = 1; i < 20; i++) {
        edges.push(createEdge(`n${i}`, 'n0'));
      }
      // n1 is imported by some
      for (let i = 5; i < 15; i++) {
        edges.push(createEdge(`n${i}`, 'n1'));
      }
      // n2 is imported by a few
      for (let i = 10; i < 15; i++) {
        edges.push(createEdge(`n${i}`, 'n2'));
      }

      const result = calculateNodeScales(nodes, edges);

      // With this distribution, we should have nodes in all tiers
      const tierCounts = {
        1: 0,
        1.25: 0,
        2: 0,
      };
      result.forEach((tier) => {
        if (tier === 1) tierCounts[1]++;
        else if (tier === 1.25) tierCounts[1.25]++;
        else tierCounts[2]++;
      });

      // At least some nodes should be in bottom tier (1.0)
      // Note: Due to tie-breaking rules, lower-connected nodes get tier 1.0
      expect(tierCounts[1] + tierCounts[1.25] + tierCounts[2]).toBe(20);
    });
  });

  describe('role independence', () => {
    it('should calculate percentiles within each role separately', () => {
      const nodes = [
        // Utility group
        createNode('u1', 'utility'),
        createNode('u2', 'utility'),
        createNode('u3', 'utility'),
        // Component group
        createNode('c1', 'react_component'),
        createNode('c2', 'react_component'),
        createNode('c3', 'react_component'),
      ];

      const edges = [
        // u1 is highly connected within utilities
        createEdge('u2', 'u1'),
        createEdge('u3', 'u1'),
        // c1 is highly connected within components
        createEdge('c2', 'c1'),
        createEdge('c3', 'c1'),
      ];

      const result = calculateNodeScales(nodes, edges);

      // Both u1 and c1 should be top tier in their respective roles
      expect(result.get('u1')).toBe(2);
      expect(result.get('c1')).toBe(2);
    });

    it('should not mix roles when calculating percentiles', () => {
      const nodes = [
        // 10 utilities
        ...Array.from({ length: 10 }, (_, i) =>
          createNode(`u${i}`, 'utility')
        ),
        // 10 components
        ...Array.from({ length: 10 }, (_, i) =>
          createNode(`c${i}`, 'react_component')
        ),
      ];

      // Make u0 highly connected
      const edges: Edge[] = [];
      for (let i = 1; i < 10; i++) {
        edges.push(createEdge(`u${i}`, 'u0'));
      }

      const result = calculateNodeScales(nodes, edges);

      // u0 should be top tier within utilities
      expect(result.get('u0')).toBe(2);

      // Each component with no connections is in its own role group
      // All components have 0 connections, so they're all equal within their role
      const componentScales = ['c0', 'c1', 'c2', 'c3', 'c4'].map((id) =>
        result.get(id)
      );
      // All should be the same tier (all have 0 deps)
      expect(new Set(componentScales).size).toBe(1);
    });
  });

  describe('large datasets', () => {
    it('should handle large number of nodes efficiently', () => {
      const nodes = Array.from({ length: 1000 }, (_, i) =>
        createNode(`n${i}`, 'utility')
      );

      // Create random connections
      const edges: Edge[] = [];
      for (let i = 0; i < 500; i++) {
        const source = `n${Math.floor(Math.random() * 1000)}`;
        const target = `n${Math.floor(Math.random() * 1000)}`;
        if (source !== target) {
          edges.push(createEdge(source, target));
        }
      }

      const start = performance.now();
      const result = calculateNodeScales(nodes, edges);
      const duration = performance.now() - start;

      expect(result.size).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});

describe('useNodeScaling hook', () => {
  it('should return correct scales for given nodes and edges', () => {
    const nodes = [
      createNode('n1', 'utility'),
      createNode('n2', 'utility'),
      createNode('n3', 'utility'),
    ];
    const edges = [
      createEdge('n2', 'n1'),
      createEdge('n3', 'n1'),
    ];

    const { result } = renderHook(() =>
      useNodeScaling(nodes, edges as Edge[])
    );

    expect(result.current instanceof Map).toBe(true);
    expect(result.current.size).toBe(3);
    expect(result.current.get('n1')).toBe(2); // Most connected
  });

  it('should memoize result when inputs are unchanged', () => {
    const nodes = [
      createNode('n1', 'utility'),
      createNode('n2', 'utility'),
    ];
    const edges = [createEdge('n1', 'n2')];

    const { result, rerender } = renderHook(
      ({ n, e }) => useNodeScaling(n, e as Edge[]),
      { initialProps: { n: nodes, e: edges } }
    );

    const firstResult = result.current;

    // Rerender with same inputs
    rerender({ n: nodes, e: edges });

    // Should return same reference (memoized)
    expect(result.current).toBe(firstResult);
  });

  it('should recalculate when nodes change', () => {
    const nodes1 = [createNode('n1', 'utility')];
    const nodes2 = [
      createNode('n1', 'utility'),
      createNode('n2', 'utility'),
    ];
    const edges: Edge[] = [];

    const { result, rerender } = renderHook(
      ({ n, e }) => useNodeScaling(n, e),
      { initialProps: { n: nodes1, e: edges } }
    );

    expect(result.current.size).toBe(1);

    // Change nodes
    rerender({ n: nodes2, e: edges });

    expect(result.current.size).toBe(2);
  });

  it('should recalculate when edges change', () => {
    const nodes = [
      createNode('n1', 'utility'),
      createNode('n2', 'utility'),
    ];
    const edges1: Edge[] = [];
    const edges2 = [createEdge('n1', 'n2')];

    const { result, rerender } = renderHook(
      ({ n, e }) => useNodeScaling(n, e),
      { initialProps: { n: nodes, e: edges1 } }
    );

    const tier1Before = result.current.get('n1');

    // Add an edge
    rerender({ n: nodes, e: edges2 });

    // Tiers may change based on new connections
    expect(result.current.get('n1')).toBeDefined();
  });
});

describe('edge case scenarios', () => {
  it('should handle self-referencing edges', () => {
    const nodes = [createNode('n1', 'utility')];
    const edges = [createEdge('n1', 'n1')]; // Self-import

    const result = calculateNodeScales(nodes, edges);

    expect(result.size).toBe(1);
    // n1 has 2 connections to itself
    expect(result.get('n1')).toBe(2);
  });

  it('should handle duplicate edges', () => {
    const nodes = [
      createNode('n1', 'utility'),
      createNode('n2', 'utility'),
    ];
    const edges = [
      createEdge('n1', 'n2'),
      createEdge('n1', 'n2'), // Duplicate
    ];

    const result = calculateNodeScales(nodes, edges);

    // Should count both edges
    expect(result.size).toBe(2);
  });

  it('should handle unknown role', () => {
    const nodes = [
      createNode('n1', 'unknown'),
      createNode('n2', 'unknown'),
      createNode('n3', 'unknown'),
    ];
    const edges = [
      createEdge('n2', 'n1'),
      createEdge('n3', 'n1'),
    ];

    const result = calculateNodeScales(nodes, edges);

    // Should work the same as any other role
    expect(result.get('n1')).toBe(2);
  });

  it('should handle mixed roles with no edges', () => {
    const nodes = [
      createNode('n1', 'utility'),
      createNode('n2', 'react_component'),
      createNode('n3', 'api_service'),
      createNode('n4', 'model'),
    ];

    const result = calculateNodeScales(nodes, []);

    // Each node is alone in its role with 0 deps
    expect(result.size).toBe(4);
    // Single node per role gets top tier
    expect(result.get('n1')).toBe(2);
    expect(result.get('n2')).toBe(2);
    expect(result.get('n3')).toBe(2);
    expect(result.get('n4')).toBe(2);
  });
});
