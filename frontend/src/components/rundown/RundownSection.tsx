import { useRundown } from '../../hooks/useRundown';
import type { CodebaseRundown, ReactFlowNode } from '../../types';
import Rundown from './Rundown';

const CREAM_BG = '#faf8f3';
const TEXT_HEADING = '#1a1a1a';
const TEXT_BODY = '#333333';
const TEXT_MUTED = '#808080';
const ACCENT_TEAL = '#79deeb';

interface RundownSectionProps {
  analysisId: string | null;
  existingRundown?: CodebaseRundown | null;
  fileCount?: number;
  graphNodes?: ReactFlowNode[];
  onFileClick?: (filePath: string) => void;
  onLayerClick?: (roles: string[]) => void;
  validFilePaths?: string[];
}

function RundownCTA({ onGenerate, isDisabled }: { onGenerate: () => void; isDisabled: boolean }) {
  return (
    <section
      className="w-full py-16 px-5 sm:px-10 lg:px-16"
      style={{ backgroundColor: CREAM_BG }}
    >
      <div className="max-w-[1400px] mx-auto text-center">
        <h2
          className="font-bold leading-tight mb-4"
          style={{
            color: TEXT_HEADING,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            letterSpacing: '-0.02em',
          }}
        >
          The Rundown
        </h2>
        <p
          className="max-w-xl mx-auto mb-8"
          style={{ color: TEXT_BODY, fontSize: '1.05rem', lineHeight: 1.7 }}
        >
          Generate a comprehensive architectural breakdown of this codebase, including
          layer analysis, data flow diagrams, and cross-cutting concerns.
        </p>
        <button
          onClick={onGenerate}
          disabled={isDisabled}
          className="px-8 py-3 rounded-full text-base font-semibold transition-all cursor-pointer hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: ACCENT_TEAL,
            color: TEXT_HEADING,
            border: 'none',
          }}
        >
          Generate Rundown
        </button>
      </div>
    </section>
  );
}

function RundownGenerating() {
  return (
    <section
      className="w-full py-16 px-5 sm:px-10 lg:px-16"
      style={{ backgroundColor: CREAM_BG }}
    >
      <div className="max-w-[1400px] mx-auto text-center">
        <h2
          className="font-bold leading-tight mb-4"
          style={{
            color: TEXT_HEADING,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            letterSpacing: '-0.02em',
          }}
        >
          The Rundown
        </h2>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5"
              style={{ color: ACCENT_TEAL }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span style={{ color: TEXT_BODY, fontSize: '1.05rem' }}>
              Generating your rundown...
            </span>
          </div>
          <p style={{ color: TEXT_MUTED, fontSize: '0.9rem' }}>
            This typically takes 5-15 seconds.
          </p>
        </div>
      </div>
    </section>
  );
}

function RundownFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      className="w-full py-16 px-5 sm:px-10 lg:px-16"
      style={{ backgroundColor: CREAM_BG }}
    >
      <div className="max-w-[1400px] mx-auto text-center">
        <h2
          className="font-bold leading-tight mb-4"
          style={{
            color: TEXT_HEADING,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            letterSpacing: '-0.02em',
          }}
        >
          The Rundown
        </h2>
        <p
          className="max-w-xl mx-auto mb-6"
          style={{ color: TEXT_BODY, fontSize: '1.05rem', lineHeight: 1.7 }}
        >
          Rundown generation failed. This can happen if the analysis data is unavailable or the AI service timed out.
        </p>
        <button
          onClick={onRetry}
          className="px-8 py-3 rounded-full text-base font-semibold transition-all cursor-pointer hover:scale-105 active:scale-100"
          style={{
            backgroundColor: ACCENT_TEAL,
            color: TEXT_HEADING,
            border: 'none',
          }}
        >
          Retry
        </button>
      </div>
    </section>
  );
}

export default function RundownSection({
  analysisId,
  existingRundown,
  fileCount = 0,
  graphNodes,
  onFileClick,
  onLayerClick,
  validFilePaths = [],
}: RundownSectionProps) {
  const { rundown, status, triggerGeneration } = useRundown(
    analysisId,
    existingRundown,
  );

  // Hide the section entirely if the analysis has too few files
  if (fileCount < 5) return null;

  switch (status) {
    case 'completed':
      if (!rundown) return null;
      return (
        <Rundown
          rundown={rundown}
          graphNodes={graphNodes}
          onFileClick={onFileClick}
          onLayerClick={onLayerClick}
          validFilePaths={validFilePaths}
        />
      );

    case 'generating':
      return <RundownGenerating />;

    case 'failed':
      return <RundownFailed onRetry={triggerGeneration} />;

    case 'not_started':
    default:
      return (
        <RundownCTA
          onGenerate={triggerGeneration}
          isDisabled={!analysisId}
        />
      );
  }
}
