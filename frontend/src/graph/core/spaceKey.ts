/**
 * Shared "is the space bar held?" tracker. While space is held a pointerdown
 * on a draggable node pans the canvas instead of dragging the node (see
 * useNodeDrag / useCanvasGestures). Window-level listeners are attached once
 * and ref-counted across canvases; reset on window blur so a lost keyup cannot
 * leave the flag stuck.
 */

let held = false;
let refCount = 0;

function isSpace(e: KeyboardEvent): boolean {
  return e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
}

function onKeyDown(e: KeyboardEvent): void {
  if (isSpace(e)) held = true;
}

function onKeyUp(e: KeyboardEvent): void {
  if (isSpace(e)) held = false;
}

function onBlur(): void {
  held = false;
}

export function isSpaceHeld(): boolean {
  return held;
}

/** Test/dev aid: force the flag (e.g. after a synthetic keydown was not dispatched on window). */
export function setSpaceHeld(value: boolean): void {
  held = value;
}

/** Attach the window listeners (ref-counted). Returns the detach function. */
export function attachSpaceKeyTracking(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (refCount === 0) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }
  refCount++;
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    refCount--;
    if (refCount === 0) {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      held = false;
    }
  };
}
