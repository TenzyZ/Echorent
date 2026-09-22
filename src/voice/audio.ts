// Pure audio helpers. No AudioContext here — the browser layer lives in session.ts.

export function decodeBase64ToFloat32(b64: string): Float32Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(bytes.length >> 1);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768; // little-endian pairs
  }
  return samples;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

// Schedules PCM chunks back to back on an absolute AudioContext clock.
export class PlaybackPlanner {
  private clock = 0;

  constructor(private readonly sampleRate = 24000) {}

  nextStartTime(): number {
    return this.clock;
  }

  schedule(samples: Float32Array, currentTime: number): number {
    const start = Math.max(this.clock, currentTime);
    this.clock = start + samples.length / this.sampleRate;
    return start;
  }

  flush(): void {
    this.clock = 0; // barge-in: the next reply starts a fresh timeline
  }
}
