import { describe, expect, it } from 'vitest';
import { ToolResultGate } from './toolResultGate';

// Each gate starts as a live turn would: the agent reply carrying the tool.call is in flight.
function inReply(): ToolResultGate {
  const gate = new ToolResultGate();
  gate.onReplyStarted();
  return gate;
}

const released = (callId: string, result: string, isError = false) => [{ callId, result, isError }];

describe('ToolResultGate', () => {
  it('A: releases once when the result arrives after a completed reply.done', () => {
    const gate = inReply();
    gate.addCall('a');
    expect(gate.onReplyDone(false)).toEqual([]);
    expect(gate.resolve('a', 'A')).toEqual(released('a', 'A'));
    expect(gate.resolve('a', 'A2')).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual([]);
  });

  it('B: holds a result resolved mid-reply until reply.done, then releases once', () => {
    const gate = inReply();
    gate.addCall('a');
    expect(gate.resolve('a', 'A')).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual(released('a', 'A'));
    expect(gate.onReplyDone(false)).toEqual([]);
  });

  it('C: holds a result during a newer user turn, then releases at the next completed reply.done', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.onReplyDone(false);
    gate.onUserSpeechStarted();
    expect(gate.resolve('a', 'A')).toEqual([]);
    gate.onReplyStarted();
    expect(gate.onReplyDone(false)).toEqual(released('a', 'A'));
  });

  it('C: a newer user turn that ends in an interrupted reply drops the held result', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.onReplyDone(false);
    gate.onUserSpeechStarted();
    gate.resolve('a', 'A');
    gate.onReplyStarted();
    expect(gate.onReplyDone(true)).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual([]);
  });

  it('D: holds when no reply.done has been observed yet', () => {
    const gate = new ToolResultGate();
    gate.addCall('a');
    expect(gate.resolve('a', 'A')).toEqual([]);
  });

  it('E: drops a call whose reply was interrupted before the result arrived', () => {
    const gate = inReply();
    gate.addCall('a');
    expect(gate.onReplyDone(true)).toEqual([]);
    expect(gate.resolve('a', 'A')).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual([]);
  });

  it('F: drops a ready result when its reply is interrupted', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.resolve('a', 'A');
    expect(gate.onReplyDone(true)).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual([]);
  });

  it('G: holds when a newer reply has started', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.onReplyDone(false);
    gate.onReplyStarted();
    expect(gate.resolve('a', 'A')).toEqual([]);
    expect(gate.onReplyDone(false)).toEqual(released('a', 'A'));
  });

  it('H: a duplicate call ID is rejected and can release at most once', () => {
    const gate = inReply();
    expect(gate.addCall('a')).toBe(true);
    expect(gate.addCall('a')).toBe(false);
    gate.resolve('a', 'A');
    gate.resolve('a', 'A-again');
    expect(gate.onReplyDone(false)).toEqual(released('a', 'A'));
    expect(gate.addCall('a')).toBe(false);
  });

  it('I: reset drops pending calls and returns to holding', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.onReplyDone(false);
    gate.reset();
    expect(gate.resolve('a', 'A')).toEqual([]);
    gate.addCall('b');
    expect(gate.resolve('b', 'B')).toEqual([]);
  });

  it('ignores unknown call IDs', () => {
    const gate = inReply();
    gate.onReplyDone(false);
    expect(gate.resolve('missing', 'X')).toEqual([]);
  });

  it('releases in call order when results resolve out of order', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.addCall('b');
    gate.onReplyDone(false);
    expect(gate.resolve('b', 'B')).toEqual([]);
    expect(gate.resolve('a', 'A')).toEqual([...released('a', 'A'), ...released('b', 'B')]);
  });

  it('carries the protocol error flag with the released result', () => {
    const gate = inReply();
    gate.addCall('a');
    gate.onReplyDone(false);
    expect(gate.resolve('a', '{"error":"search_unavailable"}', true)).toEqual(
      released('a', '{"error":"search_unavailable"}', true)
    );
  });
});
