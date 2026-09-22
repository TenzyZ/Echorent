import type { UIEvent } from '../state/uiState';
import type { ConversationDriver } from './driver';

export interface ScriptStep {
  delayMs: number; // fired this long after the previous step
  event: UIEvent;
}

// Replays a fixed script of UIEvents. Drives the Storybook demo.
export class ScriptedDriver implements ConversationDriver {
  onEvent?: (event: UIEvent) => void;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly steps: ScriptStep[]) {}

  start(): void {
    this.clearTimers(); // restart replays from step 0
    let at = 0;
    for (const step of this.steps) {
      at += step.delayMs;
      this.timers.push(setTimeout(() => this.onEvent?.(step.event), at));
    }
  }

  stop(): void {
    this.clearTimers();
  }

  sendText(text: string): void {
    this.onEvent?.({ type: 'ui.text.submit', text });
  }

  sendToolResult(_id: string, _output: string): void {
    // no tools to answer in the scripted demo
  }

  private clearTimers(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }
}
