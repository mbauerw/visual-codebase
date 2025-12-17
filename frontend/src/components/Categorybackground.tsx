import { memo } from 'react';
import { Monitor, Server } from 'lucide-react';
import { categoryColors } from '../types';

export interface CategorySection {
  id: string;
  label: string;
  category: 'frontend' | 'backend';
  x: number;
  y: number;
  width: number;
  height: number;
  nodeCount: number;
}

interface CategoryBackgroundProps {
  sections: CategorySection[];
  transform: { x: number; y: number; zoom: number };
}

function CategoryBackground({ sections, transform }: CategoryBackgroundProps) {
  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 50 }}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {sections.map((section) => {
          const baseColor = section.category === 'frontend' 
            ? categoryColors.frontend 
            : categoryColors.backend;
          const Icon = section.category === 'frontend' ? Monitor : Server;

          return (
            <div
              key={section.id}
              className="absolute"
              style={{
                left: section.x,
                top: section.y,
                width: section.width,
                height: section.height,
              }}
            >
              {/* Background container */}
              <div
                className="w-full h-full rounded-[35%]"
                style={{
                  backgroundColor: `${baseColor}06`,
                  border: `3px dashed ${baseColor}40`,
                  boxShadow: `0 0 80px 30px ${baseColor}15, inset 0 0 80px ${baseColor}08`,
                }}
              />
              
              {/* Header label */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-6 flex items-center gap-2 rounded-full px-6 py-2.5"
                style={{
                  backgroundColor: '#0f172a',
                  border: `2px solid ${baseColor}`,
                  boxShadow: `0 0 20px ${baseColor}30`,
                }}
              >
                <Icon size={20} color={baseColor} />
                <span
                  className="font-semibold text-5xl"
                  style={{ color: baseColor }}
                >
                  {section.label}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full ml-1 text-sm"
                  style={{
                    backgroundColor: `${baseColor}25`,
                    color: baseColor,
                  }}
                >
                  {section.nodeCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(CategoryBackground);