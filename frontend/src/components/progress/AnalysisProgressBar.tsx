import { Loader2 } from 'lucide-react';
import { useProgressAnimation } from '../../hooks/useProgressAnimation';
import type { AnalysisStatus } from '../../types';

const STAGES = ['pending', 'cloning', 'parsing', 'analyzing', 'analyzing_functions', 'building_graph', 'generating_summary'] as const;

// Map status to stage index for comparison
const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  pending: -1,
  cloning: 0,
  parsing: 1,
  analyzing: 2,
  analyzing_functions: 3,
  building_graph: 4,
  generating_summary: 5,
  completed: 6,
  failed: -2,
};

interface AnalysisProgressBarProps {
  status: AnalysisStatus | null;
  currentStep: string;
  totalFiles: number;
  isGitHub: boolean;
}

export function AnalysisProgressBar({
  status,
  currentStep,
  totalFiles,
  isGitHub,
}: AnalysisProgressBarProps) {
  const { progress } = useProgressAnimation(status, { isGitHub });

  const currentStageIndex = status ? STATUS_TO_STAGE_INDEX[status] ?? -1 : -1;

  // useEffect(() => {
  //   setTimeout(() => {
  //     if (status === 'pending' ) {
  //       setFakeProgress((prev) => (prev + 1));
  //     }
  //   }, 1000);

  // },[status]);

  // Filter stages based on analysis type
  // Hide pending/cloning based on type, and hide analyzing_functions to keep UI clean
  const visibleStages = isGitHub
    ? STAGES.filter(s => s !== 'pending' && s !== 'analyzing_functions')
    : STAGES.filter(s => s !== 'cloning' && s !== 'analyzing_functions');

  return (
    <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-100">
      {/* Header with spinner and status text */}
      <div className="flex items-center gap-4 mb-4">
        <Loader2 size={24} className="animate-spin text-[#8FBCFA]" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">
            {currentStep || 'Starting Analysis...'}
          </p>
          {totalFiles > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {totalFiles} files found
            </p>
          )}
        </div>
        <span className="text-sm font-medium text-gray-500">
         {Math.round(progress)}%
        </span>
      </div>

      {/* Animated progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-4">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-[#8FBCFA] to-[#FF9A9D]"
          style={{
            width: `${Math.round(progress)}%`,
            transition: 'width 150ms ease-out',
            minWidth: progress > 0 ? '8px' : '0px',
          }}
        /> 
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {visibleStages.map((stage, index) => {
          // Get the actual stage index in the full STAGES array for comparison
          const stageIndexInFull = STAGES.indexOf(stage);
          const isComplete = currentStageIndex > stageIndexInFull;
          const isCurrent = status === stage;

          return (
            <div key={stage} className="flex items-center flex-1">
              {/* Stage dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isComplete
                      ? 'bg-green-500'
                      : isCurrent
                      ? 'bg-[#8FBCFA] ring-4 ring-[#8FBCFA]/20'
                      : 'bg-gray-300'
                  }`}
                />
                <span
                  className={`text-xs mt-1.5 whitespace-nowrap ${
                    isComplete
                      ? 'text-green-600 font-medium'
                      : isCurrent
                      ? 'text-[#8FBCFA] font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {getStageLabel(stage)}
                </span>
              </div>

              {/* Connector line (except for last stage) */}
              {index < visibleStages.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${
                    isComplete ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    pending: 'Load',
    cloning: 'Clone',
    parsing: 'Parse',
    analyzing: 'Analyze',
    building_graph: 'Build',
    generating_summary: 'Summary',
  };
  return labels[stage] || stage;
}
