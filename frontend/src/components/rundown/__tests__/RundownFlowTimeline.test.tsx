import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import RundownFlowTimeline from '../RundownFlowTimeline';
import { mockRundown } from './fixtures';

describe('RundownFlowTimeline', () => {
  const flow = mockRundown.flows[0];
  const layers = mockRundown.layers;

  it('should render all steps', () => {
    render(<RundownFlowTimeline flow={flow} layers={layers} />);
    expect(screen.getByText('Renders login form and captures credentials')).toBeInTheDocument();
    expect(screen.getByText('Validates credentials and manages session state')).toBeInTheDocument();
    expect(screen.getByText('Calls authentication API')).toBeInTheDocument();
  });

  it('should resolve layer labels from layer_id', () => {
    render(<RundownFlowTimeline flow={flow} layers={layers} />);
    expect(screen.getByText('Presentation Layer')).toBeInTheDocument();
    expect(screen.getByText('Business Logic')).toBeInTheDocument();
    expect(screen.getByText('Data Access')).toBeInTheDocument();
  });

  it('should render flow description', () => {
    render(<RundownFlowTimeline flow={flow} layers={layers} />);
    expect(screen.getByText('Handles user login and session management')).toBeInTheDocument();
  });

  it('should render key files as clickable buttons', () => {
    render(<RundownFlowTimeline flow={flow} layers={layers} />);
    const fileButtons = screen.getAllByText('src/App.tsx');
    expect(fileButtons.length).toBeGreaterThan(0);
  });

  it('should call onFileClick when file is clicked', () => {
    const onFileClick = vi.fn();
    render(<RundownFlowTimeline flow={flow} layers={layers} onFileClick={onFileClick} />);

    const fileButton = screen.getAllByText('src/App.tsx')[0];
    fireEvent.click(fileButton);
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
  });

  it('should handle missing layer_id gracefully', () => {
    const flowWithBadLayer = {
      ...flow,
      steps: [{ layer_id: 'nonexistent', action: 'Test action', key_files: [] }],
    };
    render(<RundownFlowTimeline flow={flowWithBadLayer} layers={layers} />);
    // Should fall back to showing the layer_id itself
    expect(screen.getByText('nonexistent')).toBeInTheDocument();
  });

  it('should handle single step flow', () => {
    const singleStepFlow = {
      ...flow,
      steps: [flow.steps[0]],
    };
    render(<RundownFlowTimeline flow={singleStepFlow} layers={layers} />);
    expect(screen.getByText('Renders login form and captures credentials')).toBeInTheDocument();
  });
});
