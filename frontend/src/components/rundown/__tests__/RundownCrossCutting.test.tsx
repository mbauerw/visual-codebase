import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import RundownCrossCutting from '../RundownCrossCutting';
import { mockRundown } from './fixtures';

describe('RundownCrossCutting', () => {
  const crossCutting = mockRundown.cross_cutting;

  it('should render all concern cards', () => {
    render(<RundownCrossCutting crossCutting={crossCutting} />);
    expect(screen.getByText('Error Handling')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('should render descriptions', () => {
    render(<RundownCrossCutting crossCutting={crossCutting} />);
    expect(
      screen.getByText('Centralized error handling and user notifications')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Application configuration and environment settings')
    ).toBeInTheDocument();
  });

  it('should render files', () => {
    render(<RundownCrossCutting crossCutting={crossCutting} />);
    expect(screen.getByText('src/utils/errors.ts')).toBeInTheDocument();
    expect(screen.getByText('src/config/supabase.ts')).toBeInTheDocument();
  });

  it('should call onFileClick when file is clicked', () => {
    const onFileClick = vi.fn();
    render(<RundownCrossCutting crossCutting={crossCutting} onFileClick={onFileClick} />);

    fireEvent.click(screen.getByText('src/utils/errors.ts'));
    expect(onFileClick).toHaveBeenCalledWith('src/utils/errors.ts');
  });

});
