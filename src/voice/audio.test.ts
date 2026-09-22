import { describe, expect, it } from 'vitest';
import { decodeBase64ToFloat32, PlaybackPlanner, rms } from './audio';

describe('decodeBase64ToFloat32', () => {
  it('decodes Int16LE pairs into float samples', () => {
    // bytes 01 00 01 80 -> little-endian samples 0x0001 and 0x8001
    const samples = decodeBase64ToFloat32('AQABgA==');
    expect(samples.length).toBe(2);
    expect(samples[0]).toBeCloseTo(1 / 32768, 10);
    expect(samples[1]).toBeCloseTo(-32767 / 32768, 10);
  });

  it('ignores a trailing odd byte', () => {
    // bytes 01 00 01 -> one full pair only
    const samples = decodeBase64ToFloat32('AQAB');
    expect(samples.length).toBe(1);
    expect(samples[0]).toBeCloseTo(1 / 32768, 10);
  });

  it('returns an empty array for an empty string', () => {
    expect(decodeBase64ToFloat32('').length).toBe(0);
  });
});

describe('rms', () => {
  it('returns the root mean square of a constant signal', () => {
    expect(rms(new Float32Array([0.5, 0.5, 0.5, 0.5]))).toBeCloseTo(0.5, 10);
  });

  it('mixes positive and negative samples', () => {
    expect(rms(new Float32Array([1, -1]))).toBeCloseTo(1, 10);
  });

  it('returns 0 for empty input', () => {
    expect(rms(new Float32Array())).toBe(0);
  });
});

describe('PlaybackPlanner', () => {
  it('starts at 0', () => {
    expect(new PlaybackPlanner().nextStartTime()).toBe(0);
  });

  it('schedules chunks back to back on the 24 kHz timeline', () => {
    const planner = new PlaybackPlanner();
    const chunk = new Float32Array(2400); // 0.1 s at 24 kHz
    expect(planner.schedule(chunk)).toBe(0);
    expect(planner.schedule(chunk)).toBeCloseTo(0.1, 10);
    expect(planner.nextStartTime()).toBeCloseTo(0.2, 10);
  });

  it('flush resets the clock to 0', () => {
    const planner = new PlaybackPlanner();
    planner.schedule(new Float32Array(2400));
    planner.flush();
    expect(planner.nextStartTime()).toBe(0);
  });
});
