export interface ReleasedToolResult {
  callId: string;
  result: string;
  isError: boolean;
}

interface CallState {
  result?: string;
  isError: boolean;
  dropped: boolean;
  sent: boolean;
}

// The latest server event that decides whether tool.result may be sent.
// Results are released only while a completed or interrupted reply.done is the latest one.
type LatestEvent = 'none' | 'reply.started' | 'input.speech.started' | 'reply.done';

export class ToolResultGate {
  private calls = new Map<string, CallState>();
  private order: string[] = [];
  private latest: LatestEvent = 'none';

  addCall(callId: string): boolean {
    if (!callId || this.calls.has(callId)) return false;
    this.calls.set(callId, { isError: false, dropped: false, sent: false });
    this.order.push(callId);
    return true;
  }

  pendingCallIds(): string[] {
    return this.order.filter((callId) => {
      const call = this.calls.get(callId);
      return call && !call.sent && !call.dropped;
    });
  }

  onReplyStarted(): void {
    this.latest = 'reply.started';
  }

  onUserSpeechStarted(): void {
    this.latest = 'input.speech.started';
  }

  resolve(callId: string, result: string, isError = false): ReleasedToolResult[] {
    const call = this.calls.get(callId);
    if (!call || call.dropped || call.sent || call.result !== undefined) return [];
    call.result = result;
    call.isError = isError;
    return this.drain();
  }

  onReplyDone(interrupted: boolean): ReleasedToolResult[] {
    this.latest = 'reply.done';
    if (interrupted) {
      for (const call of this.calls.values()) if (!call.sent) call.dropped = true;
      return [];
    }
    return this.drain();
  }

  reset(): void {
    this.calls.clear();
    this.order = [];
    this.latest = 'none';
  }

  private drain(): ReleasedToolResult[] {
    if (this.latest !== 'reply.done') return [];
    const released: ReleasedToolResult[] = [];
    for (const callId of this.order) {
      const call = this.calls.get(callId);
      if (!call || call.dropped || call.sent) continue;
      if (call.result === undefined) break;
      call.sent = true;
      released.push({ callId, result: call.result, isError: call.isError });
    }
    return released;
  }
}
