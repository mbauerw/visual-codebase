import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FeatureRail, { DEFAULT_FEATURE, FEATURES, FEATURE_RAIL_CLOSE_DELAY_MS, isFeatureKey } from '../FeatureRail';

describe('FeatureRail', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('defines the four features in order with Project Overview as the default', () => {
    expect(FEATURES.map((f) => f.label)).toEqual([
      'Project Overview',
      'Visualization',
      'The Rundown',
      'Files + Source Code',
    ]);
    expect(DEFAULT_FEATURE).toBe('overview');
    expect(isFeatureKey('files')).toBe(true);
    expect(isFeatureKey('nope')).toBe(false);
    expect(isFeatureKey(null)).toBe(false);
  });

  it('idle: only the active tab is shown; the others are folded and unfocusable', () => {
    render(<FeatureRail active="rundown" onChange={vi.fn()} />);
    expect(screen.getByTestId('feature-rail')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('feature-fold-rundown')).toHaveAttribute('data-shown', 'true');
    expect(screen.getByTestId('feature-tab-rundown')).toHaveAttribute('aria-current', 'page');
    for (const key of ['overview', 'visualization', 'files']) {
      expect(screen.getByTestId(`feature-fold-${key}`)).toHaveAttribute('data-shown', 'false');
      expect(screen.getByTestId(`feature-tab-${key}`)).toHaveAttribute('tabindex', '-1');
    }
    // the only row on screen is also the bottom row: flush, rounded with the rail
    expect(screen.getByTestId('feature-tab-rundown').className).toContain('rounded-br-2xl');
    expect(screen.getByTestId('feature-tab-rundown').className).not.toContain('mb-1');
  });

  it('hovering unfolds every tab; leaving folds them after the grace period', () => {
    render(<FeatureRail active="overview" onChange={vi.fn()} />);
    const rail = screen.getByTestId('feature-rail');
    fireEvent.mouseEnter(rail);
    expect(rail).toHaveAttribute('data-open', 'true');
    for (const f of FEATURES) expect(screen.getByTestId(`feature-fold-${f.key}`)).toHaveAttribute('data-shown', 'true');
    // open: the bottom row is Files + Source Code; the active top row loses the corner
    expect(screen.getByTestId('feature-tab-files').className).toContain('rounded-br-2xl');
    expect(screen.getByTestId('feature-tab-overview').className).not.toContain('rounded-br-2xl');

    fireEvent.mouseLeave(rail);
    expect(rail).toHaveAttribute('data-open', 'true'); // not yet
    act(() => vi.advanceTimersByTime(FEATURE_RAIL_CLOSE_DELAY_MS + 1));
    expect(rail).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('feature-fold-files')).toHaveAttribute('data-shown', 'false');
  });

  it('a quick leave-and-return keeps it open', () => {
    render(<FeatureRail active="overview" onChange={vi.fn()} />);
    const rail = screen.getByTestId('feature-rail');
    fireEvent.mouseEnter(rail);
    fireEvent.mouseLeave(rail);
    act(() => vi.advanceTimersByTime(FEATURE_RAIL_CLOSE_DELAY_MS / 2));
    fireEvent.mouseEnter(rail);
    act(() => vi.advanceTimersByTime(FEATURE_RAIL_CLOSE_DELAY_MS * 2));
    expect(rail).toHaveAttribute('data-open', 'true');
  });

  it('keyboard focus unfolds; focus leaving the rail folds it', () => {
    render(
      <div>
        <FeatureRail active="files" onChange={vi.fn()} />
        <button>after</button>
      </div>
    );
    const rail = screen.getByTestId('feature-rail');
    fireEvent.focus(screen.getByTestId('feature-tab-files'));
    expect(rail).toHaveAttribute('data-open', 'true');
    fireEvent.blur(screen.getByTestId('feature-tab-files'), { relatedTarget: screen.getByText('after') });
    expect(rail).toHaveAttribute('data-open', 'false');
  });

  it('clicking another tab calls onChange; a tap on the collapsed active tab only unfolds', () => {
    const onChange = vi.fn();
    render(<FeatureRail active="overview" onChange={onChange} />);
    const rail = screen.getByTestId('feature-rail');
    fireEvent.click(screen.getByTestId('feature-tab-overview'));
    expect(onChange).not.toHaveBeenCalled();
    expect(rail).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByTestId('feature-tab-visualization'));
    expect(onChange).toHaveBeenCalledWith('visualization');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
