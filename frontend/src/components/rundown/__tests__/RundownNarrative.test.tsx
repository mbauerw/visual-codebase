import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import RundownNarrative from '../RundownNarrative';

describe('RundownNarrative', () => {
  it('should render the narrative text', () => {
    render(<RundownNarrative narrative="This is a test narrative about the codebase." />);
    expect(screen.getByText('This is a test narrative about the codebase.')).toBeInTheDocument();
  });

});
