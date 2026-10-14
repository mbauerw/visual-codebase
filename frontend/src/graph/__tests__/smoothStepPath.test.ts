import { describe, expect, it } from 'vitest';
import { getSmoothStepPath, type SmoothStepParams } from '../edges/smoothStepPath';

type Snap = [string, number, number, number, number];

interface Case {
  name: string;
  params: SmoothStepParams;
  /** Recorded from @xyflow/react 12 so the test survives its removal. */
  expected: Snap;
}

const CASES: Case[] = [
  {
    name: 'bottom→top, target below-right',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'bottom', targetX: 300, targetY: 300, targetPosition: 'top' },
    expected: ['M100 100L100 120L 100,195Q 100,200 105,200L 295,200Q 300,200 300,205L300 280L300 300', 200, 200, 100, 100],
  },
  {
    name: 'top→bottom, target above-left',
    params: { sourceX: 300, sourceY: 300, sourcePosition: 'top', targetX: 100, targetY: 100, targetPosition: 'bottom' },
    expected: ['M300 300L300 280L 300,205Q 300,200 295,200L 105,200Q 100,200 100,195L100 120L100 100', 200, 200, 100, 100],
  },
  {
    name: 'left→right, target to the left',
    params: { sourceX: 400, sourceY: 100, sourcePosition: 'left', targetX: 100, targetY: 200, targetPosition: 'right' },
    expected: ['M400 100L380 100L 255,100Q 250,100 250,105L 250,195Q 250,200 245,200L120 200L100 200', 250, 150, 150, 50],
  },
  {
    name: 'right→left, target to the right',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'right', targetX: 400, targetY: 250, targetPosition: 'left' },
    expected: ['M100 100L120 100L 245,100Q 250,100 250,105L 250,245Q 250,250 255,250L380 250L400 250', 250, 175, 150, 75],
  },
  {
    name: 'bottom→top, source below target (backwards)',
    params: { sourceX: 100, sourceY: 400, sourcePosition: 'bottom', targetX: 300, targetY: 100, targetPosition: 'top' },
    expected: ['M100 400L 100,415Q 100,420 105,420L 195,420Q 200,420 200,415L 200,85Q 200,80 205,80L 295,80Q 300,80 300,85L300 100', 200, 250, 100, 150],
  },
  {
    name: 'top→bottom, source above target (backwards)',
    params: { sourceX: 300, sourceY: 100, sourcePosition: 'top', targetX: 100, targetY: 400, targetPosition: 'bottom' },
    expected: ['M300 100L 300,85Q 300,80 295,80L 205,80Q 200,80 200,85L 200,415Q 200,420 195,420L 105,420Q 100,420 100,415L100 400', 200, 250, 100, 150],
  },
  {
    name: 'overlapping points',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'bottom', targetX: 100, targetY: 100, targetPosition: 'top' },
    expected: ['M100 100L100 120L100 120L100 80L100 80L100 100', 100, 100, 0, 0],
  },
  {
    name: 'tiny distance',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'bottom', targetX: 102, targetY: 103, targetPosition: 'top' },
    expected: ['M100 100L 100,119.5Q 100,120 100.5,120L 100.5,120Q 101,120 101,119.5L 101,83.5Q 101,83 101.5,83L 101.5,83Q 102,83 102,83.5L102 103', 101, 101.5, 1, 1.5],
  },
  {
    name: 'vertically aligned bottom→top',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'bottom', targetX: 100, targetY: 300, targetPosition: 'top' },
    expected: ['M100 100L100 120L100 200L100 200L100 280L100 300', 100, 200, 0, 100],
  },
  {
    name: 'custom borderRadius and offset',
    params: { sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 200, targetY: 120, targetPosition: 'top', borderRadius: 12, offset: 40 },
    expected: ['M0 0L0 40L 0,50Q 0,60 10,60L 190,60Q 200,60 200,70L200 80L200 120', 100, 60, 100, 60],
  },
  {
    name: 'same side right→right (close)',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'right', targetX: 110, targetY: 200, targetPosition: 'right' },
    expected: ['M100 100L110 100L 125,100Q 130,100 130,105L 130,195Q 130,200 125,200L110 200', 130, 150, 5, 50],
  },
  {
    name: 'mixed right→bottom',
    params: { sourceX: 100, sourceY: 100, sourcePosition: 'right', targetX: 300, targetY: 50, targetPosition: 'bottom' },
    expected: ['M100 100L120 100L 295,100Q 300,100 300,95L300 70L300 50', 210, 100, 100, 25],
  },
  {
    name: 'defaults (no positions), fractional coords',
    params: { sourceX: 12.5, sourceY: 33.25, targetX: 87.75, targetY: 140.5 },
    expected: ['M12.5 33.25L12.5 53.25L 12.5,81.875Q 12.5,86.875 17.5,86.875L 82.75,86.875Q 87.75,86.875 87.75,91.875L87.75 120.5L87.75 140.5', 50.125, 86.875, 37.625, 53.625],
  },
  {
    name: 'explicit centerX/centerY',
    params: { sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 200, targetY: 200, targetPosition: 'top', centerX: 50, centerY: 150 },
    expected: ['M0 0L0 20L 0,145Q 0,150 5,150L 195,150Q 200,150 200,155L200 180L200 200', 50, 150, 100, 100],
  },
];

describe('getSmoothStepPath (recorded snapshots)', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(getSmoothStepPath(c.params)).toEqual(c.expected);
    });
  }

  it('applies default positions bottom→top, borderRadius 5, offset 20', () => {
    const withDefaults = getSmoothStepPath({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 100 });
    const explicit = getSmoothStepPath({
      sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 100, targetY: 100, targetPosition: 'top', borderRadius: 5, offset: 20,
    });
    expect(withDefaults).toEqual(explicit);
  });
});
