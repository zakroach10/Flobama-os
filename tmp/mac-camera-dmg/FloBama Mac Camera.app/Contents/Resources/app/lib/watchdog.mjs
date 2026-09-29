/**
 * Movement watchdog: if the browser connection drops mid-hold, stop all moving cameras.
 */

export function createMoveWatchdog({ timeoutMs, onFire, log }) {
  const timers = new Map();

  function arm(sourceKey) {
    clear(sourceKey);
    const timer = setTimeout(() => {
      timers.delete(sourceKey);
      log(`Watchdog stop for ${sourceKey}`);
      onFire(sourceKey);
    }, timeoutMs);
    timers.set(sourceKey, timer);
  }

  function clear(sourceKey) {
    const timer = timers.get(sourceKey);
    if (timer) {
      clearTimeout(timer);
      timers.delete(sourceKey);
    }
  }

  function clearAll() {
    for (const key of [...timers.keys()]) clear(key);
  }

  return { arm, clear, clearAll };
}
