/**
 * Hex — an outlined hexagon built from two clip-path'd layers (clip-path
 * has no border, so the outline is a larger hex behind an inset fill).
 */

import type { CSSProperties, ReactNode } from 'react';
import { HEX_FLAT, HEX_POINTY } from './theme';

export interface HexProps {
  orientation?: 'flat' | 'pointy';
  outline: string;
  fill: string;
  /** Outline thickness in world px. */
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  fillStyle?: CSSProperties;
  children?: ReactNode;
  'data-testid'?: string;
}

export function Hex({ orientation = 'flat', outline, fill, stroke = 3, className = '', style, fillStyle, children, ...rest }: HexProps) {
  const clip = orientation === 'flat' ? HEX_FLAT : HEX_POINTY;
  return (
    <div data-testid={rest['data-testid']} className={className} style={{ position: 'relative', clipPath: clip, background: outline, ...style }}>
      <div
        className="absolute flex items-center justify-center"
        style={{ inset: stroke, clipPath: clip, background: fill, ...fillStyle }}
      >
        {children}
      </div>
    </div>
  );
}
