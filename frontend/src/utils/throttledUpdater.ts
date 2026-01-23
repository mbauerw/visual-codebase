/**
 * Throttled state updater using requestAnimationFrame for efficient batching.
 * Reduces state updates during streaming to prevent frame drops.
 */

export interface ThrottledUpdaterOptions {
  /** Minimum interval between updates in milliseconds (default: 16ms = ~60fps) */
  minIntervalMs?: number;
}

export interface ThrottledUpdater<T> {
  /** Queue an update with a delta value */
  update: (delta: T) => void;
  /** Force flush any pending updates immediately */
  forceFlush: () => void;
  /** Cancel any pending updates and clean up */
  cancel: () => void;
}

/**
 * Create a throttled updater that batches state updates using requestAnimationFrame.
 *
 * @param setState - React state setter function
 * @param merge - Function to merge delta into previous state
 * @param options - Configuration options
 * @returns Throttled updater interface
 *
 * @example
 * const updater = createThrottledUpdater(
 *   setContent,
 *   (prev, delta) => prev + delta,
 *   { minIntervalMs: 16 }
 * );
 *
 * // In stream handler:
 * updater.update(chunk); // Batched updates
 *
 * // On complete:
 * updater.forceFlush();
 *
 * // On cleanup:
 * updater.cancel();
 */
export function createThrottledUpdater<T, S = T>(
  setState: React.Dispatch<React.SetStateAction<S>>,
  merge: (prev: S, delta: T) => S,
  options: ThrottledUpdaterOptions = {}
): ThrottledUpdater<T> {
  const { minIntervalMs = 16 } = options;

  let buffer: T | null = null;
  let rafId: number | null = null;
  let lastUpdateTime = 0;

  const flush = () => {
    if (buffer !== null) {
      const currentBuffer = buffer;
      buffer = null;
      setState((prev) => merge(prev, currentBuffer));
      lastUpdateTime = performance.now();
    }
    rafId = null;
  };

  const scheduleUpdate = () => {
    if (rafId !== null) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateTime;

    if (timeSinceLastUpdate >= minIntervalMs) {
      // Enough time has passed, update immediately on next frame
      rafId = requestAnimationFrame(flush);
    } else {
      // Schedule update after remaining time
      const delay = minIntervalMs - timeSinceLastUpdate;
      setTimeout(() => {
        rafId = requestAnimationFrame(flush);
      }, delay);
    }
  };

  return {
    update(delta: T) {
      if (buffer === null) {
        buffer = delta;
      } else {
        // Merge with existing buffer using same merge function
        // For string concatenation, this will combine chunks
        buffer = merge(buffer as unknown as S, delta) as unknown as T;
      }
      scheduleUpdate();
    },

    forceFlush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      flush();
    },

    cancel() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      buffer = null;
    },
  };
}

/**
 * String merge function for throttled text streaming.
 */
export const stringMerge = (prev: string, delta: string): string => prev + delta;

/**
 * Create a throttled string updater optimized for streaming text.
 */
export function createStreamingTextUpdater(
  setState: React.Dispatch<React.SetStateAction<string>>,
  options?: ThrottledUpdaterOptions
): ThrottledUpdater<string> {
  return createThrottledUpdater(setState, stringMerge, options);
}
