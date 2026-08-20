import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarkerDefs, markerId } from '../edges/markers';

describe('markerId', () => {
  it('prefixes and appends the size', () => {
    expect(markerId('red', 20)).toBe('gm-arrow-red-20');
  });

  it('sanitises characters that are invalid in ids / url() references', () => {
    expect(markerId('#475569', 20)).toBe('gm-arrow-_475569-20');
    expect(markerId('rgb(71, 85, 105)', 16)).toBe('gm-arrow-rgb_71__85__105_-16');
    expect(markerId('rgb(0 0 0 / 50%)', 8)).toBe('gm-arrow-rgb_0_0_0___50__-8');
    expect(markerId('hsl(210deg 40% 50.5%)', 8)).not.toMatch(/[#\s,()/.%]/);
  });

  it('is a valid id (no whitespace or CSS-special characters)', () => {
    for (const c of ['#fff', 'rgba(1,2,3,0.4)', 'var(--x)', 'a b']) {
      expect(markerId(c, 10)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('MarkerDefs', () => {
  it('renders one marker per entry with the expected attributes', () => {
    const { container } = render(
      <svg>
        <MarkerDefs entries={[{ color: '#475569', size: 20 }, { color: '#3b82f6', size: 24 }]} />
      </svg>,
    );
    const markers = container.querySelectorAll('marker');
    expect(markers).toHaveLength(2);
    const m = markers[0];
    expect(m.getAttribute('id')).toBe('gm-arrow-_475569-20');
    expect(m.getAttribute('markerWidth')).toBe('20');
    expect(m.getAttribute('markerHeight')).toBe('20');
    expect(m.getAttribute('viewBox')).toBe('-10 -10 20 20');
    expect(m.getAttribute('markerUnits')).toBe('userSpaceOnUse');
    expect(m.getAttribute('orient')).toBe('auto-start-reverse');
    expect(m.getAttribute('refX')).toBe('0');
    expect(m.getAttribute('refY')).toBe('0');
    const poly = m.querySelector('polyline')!;
    expect(poly.getAttribute('points')).toBe('-5,-4 0,0 -5,4 -5,-4');
    expect(poly.getAttribute('fill')).toBe('#475569');
    expect(poly.getAttribute('stroke')).toBe('#475569');
    expect(poly.getAttribute('stroke-width')).toBe('1');
    expect(poly.getAttribute('stroke-linecap')).toBe('round');
    expect(poly.getAttribute('stroke-linejoin')).toBe('round');
    expect(markers[1].getAttribute('id')).toBe('gm-arrow-_3b82f6-24');
  });

  it('dedupes entries with the same colour and size', () => {
    const { container } = render(
      <svg>
        <MarkerDefs
          entries={[
            { color: '#475569', size: 20 },
            { color: '#475569', size: 20 },
            { color: '#475569', size: 16 },
            { color: '#475569', size: 20 },
          ]}
        />
      </svg>,
    );
    expect(container.querySelectorAll('marker')).toHaveLength(2);
  });

  it('renders an empty defs for no entries', () => {
    const { container } = render(
      <svg>
        <MarkerDefs entries={[]} />
      </svg>,
    );
    expect(container.querySelector('defs')).not.toBeNull();
    expect(container.querySelectorAll('marker')).toHaveLength(0);
  });
});
