import { useState, useCallback, useRef, useEffect } from 'react';
import { generateRundown, getRundownStatus } from '../api/client';
import type { CodebaseRundown } from '../types';

interface UseRundownReturn {
  isGenerating: boolean;
  rundown: CodebaseRundown | null;
  error: string | null;
  status: 'not_started' | 'generating' | 'completed' | 'failed';
  triggerGeneration: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 90 * 2s = 3 minutes max

export function useRundown(
  analysisId: string | null,
  existingRundown?: CodebaseRundown | null,
): UseRundownReturn {
  const [rundown, setRundown] = useState<CodebaseRundown | null>(
    existingRundown ?? null,
  );
  const [status, setStatus] = useState<
    'not_started' | 'generating' | 'completed' | 'failed'
  >(existingRundown ? 'completed' : 'not_started');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Check initial status on mount (handles resume-on-return)
  useEffect(() => {
    if (!analysisId || existingRundown) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await getRundownStatus(analysisId);
        if (cancelled) return;

        if (result.status === 'completed' && result.rundown) {
          setRundown(result.rundown as unknown as CodebaseRundown);
          setStatus('completed');
        } else if (result.status === 'generating') {
          setStatus('generating');
          startPolling();
        } else if (result.status === 'failed') {
          setStatus('failed');
          setError('Rundown generation failed. You can try again.');
        }
      } catch {
        // Analysis may not support rundown status yet — stay at not_started
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (!analysisId || pollingRef.current) return;

    pollCountRef.current = 0;
    pollingRef.current = window.setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        stopPolling();
        setStatus('failed');
        setError('Rundown generation timed out. You can try again.');
        return;
      }

      try {
        const result = await getRundownStatus(analysisId);

        if (result.status === 'completed' && result.rundown) {
          stopPolling();
          setRundown(result.rundown as unknown as CodebaseRundown);
          setStatus('completed');
        } else if (result.status === 'failed') {
          stopPolling();
          setStatus('failed');
          setError('Rundown generation failed. You can try again.');
        }
        // if still 'generating', keep polling
      } catch {
        stopPolling();
        setStatus('failed');
        setError('Failed to check rundown status.');
      }
    }, POLL_INTERVAL_MS);
  }, [analysisId, stopPolling]);

  const triggerGeneration = useCallback(async () => {
    if (!analysisId) return;

    setError(null);
    setStatus('generating');

    try {
      const result = await generateRundown(analysisId);

      if (result.status === 'completed' && result.rundown) {
        // Already done (was generated before)
        setRundown(result.rundown as unknown as CodebaseRundown);
        setStatus('completed');
      } else {
        // Start polling
        startPolling();
      }
    } catch (err: unknown) {
      setStatus('failed');
      setError(
        err instanceof Error ? err.message : 'Failed to start rundown generation.',
      );
    }
  }, [analysisId, startPolling]);

  return {
    isGenerating: status === 'generating',
    rundown,
    error,
    status,
    triggerGeneration,
  };
}
