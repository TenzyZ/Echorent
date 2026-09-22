import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIEvent } from '../state/uiState';
import { VoiceSession } from './session';

// Deterministic fakes for the browser surface VoiceSession touches.

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static last: FakeWebSocket | null = null;
  readyState = FakeWebSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  sentTypes(): unknown[] {
    return this.sent.map(({ type }) => type);
  }
}

let scheduledSources = 0;

class FakeAudioContext {
  sampleRate = 24_000;
  currentTime = 0;
  destination = {};
  closed = false;
  audioWorklet = { addModule: async () => {} };
  resume = async () => {};
  close = async () => { this.closed = true; };
  createBuffer(_channels: number, length: number) {
    return { duration: length / 24_000, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return {
      buffer: null,
      onended: null,
      connect: () => {},
      start: () => { scheduledSources += 1; },
      stop: () => {}
    };
  }
  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
}

class FakeWorkletNode {
  static last: FakeWorkletNode | null = null;
  port: { onmessage: ((event: { data: Float32Array }) => void) | null } = { onmessage: null };
  constructor() {
    FakeWorkletNode.last = this;
  }
  connect() {}
  disconnect() {}
}

const golden = {
  pickup_airport: 'SIN', pickup_date: 'October 7', pickup_time: '07:00',
  return_date: 'October 10', return_time: '07:00', driver_age: 30
};

// Exact backend body text; key order and spacing are deliberately unusual so re-serialization would differ.
const BODY = '{"ok":true,  "demo":true,"notice":"Demo cars.","rental":{"airport":"SIN","airport_name":"Singapore Changi",'
  + '"pickup":{"date":"2026-10-07","weekday":"Wednesday","time":"07:00"},'
  + '"return":{"date":"2026-10-10","weekday":"Saturday","time":"07:00"},"driver_age":30},'
  + '"cars":[{"car_id":"demo-sin-1","airport":"SIN","name":"Toyota Yaris","category":"economy",'
  + '"transmission":"automatic","seats":5,"bags":2,"daily_rate":60,"currency":"SGD"}]}';

interface PendingSearch {
  resolve: (body: string) => void;
  reject: (error: unknown) => void;
}

let searches: PendingSearch[];
let searchRequests: unknown[];
let track: { enabled: boolean; stopped: boolean; stop: () => void };
let pageHide: (() => void) | null;
let events: UIEvent[];

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function fakeFetch(url: string, init?: { body?: string; signal?: AbortSignal }) {
  if (url === '/api/voice/token') {
    return Promise.resolve({ ok: true, json: async () => ({ token: 'temp-token', agent_id: 'agent-from-server' }) });
  }
  searchRequests.push(JSON.parse(init?.body ?? 'null'));
  return new Promise((resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    searches.push({
      resolve: (body) => resolve({ ok: true, text: async () => body }),
      reject
    });
  });
}

async function readySession(): Promise<{ session: VoiceSession; ws: FakeWebSocket }> {
  const session = new VoiceSession();
  session.onEvent = (event) => events.push(event);
  session.start();
  await flush();
  const ws = FakeWebSocket.last!;
  ws.open();
  ws.receive({ type: 'session.ready', session_id: 'sess_1' });
  return { session, ws };
}

beforeEach(() => {
  FakeWebSocket.last = null;
  scheduledSources = 0;
  searches = [];
  searchRequests = [];
  events = [];
  pageHide = null;
  track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    addEventListener: (type: string, fn: () => void) => { if (type === 'pagehide') pageHide = fn; },
    removeEventListener: (type: string, fn: () => void) => { if (type === 'pagehide' && pageHide === fn) pageHide = null; }
  });
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) }
  });
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worklet');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VoiceSession startup and audio gating', () => {
  it('binds the server-provided agent, then sends mic audio only after session.ready and while unmuted', async () => {
    const session = new VoiceSession();
    session.start();
    await flush();
    const ws = FakeWebSocket.last!;
    expect(ws.url).toBe('wss://agents.assemblyai.com/v1/ws?token=temp-token');
    ws.open();
    expect(ws.sent[0]).toEqual({ type: 'session.update', session: { agent_id: 'agent-from-server' } });

    const frame = { data: new Float32Array(2_400) };
    FakeWorkletNode.last!.port.onmessage!(frame);
    expect(ws.sentTypes()).not.toContain('input.audio');

    ws.receive({ type: 'session.ready', session_id: 'sess_1' });
    FakeWorkletNode.last!.port.onmessage!(frame);
    expect(ws.sentTypes().filter((type) => type === 'input.audio')).toHaveLength(1);

    session.setMic(false);
    expect(track.enabled).toBe(false);
    FakeWorkletNode.last!.port.onmessage!(frame);
    expect(ws.sentTypes().filter((type) => type === 'input.audio')).toHaveLength(1);
  });
});

