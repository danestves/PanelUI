import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ToastStore } from '../src/components/toast/toast-store.ts';

function withFakeClock(run) {
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let now = 1_000;
  let nextId = 0;
  const scheduled = new Map();

  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextId;
    scheduled.set(id, { callback, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => scheduled.delete(id);

  try {
    run({
      advance: (milliseconds) => {
        now += milliseconds;
      },
      scheduled,
      fire: (id) => {
        const task = scheduled.get(id);
        assert.ok(task, `expected timer ${id} to be scheduled`);
        scheduled.delete(id);
        task.callback();
      },
    });
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test('toast durations exclude time spent with timers paused', () => {
  withFakeClock(({ advance, scheduled, fire }) => {
    const store = new ToastStore();
    const id = store.show({ label: 'Saved', duration: 1_000 });
    assert.equal([...scheduled.values()][0]?.delay, 1_000);

    advance(400);
    store.pauseTimers();
    assert.equal(scheduled.size, 0);

    advance(10_000);
    store.resumeTimers();
    const [timerId, timer] = [...scheduled.entries()][0];
    assert.equal(timer.delay, 600);
    assert.equal(store.getSnapshot()[0]?.id, id);

    fire(timerId);
    assert.equal(store.getSnapshot().length, 0);
  });
});

test('toasts created while paused wait for the viewport to resume', () => {
  withFakeClock(({ scheduled }) => {
    const store = new ToastStore();
    store.pauseTimers();
    store.show({ label: 'Background result', duration: 750 });
    assert.equal(scheduled.size, 0);

    store.resumeTimers();
    assert.equal([...scheduled.values()][0]?.delay, 750);
  });
});

test('ToastViewport connects the timer lifecycle to AppState', async () => {
  const source = await readFile(
    new URL('../src/components/toast/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /syncTimers\(AppState\.currentState\)/);
  assert.match(source, /AppState\.addEventListener\('change', syncTimers\)/);
  assert.match(source, /subscription\.remove\(\);\s*toastStore\.pauseTimers\(\)/);
});
