import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import RundownSection from '../RundownSection';
import { mockRundown } from './fixtures';

// Mock useRundown hook
const mockTriggerGeneration = vi.fn();
const mockUseRundown = vi.fn();
vi.mock('../../../hooks/useRundown', () => ({
  useRundown: (...args: unknown[]) => mockUseRundown(...args),
}));

// Mock Rundown component to avoid rendering the full tabbed UI
vi.mock('../Rundown', () => ({
  default: ({
    rundown,
    onFileClick,
    onLayerClick,
  }: {
    rundown: unknown;
    onFileClick?: (f: string) => void;
    onLayerClick?: (r: string[]) => void;
  }) => (
    <div data-testid="rundown-component">
      <span>Rundown rendered</span>
      {onFileClick && (
        <button onClick={() => onFileClick('test.ts')}>file-click</button>
      )}
      {onLayerClick && (
        <button onClick={() => onLayerClick(['role'])}>layer-click</button>
      )}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RundownSection', () => {
  it('should return null when fileCount is less than 5', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'not_started',
      triggerGeneration: mockTriggerGeneration,
    });

    const { container } = render(
      <RundownSection analysisId="abc" fileCount={3} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render CTA when status is not_started', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'not_started',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId="abc" fileCount={10} />);
    expect(screen.getByText('The Rundown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Rundown' })).toBeInTheDocument();
  });

  it('should call triggerGeneration when Generate Rundown is clicked', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'not_started',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId="abc" fileCount={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Rundown' }));
    expect(mockTriggerGeneration).toHaveBeenCalled();
  });

  it('should disable Generate Rundown button when analysisId is null', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'not_started',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId={null} fileCount={10} />);
    expect(screen.getByRole('button', { name: 'Generate Rundown' })).toBeDisabled();
  });

  it('should render generating state with spinner', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'generating',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId="abc" fileCount={10} />);
    expect(screen.getByText('Generating your rundown...')).toBeInTheDocument();
  });

  it('should render failed state with retry button', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'failed',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId="abc" fileCount={10} />);
    expect(screen.getByText(/Rundown generation failed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockTriggerGeneration).toHaveBeenCalled();
  });

  it('should render Rundown component when status is completed', () => {
    mockUseRundown.mockReturnValue({
      rundown: mockRundown,
      status: 'completed',
      triggerGeneration: mockTriggerGeneration,
    });

    render(<RundownSection analysisId="abc" fileCount={10} />);
    expect(screen.getByTestId('rundown-component')).toBeInTheDocument();
  });

  it('should return null when completed but rundown is null', () => {
    mockUseRundown.mockReturnValue({
      rundown: null,
      status: 'completed',
      triggerGeneration: mockTriggerGeneration,
    });

    const { container } = render(
      <RundownSection analysisId="abc" fileCount={10} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should pass analysisId and existingRundown to useRundown', () => {
    mockUseRundown.mockReturnValue({
      rundown: mockRundown,
      status: 'completed',
      triggerGeneration: mockTriggerGeneration,
    });

    render(
      <RundownSection
        analysisId="abc"
        existingRundown={mockRundown}
        fileCount={10}
      />
    );
    expect(mockUseRundown).toHaveBeenCalledWith('abc', mockRundown);
  });

  it('should pass onFileClick and onLayerClick to Rundown', () => {
    const onFileClick = vi.fn();
    const onLayerClick = vi.fn();
    mockUseRundown.mockReturnValue({
      rundown: mockRundown,
      status: 'completed',
      triggerGeneration: mockTriggerGeneration,
    });

    render(
      <RundownSection
        analysisId="abc"
        fileCount={10}
        onFileClick={onFileClick}
        onLayerClick={onLayerClick}
      />
    );

    fireEvent.click(screen.getByText('file-click'));
    expect(onFileClick).toHaveBeenCalledWith('test.ts');

    fireEvent.click(screen.getByText('layer-click'));
    expect(onLayerClick).toHaveBeenCalledWith(['role']);
  });
});
