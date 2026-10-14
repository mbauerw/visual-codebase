import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FeatureSwitcher, { DEFAULT_FEATURE, FEATURES, isFeatureKey, stepFeature } from '../FeatureSwitcher';

describe('FeatureSwitcher', () => {
  it('defines the four features in order with Overview as the default', () => {
    expect(FEATURES.map((f) => f.label)).toEqual(['Overview', 'Visualization', 'Rundown', 'Files + Code']);
    expect(DEFAULT_FEATURE).toBe('overview');
    expect(isFeatureKey('files')).toBe(true);
    expect(isFeatureKey('nope')).toBe(false);
  });

  it('stepFeature wraps at both ends', () => {
    expect(stepFeature('overview', 1)).toBe('visualization');
    expect(stepFeature('files', 1)).toBe('overview');
    expect(stepFeature('overview', -1)).toBe('files');
    expect(stepFeature('rundown', -1)).toBe('visualization');
  });

  it('shows the current feature and the arrows cycle it', () => {
    const onChange = vi.fn();
    render(<FeatureSwitcher active="overview" onChange={onChange} />);
    expect(screen.getByTestId('feature-current')).toHaveTextContent('Overview');
    fireEvent.click(screen.getByTestId('feature-next'));
    expect(onChange).toHaveBeenLastCalledWith('visualization');
    fireEvent.click(screen.getByTestId('feature-prev'));
    expect(onChange).toHaveBeenLastCalledWith('files');
    expect(screen.getByTestId('feature-switcher')).toHaveAttribute('data-open', 'false');
  });

  it('clicking the centre opens the dropdown; picking an option selects and closes', () => {
    const onChange = vi.fn();
    render(<FeatureSwitcher active="overview" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('feature-current'));
    expect(screen.getByTestId('feature-switcher')).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByTestId('feature-option-overview')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('feature-option-rundown'));
    expect(onChange).toHaveBeenCalledWith('rundown');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('picking the active option just closes; Escape closes', () => {
    const onChange = vi.fn();
    render(<FeatureSwitcher active="files" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('feature-current'));
    fireEvent.click(screen.getByTestId('feature-option-files'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByTestId('feature-current'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
