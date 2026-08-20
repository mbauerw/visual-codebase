import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import GraphFilterPanel, { type GraphFilterPanelProps } from '../GraphFilterPanel';
import { languageColors, roleColors } from '../../../types';

function renderPanel(overrides: Partial<GraphFilterPanelProps> = {}) {
  const props: GraphFilterPanelProps = {
    palette: 'dark',
    searchQuery: '',
    languageFilter: 'all',
    roleFilter: 'all',
    availableLanguages: ['typescript', 'python'],
    availableRoles: ['react_component', 'api_service'],
    visibleCount: 3,
    totalCount: 10,
    ...overrides,
  };
  return { ...render(<GraphFilterPanel {...props} />), props };
}

describe('GraphFilterPanel', () => {
  it('renders search, language / role chips and the "Showing N of M" line', () => {
    renderPanel();
    expect(screen.getByPlaceholderText('Search files...')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'All' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'typescript' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'python' })).toBeInTheDocument();
    // underscores in role names are shown as spaces
    expect(screen.getByRole('button', { name: 'react component' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'api service' })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 10 files')).toBeInTheDocument();
  });

  it('applies the per-language / per-role borderLeft colour', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'python' })).toHaveStyle({
      borderLeft: `2px solid ${languageColors.python}`,
    });
    expect(screen.getByRole('button', { name: 'api service' })).toHaveStyle({
      borderLeft: `2px solid ${roleColors.api_service}`,
    });
  });

  it('marks the active chips and uses the dark palette classes', () => {
    renderPanel({ palette: 'dark', languageFilter: 'python', roleFilter: 'api_service' });
    expect(screen.getByRole('button', { name: 'python' }).className).toContain('bg-blue-600');
    expect(screen.getByRole('button', { name: 'typescript' }).className).toContain('bg-slate-700');
    expect(screen.getByRole('button', { name: 'api service' }).className).toContain('bg-blue-600');
    expect(screen.getByText('Showing 3 of 10 files').className).toContain('text-slate-500');
    expect(screen.getByPlaceholderText('Search files...').className).toContain('bg-slate-900');
  });

  it('uses the amber palette classes', () => {
    renderPanel({ palette: 'amber', languageFilter: 'typescript' });
    expect(screen.getByRole('button', { name: 'typescript' }).className).toContain('bg-amber-500');
    expect(screen.getByRole('button', { name: 'python' }).className).toContain('bg-amber-100');
    expect(screen.getByText('Showing 3 of 10 files').className).toContain('text-amber-700');
    expect(screen.getByPlaceholderText('Search files...').className).toContain('border-amber-300');
  });

  it('forwards changes to the callbacks', () => {
    const onSearchChange = vi.fn();
    const onLanguageFilterChange = vi.fn();
    const onRoleFilterChange = vi.fn();
    renderPanel({ onSearchChange, onLanguageFilterChange, onRoleFilterChange });

    fireEvent.change(screen.getByPlaceholderText('Search files...'), { target: { value: 'app' } });
    expect(onSearchChange).toHaveBeenCalledWith('app');

    fireEvent.click(screen.getByRole('button', { name: 'python' }));
    expect(onLanguageFilterChange).toHaveBeenCalledWith('python');
    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[0]);
    expect(onLanguageFilterChange).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByRole('button', { name: 'api service' }));
    expect(onRoleFilterChange).toHaveBeenCalledWith('api_service');
    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[1]);
    expect(onRoleFilterChange).toHaveBeenCalledWith('all');
  });

  it('does not throw when callbacks are omitted', () => {
    renderPanel();
    expect(() => {
      fireEvent.change(screen.getByPlaceholderText('Search files...'), { target: { value: 'x' } });
      fireEvent.click(screen.getByRole('button', { name: 'python' }));
      fireEvent.click(screen.getByRole('button', { name: 'api service' }));
    }).not.toThrow();
  });
});
