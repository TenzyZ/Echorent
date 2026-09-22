import { isBackendSearchResult, type BackendSearchResult } from '../cars';
import type { ConversationDriver } from '../conversation/driver';
import type { UIEvent } from '../state/uiState';
import { decodeBase64ToFloat32, PlaybackPlanner } from './audio';
import { parseServerMessage, type ClientMessage } from './protocol';
import { ToolResultGate, type ReleasedToolResult } from './toolResultGate';

const MIC_WORKLET_SRC = `
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel);
    return true;
  }
}
registerProcessor('echorent-mic', MicProcessor);
`;

const SAMPLE_RATE = 24_000;
const BATCH_SAMPLES = 2_400;
const SEARCH_TIMEOUT_MS = 8_000;
const END_TIMEOUT_MS = 1_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface ToolOutcome {
  search?: BackendSearchResult;
  error?: string;
}

export class VoiceSession implements ConversationDriver {
  onEvent?: (event: UIEvent) => void;
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private micNode: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private workletUrl: string | null = null;
  private planner = new PlaybackPlanner();
  private sources: AudioBufferSourceNode[] = [];
  private pendingSamples: number[] = [];
  private queuedTexts: string[] = [];
  private ready = false;
  private micEnabled = true;
  private started = false;
  private ending = false;
  private finished = false;
  private endWaiter: (() => void) | null = null;
  private gate = new ToolResultGate();
  private searches = new Map<string, AbortController>();
  private outcomes = new Map<string, ToolOutcome>();

  // Navigation must still end the session synchronously; a bare close stays billable for 30s.
  private readonly onPageHide = (): void => {
    void this.endSession();
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('pagehide', this.onPageHide);
    this.emit({ type: 'session.connecting' });
    void this.connect();
  }

  stop(): void {
    if (!this.started || this.finished) return;
    void this.endSession();
  }

  setMic(enabled: boolean): void {
    if (!this.started || this.finished) return;
    this.micEnabled = enabled;
    for (const track of this.micStream?.getAudioTracks() ?? []) track.enabled = enabled;
    if (!enabled) this.pendingSamples = [];
    this.emit({ type: 'mic.changed', enabled });
  }

  sendText(text: string): void {
    if (this.finished) return;
    if (!this.ready) {
      this.queuedTexts.push(text);
      return;
    }
    this.sendTextNow(text);
  }

