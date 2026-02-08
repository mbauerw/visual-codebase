import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import RundownSection from '../RundownSection';
import { mockRundown, mockEmptyRundown } from './fixtures';

// Mock the flow diagram since ReactFlow requires DOM measurements
vi.mock('../RundownFlowDiagram', () => ({
  default: ({ flow }: { flow: { name: string } }) => (
    <div data-testid="flow-diagram-mock">{flow.name} diagram</div>
  ),
}));

describe('RundownSection', () => {
  it('should render all sub-sections when data is present', () => {
    render(<RundownSection rundown={mockRundown} />);

    // Narrative
    expect(screen.getByText('How This Codebase Works')).toBeInTheDocument();

    // Layers
    expect(screen.getByText('Architecture Layers')).toBeInTheDocument();
    // "Presentation Layer" appears in both layers section and flow timeline
    expect(screen.getAllByText('Presentation Layer').length).toBeGreaterThanOrEqual(1);

    // Flows
    expect(screen.getByText('Application Flows')).toBeInTheDocument();

    // Cross-cutting
    expect(screen.getByText('Cross-Cutting Concerns')).toBeInTheDocument();
  });

  it('should hide sections when data is empty', () => {
    render(<RundownSection rundown={mockEmptyRundown} />);

    expect(screen.queryByText('How This Codebase Works')).not.toBeInTheDocument();
    expect(screen.queryByText('Architecture Layers')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Flows')).not.toBeInTheDocument();
    expect(screen.queryByText('Cross-Cutting Concerns')).not.toBeInTheDocument();
  });

  it('should show flow tab buttons when multiple flows exist', () => {
    render(<RundownSection rundown={mockRundown} />);

    // mockRundown has 2 flows - check for tab roles
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('User Authentication');
    expect(tabs[1]).toHaveTextContent('Data Fetching');
  });

  it('should switch flows when tab is clicked', () => {
    render(<RundownSection rundown={mockRundown} />);

    // Initially shows first flow's content
    expect(screen.getByText('Renders login form and captures credentials')).toBeInTheDocument();

    // Click second flow tab
    fireEvent.click(screen.getByRole('tab', { name: 'Data Fetching' }));

    // Should show second flow's content
    expect(screen.getByText('Triggers data fetch on component mount')).toBeInTheDocument();
  });

  it('should not show tab buttons when only one flow', () => {
    const singleFlowRundown = {
      ...mockRundown,
      flows: [mockRundown.flows[0]],
    };
    render(<RundownSection rundown={singleFlowRundown} />);

    // Should not have tablist
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('should pass onFileClick to sub-components', () => {
    const onFileClick = vi.fn();
    render(<RundownSection rundown={mockRundown} onFileClick={onFileClick} />);

    // Click a file button in the cross-cutting section (these are always buttons)
    const errorFile = screen.getByText('src/utils/errors.ts');
    fireEvent.click(errorFile);
    expect(onFileClick).toHaveBeenCalledWith('src/utils/errors.ts');
  });

  it('should have proper aria label', () => {
    render(<RundownSection rundown={mockRundown} />);
    expect(
      screen.getByLabelText('The Rundown - Application Flow Analysis')
    ).toBeInTheDocument();
  });

  it('should render both diagram (desktop) and timeline (mobile) views', () => {
    render(<RundownSection rundown={mockRundown} />);

    // Desktop diagram (mocked)
    expect(screen.getByTestId('flow-diagram-mock')).toBeInTheDocument();

    // Mobile timeline still present in DOM (CSS handles visibility)
    expect(screen.getByText('Renders login form and captures credentials')).toBeInTheDocument();
  });

  it('should pass onLayerClick to layers component', () => {
    const onLayerClick = vi.fn();
    render(<RundownSection rundown={mockRundown} onLayerClick={onLayerClick} />);

    // Click on first layer card (use role=button to target layer li, not timeline label)
    const layerButtons = screen.getAllByRole('button', { name: /Layer 1 of 3/ });
    fireEvent.click(layerButtons[0]);
    expect(onLayerClick).toHaveBeenCalledWith(['react_component', 'hook']);
  });

  it('should pass onFileClick to layers key files', () => {
    const onFileClick = vi.fn();
    render(<RundownSection rundown={mockRundown} onFileClick={onFileClick} />);

    // Click a key file in the layers section
    const appFiles = screen.getAllByText('src/App.tsx');
    fireEvent.click(appFiles[0]);
    expect(onFileClick).toHaveBeenCalledWith('src/App.tsx');
  });
});