describe('VoiceSession tool results', () => {
  it('sends the exact backend body as tool.result and renders the same body, never mid-user-turn', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started', reply_id: 'fc-call_1' });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', reply_id: 'fc-call_1', status: 'completed' });
    ws.receive({ type: 'input.speech.started' });
    searches[0].resolve(BODY);
    await flush();

    expect(searchRequests).toEqual([golden]);
    expect(ws.sentTypes()).not.toContain('tool.result');
    expect(events.some(({ type }) => type === 'search.result')).toBe(false);

    ws.receive({ type: 'reply.started', reply_id: 'reply_2' });
    ws.receive({ type: 'reply.done', reply_id: 'reply_2', status: 'completed' });
    const results = ws.sent.filter(({ type }) => type === 'tool.result');
    expect(results).toEqual([{ type: 'tool.result', call_id: 'call_1', result: BODY, is_error: false }]);
    const rendered = events.find((event) => event.type === 'search.result');
    expect(rendered).toEqual({ type: 'search.result', args: golden, result: JSON.parse(BODY) });
  });

  it('ignores a duplicate call ID: one search, one result', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[0].resolve(BODY);
    await flush();
    expect(searchRequests).toHaveLength(1);
    expect(ws.sent.filter(({ type }) => type === 'tool.result')).toHaveLength(1);
  });

  it('drops a result that resolves after its reply was interrupted', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'interrupted' });
    searches[0].resolve(BODY);
    await flush();
    ws.receive({ type: 'reply.done', status: 'completed' });
    expect(ws.sentTypes()).not.toContain('tool.result');
    expect(events.some(({ type }) => type === 'search.result')).toBe(false);
  });

  it('reports search failure with the top-level is_error flag and a JSON string result', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[0].reject(new Error('offline'));
    await flush();
    const [result] = ws.sent.filter(({ type }) => type === 'tool.result');
    expect(result).toEqual({ type: 'tool.result', call_id: 'call_1', result: '{"error":"search_unavailable"}', is_error: true });
    expect(events.some(({ type }) => type === 'search.result')).toBe(false);
  });

  it('select_car uses only the last released search, takes no fetch, and emits after gate release', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'search_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[0].resolve(BODY);
    await flush();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'select_1', name: 'select_car', arguments: { car_id: 'demo-sin-1' } });
    expect(events.some(({ type }) => type === 'car.selected')).toBe(false);
    expect(searchRequests).toHaveLength(1);
    ws.receive({ type: 'reply.done', status: 'completed' });
    expect(events.filter(({ type }) => type === 'car.selected')).toEqual([{ type: 'car.selected', carId: 'demo-sin-1' }]);
    expect(ws.sent.filter(({ type, call_id }) => type === 'tool.result' && call_id === 'select_1')).toEqual([
      { type: 'tool.result', call_id: 'select_1', result: '{"ok":true,"car_id":"demo-sin-1"}', is_error: false }
    ]);
    ws.receive({ type: 'tool.call', call_id: 'select_1', name: 'select_car', arguments: { car_id: 'demo-sin-1' } });
    expect(events.filter(({ type }) => type === 'car.selected')).toHaveLength(1);
  });

  it('rejects selection from unreleased or interrupted search and drops interrupted selection', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'search_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'tool.call', call_id: 'select_early', name: 'select_car', arguments: { car_id: 'demo-sin-1' } });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[0].resolve(BODY);
    await flush();
    expect(ws.sent.find(({ call_id }) => call_id === 'select_early')).toMatchObject({ is_error: true });
    expect(events.some(({ type }) => type === 'car.selected')).toBe(false);
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'select_interrupt', name: 'select_car', arguments: { car_id: 'demo-sin-1' } });
    ws.receive({ type: 'reply.done', status: 'interrupted' });
    ws.receive({ type: 'reply.done', status: 'completed' });
    expect(ws.sent.find(({ call_id }) => call_id === 'select_interrupt')).toBeUndefined();
    expect(events.some(({ type }) => type === 'car.selected')).toBe(false);
  });

  it('invalidates a held selection when a newer search releases first', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'search_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[0].resolve(BODY);
    await flush();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'search_2', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'tool.call', call_id: 'select_stale', name: 'select_car', arguments: { car_id: 'demo-sin-1' } });
    ws.receive({ type: 'reply.done', status: 'completed' });
    searches[1].resolve(BODY.replace('demo-sin-1', 'demo-sin-2'));
    await flush();
    expect(ws.sent.find(({ call_id }) => call_id === 'select_stale')).toMatchObject({ is_error: true, result: '{"error":"stale_selection"}' });
    expect(events.some(({ type }) => type === 'car.selected')).toBe(false);
  });

  it('notify sends a system message only while ready and live', async () => {
    const session = new VoiceSession();
    session.notify('Pending review.');
    session.start();
    await flush();
    const ws = FakeWebSocket.last!;
    ws.open();
    session.notify('Pending review.');
    expect(ws.sentTypes()).not.toContain('conversation.message');
    ws.receive({ type: 'session.ready', session_id: 'sess_1' });
    session.notify('Pending review.');
    expect(ws.sent.slice(-2)).toEqual([
      { type: 'conversation.message', role: 'system', content: 'Pending review.' }, { type: 'reply.create' }
    ]);
    session.stop();
    const count = ws.sent.length;
    session.notify('Late.');
    expect(ws.sent).toHaveLength(count);
  });

  it('notify does nothing after a fatal voice failure', async () => {
    const { session, ws } = await readySession();
    ws.receive({ type: 'session.error', message: 'failed' });
    const count = ws.sent.length;
    session.notify('Late outcome.');
    expect(ws.sent).toHaveLength(count);
  });
});

