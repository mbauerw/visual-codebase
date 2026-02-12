import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactFlowNode, ArchitecturalRole } from '../../types';
import { roleColors, roleLabels } from '../../types';
import { roleIconComponents } from '../../utils/roleIcons';

interface CategoryGroup {
  role: ArchitecturalRole;
  label: string;
  color: string;
  files: string[];
}

interface LayerCategoryCarouselProps {
  roles: string[];
  keyFiles: string[];
  graphNodes?: ReactFlowNode[];
  onFileClick?: (filePath: string) => void;
}

const MAX_VISIBLE_FILES = 8;

export default function LayerCategoryCarousel({
  roles,
  keyFiles,
  graphNodes,
  onFileClick,
}: LayerCategoryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const categories = useMemo<CategoryGroup[]>(() => {
    if (graphNodes && graphNodes.length > 0) {
      const groups: CategoryGroup[] = [];
      for (const role of roles) {
        const matching = graphNodes.filter(
          (n) => n.data.role === role
        );
        if (matching.length === 0) continue;
        groups.push({
          role: role as ArchitecturalRole,
          label: roleLabels[role as ArchitecturalRole] || role,
          color: roleColors[role as ArchitecturalRole] || '#64748b',
          files: matching.map((n) => n.data.path),
        });
      }
      // Sort by file count descending
      groups.sort((a, b) => b.files.length - a.files.length);
      if (groups.length > 0) return groups;
    }

    // Fallback: single group with all key_files
    if (keyFiles.length > 0) {
      return [{
        role: 'unknown' as ArchitecturalRole,
        label: 'All Files',
        color: '#64748b',
        files: keyFiles,
      }];
    }

    return [];
  }, [roles, keyFiles, graphNodes]);

  if (categories.length === 0) return null;

  const active = categories[activeIndex] ?? categories[0];
  const total = categories.length;
  const showNav = total > 1;

  const navigate = (dir: 1 | -1) => {
    setDirection(dir);
    setActiveIndex((prev) => (prev + dir + total) % total);
  };

  const Icon = roleIconComponents[active.role] ?? roleIconComponents.unknown;
  const visibleFiles = active.files.slice(0, MAX_VISIBLE_FILES);
  const remaining = active.files.length - MAX_VISIBLE_FILES;

  return (
    <div
      className="flex flex-col items-center"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Navigation row */}
      <div className="flex items-center gap-3 mb-5">
        {showNav && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            className="p-1.5 rounded-full transition-colors hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Previous category"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Category header pill */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border"
          style={{
            backgroundColor: `${active.color}08`,
            borderColor: `${active.color}40`,
          }}
        >
          <Icon size={16} style={{ color: active.color }} />
          <span
            className="text-sm font-semibold"
            style={{ color: active.color }}
          >
            {active.label}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${active.color}15`,
              color: active.color,
            }}
          >
            {active.files.length}
          </span>
        </div>

        {showNav && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(1); }}
            className="p-1.5 rounded-full transition-colors hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Next category"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Counter */}
      {showNav && (
        <p className="text-[11px] text-slate-400 mb-4 font-mono">
          {activeIndex + 1} of {total}
        </p>
      )}

      {/* Animated file list */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${active.role}-${activeIndex}`}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -30 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
            {visibleFiles.map((file) => {
              const parts = file.split('/');
              const basename = parts.pop() || file;
              const dir = parts.join('/');

              return (
                <button
                  key={file}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClick?.(file);
                  }}
                  className="group/file flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors hover:bg-slate-50 cursor-pointer"
                  title={file}
                >
                  <svg
                    className="h-3.5 w-3.5 flex-shrink-0 opacity-40 group-hover/file:opacity-70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ color: active.color }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-mono text-xs truncate">
                    <span className="text-slate-800 group-hover/file:text-indigo-600 group-hover/file:underline underline-offset-2 decoration-indigo-500/30">
                      {basename}
                    </span>
                    {dir && (
                      <span className="text-slate-400 ml-1">{dir}/</span>
                    )}
                  </span>
                </button>
              );
            })}

            {remaining > 0 && (
              <p className="text-center text-[11px] text-slate-400 pt-1 font-mono">
                and {remaining} more...
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
