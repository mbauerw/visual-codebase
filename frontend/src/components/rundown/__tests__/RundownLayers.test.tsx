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

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Presentation Layer');
    expect(items[1]).toHaveTextContent('Business Logic');
    expect(items[2]).toHaveTextContent('Data Access');
  });

  it('should render the heading', () => {
    render(<RundownLayers layers={mockRundown.layers} />);
    expect(screen.getByText('Architecture Layers')).toBeInTheDocument();
  });

  it('should call onLayerClick with roles when layer is clicked', () => {
    const onLayerClick = vi.fn();
    render(<RundownLayers layers={mockRundown.layers} onLayerClick={onLayerClick} />);

    fireEvent.click(screen.getByText('Presentation Layer'));
    expect(onLayerClick).toHaveBeenCalledWith(['react_component', 'hook']);
  });

  it('should call onFileClick when key file is clicked', () => {
    const onFileClick = vi.fn();
    render(<RundownLayers layers={mockRundown.layers} onFileClick={onFileClick} />);

    fireEvent.click(screen.getByText('src/App.tsx'));
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
  });

  it('should not call onLayerClick when file is clicked (stopPropagation)', () => {
    const onLayerClick = vi.fn();
    const onFileClick = vi.fn();
    render(
      <RundownLayers
        layers={mockRundown.layers}
        onLayerClick={onLayerClick}
        onFileClick={onFileClick}
      />
    );

    fireEvent.click(screen.getByText('src/App.tsx'));
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
    expect(onLayerClick).not.toHaveBeenCalled();
  });

  it('should show "Click to filter" hint when onLayerClick is provided', () => {
    const onLayerClick = vi.fn();
    render(<RundownLayers layers={mockRundown.layers} onLayerClick={onLayerClick} />);

    expect(screen.getAllByText('Click to filter')).toHaveLength(3);
  });

  it('should not show "Click to filter" hint when onLayerClick is not provided', () => {
    render(<RundownLayers layers={mockRundown.layers} />);

    expect(screen.queryByText('Click to filter')).not.toBeInTheDocument();
  });
});
