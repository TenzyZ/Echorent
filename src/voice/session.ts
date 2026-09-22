import type { UIEvent } from '../state/uiState';
import type { ConversationDriver } from '../conversation/driver';
import { parseServerMessage, type ClientMessage } from './protocol';
import { decodeBase64ToFloat32, PlaybackPlanner } from './audio';

// AudioWorklet module source. Passes raw mic frames to the main thread.
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

const SAMPLE_RATE = 24000;
const BATCH_SAMPLES = 2400; // ~100 ms of audio

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Live voice session over the Assembly WebSocket. Thin browser glue — no unit test by design.
export class VoiceSession implements ConversationDriver {
  onEvent?: (event: UIEvent) => void;
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private workletUrl: string | null = null;
  private planner = new PlaybackPlanner();
  private sources: AudioBufferSourceNode[] = [];
  private pending: number[] = [];

  start(): void {
    fetch('/api/voice/token')
      .then((res) => res.json() as Promise<{ token: string; agent_id: string }>)
      .then(({ token, agent_id }) => {
        const ws = new WebSocket('wss://agents.assembly.com/v1/ws?token=' + encodeURIComponent(token));
        this.ws = ws;
        ws.onopen = () => {
          this.send({ type: 'session.update', session: { agent: { agent_id } } });
          this.startMic();
          this.emit({ type: 'session.open' });
        };
        ws.onmessage = (e) => this.handleServer(String(e.data));
      });
  }

  stop(): void {
    this.stopPlayback();
    this.ws?.close();
    this.ws = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    void this.micCtx?.close();
    this.micCtx = null;
    void this.outCtx?.close();
    this.outCtx = null;
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.emit({ type: 'session.closed' });
  }

  sendText(text: string): void {
    this.send({ type: 'input_text.message', text });
  }

  sendToolResult(id: string, output: string): void {
    this.send({ type: 'tool.result', tool_call_id: id, output });
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private emit(event: UIEvent): void {
    this.onEvent?.(event);
  }

  private startMic(): void {
    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((stream) => {
        this.micStream = stream;
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        this.micCtx = ctx;
        this.workletUrl = URL.createObjectURL(new Blob([MIC_WORKLET_SRC], { type: 'application/javascript' }));
        void ctx.audioWorklet.addModule(this.workletUrl).then(() => {
          const node = new AudioWorkletNode(ctx, 'echorent-mic');
          node.port.onmessage = (e) => this.collectMicFrame(e.data as Float32Array);
          ctx.createMediaStreamSource(stream).connect(node);
          node.connect(ctx.destination); // pulls the worklet; it writes only silence
        });
      });
  }

  private collectMicFrame(frame: Float32Array): void {
    for (let i = 0; i < frame.length; i++) this.pending.push(frame[i]);
    if (this.pending.length < BATCH_SAMPLES) return;
    const bytes = new Uint8Array(this.pending.length * 2);
    const view = new DataView(bytes.buffer);
    this.pending.forEach((sample, i) => {
      const s = Math.max(-1, Math.min(1, sample));
      view.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true);
    });
    this.pending = [];
    this.send({ type: 'input_audio_buffer.append', audio: bytesToBase64(bytes) });
  }

  private handleServer(data: string): void {
    const msg = parseServerMessage(data);
    if (!msg) return; // unknown or malformed — ignore
    switch (msg.type) {
      case 'session.created':
        this.emit({ type: 'session.open' });
        break;
      case 'input.speech.started':
        this.stopPlayback(); // barge-in
        this.emit({ type: 'user.speech.started' });
        break;
      case 'input.speech.stopped':
        this.emit({ type: 'user.speech.stopped' });
        break;
      case 'transcript.user.delta':
        this.emit({ type: 'user.delta', text: msg.text });
        break;
      case 'transcript.agent.delta':
        this.emit({ type: 'agent.delta', text: msg.text });
        break;
      case 'reply.audio':
        this.play(msg.audio);
        break;
      case 'reply.done':
        if (msg.interrupted) {
          this.stopPlayback();
          this.emit({ type: 'reply.interrupted' });
        } else {
          this.emit({ type: 'reply.done' });
        }
        break;
      case 'tool.call':
        try {
          const args = JSON.parse(msg.arguments) as unknown;
          if (typeof args !== 'object' || args === null) break; // ponytail: guard the trust boundary
          this.emit({ type: 'tool.call', id: msg.tool_call_id, name: msg.name, args: args as Record<string, unknown> });
        } catch {
          // bad JSON — ignore the message
        }
        break;
      case 'error':
        console.warn('Voice session error:', msg.message);
        break;
    }
  }

  private play(audio: string): void {
    const ctx = (this.outCtx ??= new AudioContext({ sampleRate: SAMPLE_RATE }));
    const samples = decodeBase64ToFloat32(audio);
    const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source);
    };
    this.sources.push(source);
    source.start(ctx.currentTime + 0.05 + this.planner.schedule(samples));
  }

  private stopPlayback(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // source already stopped
      }
    }
    this.sources = [];
    this.planner.flush();
  }
}
