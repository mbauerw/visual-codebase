/**
 * Frontend network logger for tracking analysis status updates.
 * Mirrors the backend network_logger.py format for easy comparison.
 * Logs are stored in localStorage and printed to console.
 */

const STORAGE_KEY = 'frontend_network_logs';
const MAX_LOGS = 500; // Keep last 500 log entries

export interface FrontendLogEntry {
  timestamp: string;
  operation: string;
  phase?: string;
  previousPhase?: string;
  progress?: number;
  currentStep?: string;
  totalFiles?: number;
  timeSinceLastUpdate?: number;
  timeSinceAnalysisStart?: number;
  source: 'status_poll' | 'status_change' | 'analysis_start' | 'analysis_complete' | 'analysis_error' | 'progress_animation';
  metadata?: Record<string, unknown>;
}

// Track analysis start time for duration calculations
let analysisStartTime: number | null = null;
let lastUpdateTime: number | null = null;
let lastPhase: string | null = null;

/**
 * Get current ISO timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate time differences
 */
function getTimeDiffs(): { sinceStart: number | null; sinceLastUpdate: number | null } {
  const now = Date.now();
  return {
    sinceStart: analysisStartTime ? (now - analysisStartTime) / 1000 : null,
    sinceLastUpdate: lastUpdateTime ? (now - lastUpdateTime) / 1000 : null,
  };
}

/**
 * Log an entry and persist to localStorage
 */
function logEntry(entry: FrontendLogEntry): void {
  // Console output with styling
  const phaseInfo = entry.phase ? `[${entry.phase}]` : '';
  const progressInfo = entry.progress !== undefined ? `${entry.progress}%` : '';
  const timeInfo = entry.timeSinceAnalysisStart
    ? `+${entry.timeSinceAnalysisStart.toFixed(2)}s`
    : '';

  console.log(
    `%c[FE-NET] ${entry.operation} ${phaseInfo} ${progressInfo} ${timeInfo}`,
    'color: #8FBCFA; font-weight: bold;',
    entry
  );

  // Persist to localStorage
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const logs: FrontendLogEntry[] = existing ? JSON.parse(existing) : [];
    logs.push(entry);

    // Keep only the last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    // localStorage might be full or unavailable
    console.warn('Failed to persist log entry:', e);
  }

  lastUpdateTime = Date.now();
}

/**
 * Log when analysis starts
 */
export function logAnalysisStart(analysisId: string, isGitHub: boolean): void {
  analysisStartTime = Date.now();
  lastUpdateTime = Date.now();
  lastPhase = null;

  logEntry({
    timestamp: getTimestamp(),
    operation: 'analysis_start',
    source: 'analysis_start',
    metadata: {
      analysisId,
      isGitHub,
    },
  });
}

/**
 * Log when a status poll response is received
 */
export function logStatusPoll(
  phase: string,
  progress: number,
  currentStep: string,
  totalFiles: number
): void {
  const { sinceStart, sinceLastUpdate } = getTimeDiffs();
  const phaseChanged = lastPhase !== null && lastPhase !== phase;

  const entry: FrontendLogEntry = {
    timestamp: getTimestamp(),
    operation: phaseChanged ? 'phase_change' : 'status_poll',
    phase,
    progress,
    currentStep,
    totalFiles,
    source: phaseChanged ? 'status_change' : 'status_poll',
    timeSinceAnalysisStart: sinceStart ?? undefined,
    timeSinceLastUpdate: sinceLastUpdate ?? undefined,
  };

  if (phaseChanged) {
    entry.previousPhase = lastPhase ?? undefined;
  }

  logEntry(entry);
  lastPhase = phase;
}

/**
 * Log when analysis completes successfully
 */
export function logAnalysisComplete(totalDuration?: number): void {
  const { sinceStart } = getTimeDiffs();

  logEntry({
    timestamp: getTimestamp(),
    operation: 'analysis_complete',
    source: 'analysis_complete',
    timeSinceAnalysisStart: totalDuration ?? sinceStart ?? undefined,
  });

  // Reset tracking
  analysisStartTime = null;
  lastUpdateTime = null;
  lastPhase = null;
}

/**
 * Log when analysis fails
 */
export function logAnalysisError(error: string): void {
  const { sinceStart } = getTimeDiffs();

  logEntry({
    timestamp: getTimestamp(),
    operation: 'analysis_error',
    source: 'analysis_error',
    timeSinceAnalysisStart: sinceStart ?? undefined,
    metadata: {
      error,
    },
  });

  // Reset tracking
  analysisStartTime = null;
  lastUpdateTime = null;
  lastPhase = null;
}

/**
 * Log progress animation updates (for debugging animation sync)
 */
export function logProgressAnimation(
  phase: string,
  animatedProgress: number,
  targetProgress: number
): void {
  const { sinceStart } = getTimeDiffs();

  logEntry({
    timestamp: getTimestamp(),
    operation: 'progress_animation',
    phase,
    progress: animatedProgress,
    source: 'progress_animation',
    timeSinceAnalysisStart: sinceStart ?? undefined,
    metadata: {
      targetProgress,
      delta: targetProgress - animatedProgress,
    },
  });
}

/**
 * Get all stored logs
 */
export function getLogs(): FrontendLogEntry[] {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all stored logs
 */
export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
  analysisStartTime = null;
  lastUpdateTime = null;
  lastPhase = null;
}

/**
 * Export logs as downloadable JSON file
 */
export function exportLogs(): void {
  const logs = getLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frontend-network-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print a summary of phase durations from logs
 */
export function printPhaseSummary(): void {
  const logs = getLogs();
  const phaseChanges = logs.filter(l => l.source === 'status_change' || l.source === 'analysis_start' || l.source === 'analysis_complete');

  console.log('%c=== Phase Duration Summary ===', 'color: #FF9A9D; font-weight: bold;');

  let lastTime: number | null = null;
  for (const log of phaseChanges) {
    const time = new Date(log.timestamp).getTime();
    if (lastTime !== null) {
      const duration = (time - lastTime) / 1000;
      console.log(`${log.previousPhase || 'start'} -> ${log.phase || log.operation}: ${duration.toFixed(2)}s`);
    }
    lastTime = time;
  }
}
