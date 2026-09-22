import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIEvent } from '../state/uiState';
import { ScriptedDriver, type ScriptStep } from './ScriptedDriver';

const steps: ScriptStep[] = [
  { delayMs: 100, event: { type: 'user.speech.started' } },
  { delayMs: 50, event: { type: 'user.delta', text: 'Hi' } },
  { delayMs: 60, event: { type: 'user.speech.stopped' } }
];

describe('ScriptedDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeDriver() {
    const events: UIEvent[] = [];
    const driver = new ScriptedDriver(steps);
    driver.onEvent = (event) => events.push(event);
    return { driver, events };
  }

  it('fires the steps in order at the cumulative delays', () => {
    const { driver, events } = makeDriver();
    driver.start();
    expect(events).toEqual([]);
    vi.advanceTimersByTime(99);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([{ type: 'user.speech.started' }]);
    vi.advanceTimersByTime(50);
    expect(events).toEqual([{ type: 'user.speech.started' }, { type: 'user.delta', text: 'Hi' }]);
    vi.advanceTimersByTime(60);
    expect(events).toEqual([
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'Hi' },
      { type: 'user.speech.stopped' }
    ]);
  });

  it('stop cancels the remaining steps', () => {
    const { driver, events } = makeDriver();
    driver.start();
    vi.advanceTimersByTime(150); // first two steps fired
    driver.stop();
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([{ type: 'user.speech.started' }, { type: 'user.delta', text: 'Hi' }]);
  });

  it('sendText emits ui.text.submit immediately', () => {
    const { driver, events } = makeDriver();
    driver.start();
    driver.sendText('Any Vezel free?');
    expect(events).toEqual([{ type: 'ui.text.submit', text: 'Any Vezel free?' }]);
  });

  it('sendToolResult is a no-op', () => {
    const { driver, events } = makeDriver();
    driver.start();
    driver.sendToolResult('t1', '{}');
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'Hi' },
      { type: 'user.speech.stopped' }
    ]);
  });

  it('start twice replays the script from the beginning without double-scheduling', () => {
    const { driver, events } = makeDriver();
    driver.start();
    vi.advanceTimersByTime(150); // two steps fired
    driver.start(); // restart: old pending timers must be gone
    vi.advanceTimersByTime(100);
    expect(events).toEqual([
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'Hi' },
      { type: 'user.speech.started' } // replayed first step, and only that one
    ]);
    vi.advanceTimersByTime(110);
    expect(events).toEqual([
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'Hi' },
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'Hi' },
      { type: 'user.speech.stopped' }
    ]);
  });
});
