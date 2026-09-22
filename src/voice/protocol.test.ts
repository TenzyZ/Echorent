import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './protocol';

describe('parseServerMessage', () => {
  it('parses session.created', () => {
    expect(parseServerMessage('{"type":"session.created","session_id":"s1"}')).toEqual({
      type: 'session.created',
      session_id: 's1'
    });
  });

  it('parses input.speech.started', () => {
    expect(parseServerMessage('{"type":"input.speech.started"}')).toEqual({ type: 'input.speech.started' });
  });

  it('parses input.speech.stopped', () => {
    expect(parseServerMessage('{"type":"input.speech.stopped"}')).toEqual({ type: 'input.speech.stopped' });
  });

  it('parses transcript.user.delta', () => {
    expect(parseServerMessage('{"type":"transcript.user.delta","text":"a Honda"}')).toEqual({
      type: 'transcript.user.delta',
      text: 'a Honda'
    });
  });

  it('parses transcript.agent.delta', () => {
    expect(parseServerMessage('{"type":"transcript.agent.delta","text":" Vezel"}')).toEqual({
      type: 'transcript.agent.delta',
      text: ' Vezel'
    });
  });

  it('parses reply.audio', () => {
    expect(parseServerMessage('{"type":"reply.audio","audio":"AAA="}')).toEqual({
      type: 'reply.audio',
      audio: 'AAA='
    });
  });

  it('parses reply.done with interrupted', () => {
    expect(parseServerMessage('{"type":"reply.done","interrupted":true}')).toEqual({
      type: 'reply.done',
      interrupted: true
    });
  });

  it('parses reply.done without interrupted', () => {
    expect(parseServerMessage('{"type":"reply.done"}')).toEqual({ type: 'reply.done' });
  });

  it('parses tool.call', () => {
    expect(
      parseServerMessage(
        '{"type":"tool.call","tool_call_id":"t1","name":"suggest_car","arguments":"{\\"car_id\\":\\"vezel\\"}"}'
      )
    ).toEqual({
      type: 'tool.call',
      tool_call_id: 't1',
      name: 'suggest_car',
      arguments: '{"car_id":"vezel"}'
    });
  });

  it('parses error', () => {
    expect(parseServerMessage('{"type":"error","message":"boom"}')).toEqual({
      type: 'error',
      message: 'boom'
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseServerMessage('{nope')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseServerMessage('42')).toBeNull();
    expect(parseServerMessage('"hi"')).toBeNull();
    expect(parseServerMessage('null')).toBeNull();
  });

  it('returns null for an unknown type', () => {
    expect(parseServerMessage('{"type":"wat","text":"x"}')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(parseServerMessage('{"type":"tool.call","tool_call_id":"t1","arguments":"{}"}')).toBeNull();
    expect(parseServerMessage('{"type":"reply.audio"}')).toBeNull();
  });

  it('returns null when a required field has the wrong type', () => {
    expect(parseServerMessage('{"type":"tool.call","tool_call_id":"t1","name":7,"arguments":"{}"}')).toBeNull();
    expect(parseServerMessage('{"type":"transcript.user.delta","text":5}')).toBeNull();
    expect(parseServerMessage('{"type":"session.created","session_id":7}')).toBeNull();
  });
});
