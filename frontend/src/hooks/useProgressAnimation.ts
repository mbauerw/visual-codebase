import { useState, useEffect, useRef, useCallback } from 'react';
import { animate } from 'motion';
import type { AnalysisStatus } from '../types';

interface StageConfig {
  targetPercent: number;
  durationMs: number;
}

// Progress configuration for GitHub analysis (includes cloning)
const GITHUB_STAGE_CONFIG: Record<string, StageConfig> = {
  pending: { targetPercent: 5, durationMs: 2000 },
  cloning: { targetPercent: 50, durationMs: 20000 },
  parsing: { targetPercent: 65, durationMs: 3000 },
  analyzing: { targetPercent: 85, durationMs: 8000 },
  building_graph: { targetPercent: 92, durationMs: 2000 },
  generating_summary: { targetPercent: 98, durationMs: 3000 },
  completed: { targetPercent: 100, durationMs: 300 },
  failed: { targetPercent: -1, durationMs: 0 }, // -1 means freeze
};

// Progress configuration for local analysis (no cloning)
// pending phase is when files are being read - similar to cloning for GitHub
const LOCAL_STAGE_CONFIG: Record<string, StageConfig> = {
  pending: { targetPercent: 50, durationMs: 20000 },
  parsing: { targetPercent: 65, durationMs: 3000 },
  analyzing: { targetPercent: 85, durationMs: 8000 },
  building_graph: { targetPercent: 92, durationMs: 2000 },
  generating_summary: { targetPercent: 98, durationMs: 3000 },
  completed: { targetPercent: 100, durationMs: 300 },
  failed: { targetPercent: -1, durationMs: 0 },
};

interface UseProgressAnimationOptions {
  isGitHub: boolean;
}

interface UseProgressAnimationReturn {
  progress: number;
  isAnimating: boolean;
  reset: () => void;
}

export function useProgressAnimation(
  status: AnalysisStatus | null,
  options: UseProgressAnimationOptions
): UseProgressAnimationReturn {
  const { isGitHub } = options;
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs to track animation state
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const currentProgressRef = useRef(0);
  const previousStatusRef = useRef<AnalysisStatus | null>(null);

  const stageConfig = isGitHub ? GITHUB_STAGE_CONFIG : LOCAL_STAGE_CONFIG;

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopAnimation();
    setProgress(0);
    setIsAnimating(false);
    currentProgressRef.current = 0;
    previousStatusRef.current = null;
  }, [stopAnimation]);

  useEffect(() => {
    // No status - do nothing
    if (!status) {
      return;
    }

    // Same status as before - do nothing (but allow first render with any status)
    if (previousStatusRef.current !== null && status === previousStatusRef.current) {
      return;
    }

    const config = stageConfig[status];
    if (!config) {
      previousStatusRef.current = status;
      return;
    }

    // Handle failed status - freeze at current position
    if (config.targetPercent < 0) {
      stopAnimation();
      setIsAnimating(false);
      previousStatusRef.current = status;
      return;
    }

    const currentProgress = currentProgressRef.current;
    const targetPercent = config.targetPercent;

    // If we're already past the target (backend jumped ahead), snap forward
    if (currentProgress >= targetPercent) {
      previousStatusRef.current = status;
      return;
    }

    // Stop any existing animation
    stopAnimation();

    // Calculate scaled duration based on remaining distance
    const remainingDistance = targetPercent - currentProgress;
    const fullDistance = targetPercent;
    const scaledDuration = fullDistance > 0
      ? (config.durationMs * remainingDistance) / fullDistance
      : config.durationMs;

    // Start new animation
    setIsAnimating(true);

    animationRef.current = animate(currentProgress, targetPercent, {
      duration: scaledDuration / 1000, // motion uses seconds
      ease: 'easeOut',
      onUpdate: (latest) => {
        currentProgressRef.current = latest;
        setProgress(latest);
      },
      onComplete: () => {
        currentProgressRef.current = targetPercent;
        setProgress(targetPercent);
        setIsAnimating(false);
        animationRef.current = null;
      },
    });

    previousStatusRef.current = status;

    // Reset ref on cleanup so next mount starts fresh
    return () => {
      previousStatusRef.current = null;
    };
  }, [status, stageConfig, stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  return {
    progress,
    isAnimating,
    reset,
  };
}
