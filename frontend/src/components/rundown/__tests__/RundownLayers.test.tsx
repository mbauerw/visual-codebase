import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import RundownLayers from '../RundownLayers';
import { mockRundown } from './fixtures';

describe('RundownLayers', () => {
  it('should render all layers', () => {
    render(<RundownLayers layers={mockRundown.layers} />);
    expect(screen.getByText('Presentation Layer')).toBeInTheDocument();
    expect(screen.getByText('Business Logic')).toBeInTheDocument();
    expect(screen.getByText('Data Access')).toBeInTheDocument();
  });

  it('should render layer descriptions', () => {
    render(<RundownLayers layers={mockRundown.layers} />);
    expect(screen.getByText('Handles UI rendering and user interaction')).toBeInTheDocument();
  });

  it('should render role pills', () => {
    render(<RundownLayers layers={mockRundown.layers} />);
    expect(screen.getByText('react_component')).toBeInTheDocument();
    expect(screen.getByText('hook')).toBeInTheDocument();
  });

  it('should render key files', () => {
    render(<RundownLayers layers={mockRundown.layers} />);
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
  });

  it('should render layers in order', () => {
    const reversedLayers = [...mockRundown.layers].reverse();
    render(<RundownLayers layers={reversedLayers} />);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Presentation Layer');
    expect(headings[1]).toHaveTextContent('Business Logic');
    expect(headings[2]).toHaveTextContent('Data Access');
  });

  it('should toggle expansion when layer card is clicked', () => {
    render(<RundownLayers layers={mockRundown.layers} />);

    const buttons = screen.getAllByRole('button').filter(el => el.hasAttribute('aria-expanded'));
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('should call onFileClick when key file is clicked', () => {
    const onFileClick = vi.fn();
    render(<RundownLayers layers={mockRundown.layers} onFileClick={onFileClick} />);

    fireEvent.click(screen.getByText('src/App.tsx'));
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
  });

  it('should not toggle expansion when file is clicked (stopPropagation)', () => {
    const onFileClick = vi.fn();
    render(
      <RundownLayers
        layers={mockRundown.layers}
        onFileClick={onFileClick}
      />
    );

    const cards = screen.getAllByRole('button').filter(el => el.hasAttribute('aria-expanded'));
    expect(cards[0]).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByText('src/App.tsx'));
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
    expect(cards[0]).toHaveAttribute('aria-expanded', 'false');
  });
});
