/**
 * useNodeScaling - Calculate scale tiers for nodes based on dependency percentiles within each role.
 *
 * Scale Tiers:
 * - Top 10% of dependency count within role = 1.5
 * - Next 25% (10th-35th percentile) = 1.25
 * - Bottom 65% = 1.0 (baseline)
 */

import { useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import type { ArchitecturalRole, ScaleTier } from '../types';

interface NodeWithRole {
  id: string;
  data: {
    role: ArchitecturalRole;
  };
}

/**
 * Calculate dependency counts for all nodes (bidirectional - both source and target).
 */
function calculateDependencyCounts<T extends NodeWithRole>(
  nodes: T[],
  edges: Edge[]
): Map<string, number> {
  const counts = new Map<string, number>();

  // Initialize all nodes with 0
  nodes.forEach(node => counts.set(node.id, 0));

  // Count bidirectional dependencies
  edges.forEach(edge => {
    if (counts.has(edge.source)) {
      counts.set(edge.source, counts.get(edge.source)! + 1);
    }
    if (counts.has(edge.target)) {
      counts.set(edge.target, counts.get(edge.target)! + 1);
    }
  });

  return counts;
}

/**
 * Group nodes by their architectural role.
 */
function groupNodesByRole<T extends NodeWithRole>(
  nodes: T[],
  dependencyCounts: Map<string, number>
): Map<ArchitecturalRole, Array<{ nodeId: string; count: number }>> {
  const roleGroups = new Map<ArchitecturalRole, Array<{ nodeId: string; count: number }>>();

  nodes.forEach(node => {
    const role = node.data.role;
    const count = dependencyCounts.get(node.id) || 0;

    if (!roleGroups.has(role)) {
      roleGroups.set(role, []);
    }
    roleGroups.get(role)!.push({ nodeId: node.id, count });
  });

  return roleGroups;
}

/**
 * Calculate percentile thresholds for a sorted array of counts.
 * Uses "nearest rank" percentile method.
 *
 * @param counts - Array of dependency counts, sorted descending
 * @returns Object with p10 (top 10%) and p35 (top 35%) threshold values
 */
function calculatePercentileThresholds(
  counts: number[]
): { p10Threshold: number; p35Threshold: number } {
  const n = counts.length;

  if (n === 0) {
    return { p10Threshold: 0, p35Threshold: 0 };
  }

  if (n === 1) {
    // Single node: always top tier
    return { p10Threshold: counts[0], p35Threshold: counts[0] };
  }

  // Counts are sorted descending, so:
  // - Top 10% = indices 0 to ceil(n * 0.1) - 1
  // - Next 25% (10-35%) = indices ceil(n * 0.1) to ceil(n * 0.35) - 1
  // - Bottom 65% = indices ceil(n * 0.35) onwards

  // p10 threshold: minimum count to be in top 10%
  const p10Index = Math.ceil(n * 0.1) - 1;
  const p10Threshold = counts[Math.max(0, p10Index)];

  // p35 threshold: minimum count to be in top 35%
  const p35Index = Math.ceil(n * 0.35) - 1;
  const p35Threshold = counts[Math.max(0, p35Index)];

  return { p10Threshold, p35Threshold };
}

/**
 * Assign scale tier based on percentile within role group.
 * Handles ties by promoting to higher tier (favoring visual emphasis).
 */
function assignScaleTier(
  count: number,
  p10Threshold: number,
  p35Threshold: number
): ScaleTier {
  // Tie-breaking: >= threshold promotes to that tier
  if (count >= p10Threshold) {
    return 1.5; // Top 10%
  }
  if (count >= p35Threshold) {
    return 1.25; // Next 25% (10-35th percentile)
  }
  return 1; // Bottom 65%
}

/**
 * Calculate scale tiers for all nodes based on dependency percentiles within each role.
 */
export function calculateNodeScales<T extends NodeWithRole>(
  nodes: T[],
  edges: Edge[]
): Map<string, ScaleTier> {
  const nodeScales = new Map<string, ScaleTier>();

  if (nodes.length === 0) {
    return nodeScales;
  }

  // Step 1: Calculate dependency counts
  const dependencyCounts = calculateDependencyCounts(nodes, edges);

  // Step 2: Group by role
  const roleGroups = groupNodesByRole(nodes, dependencyCounts);

  // Step 3: Calculate percentiles per role and assign tiers
  roleGroups.forEach((nodesInRole) => {
    // Sort by count descending
    const sorted = [...nodesInRole].sort((a, b) => b.count - a.count);
    const counts = sorted.map(n => n.count);

    // Calculate thresholds
    const { p10Threshold, p35Threshold } = calculatePercentileThresholds(counts);

    // Assign tiers
    nodesInRole.forEach(({ nodeId, count }) => {
      const tier = assignScaleTier(count, p10Threshold, p35Threshold);
      nodeScales.set(nodeId, tier);
    });
  });

  return nodeScales;
}

/**
 * React hook for calculating node scales with memoization.
 * Recalculates only when nodes or edges change.
 */
export function useNodeScaling<T extends NodeWithRole>(
  nodes: T[],
  edges: Edge[]
): Map<string, ScaleTier> {
  return useMemo(() => calculateNodeScales(nodes, edges), [nodes, edges]);
}
