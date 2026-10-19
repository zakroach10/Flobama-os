/** Limit how many MP4 loop tiles decode at once on a phone. */

const MAX_CONCURRENT_LOOP_PREVIEWS = 3;

let active = 0;
const waiters: Array<() => void> = [];

function pump() {
  while (active < MAX_CONCURRENT_LOOP_PREVIEWS && waiters.length) {
    const next = waiters.shift();
    if (!next) return;
    active += 1;
    next();
  }
}

export function acquireLoopPreviewSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
        pump();
      });
    };
    waiters.push(grant);
    pump();
  });
}