  private async connect(): Promise<void> {
    try {
      this.micCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.outCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      await Promise.all([this.micCtx.resume(), this.outCtx.resume()]);
      if (this.ending || this.finished) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true }
      });
      if (this.ending || this.finished) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.micStream = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = this.micEnabled; });

      this.workletUrl = URL.createObjectURL(new Blob([MIC_WORKLET_SRC], { type: 'application/javascript' }));
      await this.micCtx.audioWorklet.addModule(this.workletUrl);
      if (this.ending || this.finished) return;
      this.micNode = new AudioWorkletNode(this.micCtx, 'echorent-mic');
      this.micNode.port.onmessage = (event) => this.collectMicFrame(event.data as Float32Array);
      this.micSource = this.micCtx.createMediaStreamSource(stream);
      this.micSource.connect(this.micNode);
      this.micNode.connect(this.micCtx.destination);

      const response = await fetch('/api/voice/token');
      if (!response.ok) throw new Error('token endpoint failed');
      const credentials = await response.json() as Record<string, unknown>;
      if (typeof credentials.token !== 'string' || !credentials.token || typeof credentials.agent_id !== 'string' || !credentials.agent_id) {
        throw new Error('invalid token response');
      }
      if (this.ending || this.finished) return;

      const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(credentials.token)}`);
      this.ws = ws;
      ws.onopen = () => this.send({ type: 'session.update', session: { agent_id: credentials.agent_id as string } });
      ws.onmessage = (event) => this.handleServer(String(event.data));
      ws.onerror = () => this.fail('Voice connection failed.');
      ws.onclose = () => {
        if (this.ending) this.endWaiter?.();
        else this.fail('Voice connection closed unexpectedly.');
      };
    } catch {
      this.fail('Voice session could not start.');
    }
  }

  private sendTextNow(text: string): void {
    this.send({ type: 'conversation.message', role: 'user', content: text });
    this.send({ type: 'reply.create' });
  }

  private send(message: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  private emit(event: UIEvent): void {
    this.onEvent?.(event);
  }

  private collectMicFrame(frame: Float32Array): void {
    if (!this.ready || !this.micEnabled) return;
    for (let i = 0; i < frame.length; i += 1) this.pendingSamples.push(frame[i]);
    if (this.pendingSamples.length < BATCH_SAMPLES) return;
    const bytes = new Uint8Array(this.pendingSamples.length * 2);
    const view = new DataView(bytes.buffer);
    this.pendingSamples.forEach((sample, index) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(index * 2, value < 0 ? value * 32768 : value * 32767, true);
    });
    this.pendingSamples = [];
    this.send({ type: 'input.audio', audio: bytesToBase64(bytes) });
  }

  private handleServer(data: string): void {
    const message = parseServerMessage(data);
    if (!message || this.finished) return;
    // After End, only the server's final session.ended may still act.
    if (this.ending && message.type !== 'session.ended') return;
    switch (message.type) {
      case 'session.ready':
        this.ready = true;
        this.emit({ type: 'session.open' });
        for (const text of this.queuedTexts.splice(0)) this.sendTextNow(text);
        break;
      case 'session.ended':
        if (this.ending) this.endWaiter?.();
        else {
          this.ready = false;
          this.gate.reset();
          this.dropSearches();
          this.stopPlayback();
          this.cleanup();
          this.finishClosed();
        }
        break;
      case 'reply.started':
        this.gate.onReplyStarted();
        this.emit({ type: 'reply.started' });
        break;
      case 'input.speech.started':
        this.gate.onUserSpeechStarted();
        this.stopPlayback();
        this.emit({ type: 'user.speech.started' });
        break;
      case 'input.speech.stopped':
        this.emit({ type: 'user.speech.stopped' });
        break;
      case 'transcript.user.delta':
      case 'transcript.user':
        this.emit({ type: 'user.delta', text: message.text });
        break;
      case 'transcript.agent.delta':
        this.emit({ type: 'agent.delta', text: message.delta });
        break;
      case 'transcript.agent':
        this.emit({ type: 'agent.final', text: message.text });
        break;
      case 'reply.audio':
        try { this.play(message.data); } catch { this.fail('Audio playback failed.'); }
        break;
      case 'reply.done':
        if (message.status === 'interrupted') {
          this.gate.onReplyDone(true);
          this.dropSearches();
          this.stopPlayback();
          this.emit({ type: 'reply.interrupted' });
        } else {
          this.release(this.gate.onReplyDone(false));
          this.emit({ type: 'reply.done' });
        }
        break;
      case 'tool.call':
        this.emit({ type: 'tool.call', id: message.call_id, name: message.name, args: message.arguments });
        this.handleToolCall(message.call_id, message.name, message.arguments);
        break;
      case 'session.error':
        this.fail('Voice session error.');
        break;
    }
  }

  private handleToolCall(callId: string, name: string, args: Record<string, unknown>): void {
    if (!this.gate.addCall(callId)) return;
    if (name !== 'search_cars') {
      this.release(this.gate.resolve(callId, JSON.stringify({ error: 'unknown_tool' }), true));
      return;
    }
    void this.searchCars(callId, args);
  }

  private async searchCars(callId: string, args: Record<string, unknown>): Promise<void> {
    const controller = new AbortController();
    this.searches.set(callId, controller);
    const timeout = window.setTimeout(() => controller.abort('timeout'), SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch('/api/search_cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) throw new Error('backend status');
      if (controller.signal.reason === 'dropped') return;
      const parsed: unknown = JSON.parse(body);
      if (!isBackendSearchResult(parsed)) throw new Error('invalid backend response');
      this.outcomes.set(callId, { search: parsed });
      this.release(this.gate.resolve(callId, body));
    } catch {
      if (controller.signal.reason === 'dropped') return;
      this.outcomes.set(callId, { error: 'Car search is unavailable.' });
      this.release(this.gate.resolve(callId, JSON.stringify({ error: 'search_unavailable' }), true));
    } finally {
      window.clearTimeout(timeout);
      this.searches.delete(callId);
    }
  }

  private release(results: ReleasedToolResult[]): void {
    for (const result of results) {
      if (!this.send({ type: 'tool.result', call_id: result.callId, result: result.result, is_error: result.isError })) {
        this.outcomes.delete(result.callId);
        this.fail('Voice connection closed unexpectedly.');
        return;
      }
      const outcome = this.outcomes.get(result.callId);
      if (outcome?.search) this.emit({ type: 'search.result', result: outcome.search });
      if (outcome?.error) {
        this.setMic(false);
        this.emit({ type: 'session.error', message: outcome.error });
      }
      this.outcomes.delete(result.callId);
    }
  }

  private dropSearches(): void {
    for (const controller of this.searches.values()) controller.abort('dropped');
    this.searches.clear();
    this.outcomes.clear();
  }

  private play(audio: string): void {
    const context = this.outCtx;
    if (!context) return;
    const samples = decodeBase64ToFloat32(audio);
    if (!samples.length) return;
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => { this.sources = this.sources.filter((item) => item !== source); };
    this.sources.push(source);
    source.start(this.planner.schedule(samples, context.currentTime + 0.05));
  }

  private stopPlayback(): void {
    for (const source of this.sources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.sources = [];
    this.planner.flush();
  }

  private async endSession(): Promise<void> {
    if (this.ending || this.finished) return;
    this.ending = true;
    this.ready = false;
    this.gate.reset();
    this.dropSearches();
    this.stopPlayback();
    this.pendingSamples = [];

    if (this.ws?.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, END_TIMEOUT_MS);
        this.endWaiter = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        this.send({ type: 'session.end' });
      });
    }
    try { this.ws?.close(); } catch { /* socket was not open */ }
    this.cleanup();
    this.finishClosed();
  }

  private fail(message: string): void {
    if (this.finished || this.ending) return;
    this.finished = true;
    this.ready = false;
    this.gate.reset();
    this.dropSearches();
    this.stopPlayback();
    try {
      this.send({ type: 'session.end' });
      this.ws?.close();
    } catch { /* socket was not open */ }
    this.cleanup();
    this.emit({ type: 'session.error', message });
  }

  private cleanup(): void {
    window.removeEventListener('pagehide', this.onPageHide);
    this.micNode?.disconnect();
    this.micSource?.disconnect();
    this.micNode = null;
    this.micSource = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    void this.micCtx?.close();
    void this.outCtx?.close();
    this.micCtx = null;
    this.outCtx = null;
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.workletUrl = null;
    this.ws = null;
    this.endWaiter = null;
  }

  private finishClosed(): void {
    if (this.finished) return;
    this.finished = true;
    this.emit({ type: 'session.closed' });
  }
}
