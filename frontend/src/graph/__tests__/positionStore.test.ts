import { describe, expect, it, vi } from 'vitest';
import { createPositionStore, isZeroDelta, ZERO_OFFSET } from '../core/positionStore';

describe('positionStore', () => {
  it('starts empty; get() is undefined and getAll() is empty', () => {
    const s = createPositionStore();
    expect(s.get('a')).toBeUndefined();
    expect(s.getAll().size).toBe(0);
    expect(s.getVersion()).toBe(0);
  });

  it('set stores a copy that is stable until the id changes again', () => {
    const s = createPositionStore();
    const input = { dx: 10, dy: -5 };
    s.set('a', input);
    const first = s.get('a')!;
    expect(first).toEqual({ dx: 10, dy: -5 });
    expect(first).not.toBe(input); // copied
    input.dx = 999;
    expect(s.get('a')).toBe(first); // unaffected by caller mutation, same object
    // same value again → no change, same object, no version bump
    const v = s.getVersion();
    s.set('a', { dx: 10, dy: -5 });
    expect(s.get('a')).toBe(first);
    expect(s.getVersion()).toBe(v);
    // different value → new object
    s.set('a', { dx: 11, dy: -5 });
    expect(s.get('a')).not.toBe(first);
    expect(s.get('a')).toEqual({ dx: 11, dy: -5 });
    expect(s.getVersion()).toBe(v + 1);
  });

  it('notifies per-id listeners and "*" listeners only for the ids that changed', () => {
    const s = createPositionStore();
    const a = vi.fn();
    const b = vi.fn();
    const all = vi.fn();
    s.subscribe('a', a);
    s.subscribe('b', b);
    s.subscribe('*', all);
    s.set('a', { dx: 1, dy: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);
    // no-op write → nobody notified
    s.set('a', { dx: 1, dy: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(1);
  });

  it('setMany notifies each touched id once and "*" once', () => {
    const s = createPositionStore();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const all = vi.fn();
    s.subscribe('a', a);
    s.subscribe('b', b);
    s.subscribe('c', c);
    s.subscribe('*', all);
    s.set('c', { dx: 5, dy: 5 });
    all.mockClear();
    c.mockClear();
    s.setMany([
      ['a', { dx: 1, dy: 2 }],
      ['b', { dx: 3, dy: 4 }],
      ['c', { dx: 5, dy: 5 }], // unchanged
    ]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);
    expect(s.getAll().size).toBe(3);
    expect(s.get('b')).toEqual({ dx: 3, dy: 4 });
    // all-unchanged batch → silent
    all.mockClear();
    s.setMany([['a', { dx: 1, dy: 2 }]]);
    expect(all).not.toHaveBeenCalled();
  });

  it('clear drops everything and notifies the ids that had values plus "*"', () => {
    const s = createPositionStore();
    const a = vi.fn();
    const z = vi.fn();
    const all = vi.fn();
    s.subscribe('a', a);
    s.subscribe('z', z);
    s.subscribe('*', all);
    s.set('a', { dx: 1, dy: 1 });
    a.mockClear();
    all.mockClear();
    s.clear();
    expect(s.get('a')).toBeUndefined();
    expect(s.getAll().size).toBe(0);
    expect(a).toHaveBeenCalledTimes(1);
    expect(z).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);
    // clearing an empty store is silent
    all.mockClear();
    s.clear();
    expect(all).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications and is idempotent', () => {
    const s = createPositionStore();
    const a = vi.fn();
    const unsub = s.subscribe('a', a);
    unsub();
    unsub();
    s.set('a', { dx: 1, dy: 1 });
    expect(a).not.toHaveBeenCalled();
  });

  it('a listener may unsubscribe itself during notification', () => {
    const s = createPositionStore();
    const calls: string[] = [];
    const un1 = s.subscribe('a', () => {
      calls.push('1');
      un1();
    });
    s.subscribe('a', () => calls.push('2'));
    s.set('a', { dx: 1, dy: 0 });
    s.set('a', { dx: 2, dy: 0 });
    expect(calls).toEqual(['1', '2', '2']);
  });

  it('isZeroDelta / ZERO_OFFSET', () => {
    expect(isZeroDelta(undefined)).toBe(true);
    expect(isZeroDelta(ZERO_OFFSET)).toBe(true);
    expect(isZeroDelta({ dx: 0, dy: 1 })).toBe(false);
    expect(Object.isFrozen(ZERO_OFFSET)).toBe(true);
  });
});