describe('VoiceSession end window', () => {
  it('A: ignores reply.audio after End', async () => {
    const { session, ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'reply.audio', data: 'AAAA' });
    expect(scheduledSources).toBe(1);
    session.stop();
    const eventsAtEnd = events.length;
    ws.receive({ type: 'reply.audio', data: 'AAAA' });
    ws.receive({ type: 'transcript.agent.delta', delta: 'late' });
    ws.receive({ type: 'reply.started' });
    expect(scheduledSources).toBe(1);
    expect(events.length).toBe(eventsAtEnd);
  });

  it('B: ignores tool.call after End: no search, no tool.result', async () => {
    const { session, ws } = await readySession();
    session.stop();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'call_late', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    await flush();
    expect(searchRequests).toEqual([]);
    expect(ws.sentTypes()).not.toContain('tool.result');
  });

  it('drops an in-flight search when End is pressed: no result, no cards', async () => {
    const { session, ws } = await readySession();
    ws.receive({ type: 'reply.started' });
    ws.receive({ type: 'tool.call', call_id: 'call_1', name: 'search_cars', arguments: golden });
    ws.receive({ type: 'reply.done', status: 'completed' });
    session.stop();
    searches[0].resolve(BODY);
    await flush();
    expect(ws.sentTypes()).not.toContain('tool.result');
    expect(events.some(({ type }) => type === 'search.result')).toBe(false);
  });

  it('C: session.ended finishes teardown immediately', async () => {
    const { session, ws } = await readySession();
    session.stop();
    expect(ws.sentTypes().filter((type) => type === 'session.end')).toHaveLength(1);
    expect(events.some(({ type }) => type === 'session.closed')).toBe(false);
    ws.receive({ type: 'session.ended', session_duration_seconds: 1, audio_duration_seconds: 1, timestamp: 1 });
    await flush();
    expect(events.filter(({ type }) => type === 'session.closed')).toHaveLength(1);
    expect(ws.closed).toBe(true);
    expect(track.stopped).toBe(true);
    expect(pageHide).toBeNull();
    session.stop();
    expect(ws.sentTypes().filter((type) => type === 'session.end')).toHaveLength(1);
  });

  it('D: closes after the bounded fallback when session.ended never arrives', async () => {
    const { session, ws } = await readySession();
    vi.useFakeTimers();
    session.stop();
    await flush();
    expect(ws.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(ws.closed).toBe(true);
    expect(events.filter(({ type }) => type === 'session.closed')).toHaveLength(1);
  });
});

describe('VoiceSession failure and navigation teardown', () => {
  it('sends session.end before closing on a fatal session.error, once', async () => {
    const { ws } = await readySession();
    ws.receive({ type: 'session.error', code: 'invalid_audio', message: 'bad audio' });
    expect(ws.sentTypes().at(-1)).toBe('session.end');
    expect(ws.closed).toBe(true);
    expect(track.stopped).toBe(true);
    expect(pageHide).toBeNull();
    ws.onclose?.();
    ws.onerror?.();
    expect(events.filter(({ type }) => type === 'session.error')).toHaveLength(1);
    expect(ws.sentTypes().filter((type) => type === 'session.end')).toHaveLength(1);
  });

  it('sends session.end synchronously on pagehide, without new fetches', async () => {
    const { ws } = await readySession();
    const fetchCalls = vi.mocked(fetch).mock.calls.length;
    pageHide!();
    expect(ws.sentTypes().at(-1)).toBe('session.end');
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCalls);
  });
});
