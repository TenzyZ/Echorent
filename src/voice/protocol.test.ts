import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './protocol';

describe('parseServerMessage', () => {
  it('parses session.ready', () => {
    expect(parseServerMessage('{"type":"session.ready","session_id":"s1"}')).toEqual({
      type: 'session.ready',
      session_id: 's1'
    });
  });

  it('parses session.ended', () => {
    expect(parseServerMessage('{"type":"session.ended"}')).toEqual({ type: 'session.ended' });
  });

  it('parses reply.started', () => {
    expect(parseServerMessage('{"type":"reply.started"}')).toEqual({ type: 'reply.started' });
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
    expect(parseServerMessage('{"type":"transcript.agent.delta","delta":" Vezel"}')).toEqual({
      type: 'transcript.agent.delta',
      delta: ' Vezel'
    });
  });

  it('parses reply.audio', () => {
    expect(parseServerMessage('{"type":"reply.audio","data":"AAA="}')).toEqual({
      type: 'reply.audio',
      data: 'AAA='
    });
  });

  it('parses reply.done interrupted', () => {
    expect(parseServerMessage('{"type":"reply.done","status":"interrupted"}')).toEqual({
      type: 'reply.done',
      status: 'interrupted'
    });
  });

  it('parses reply.done completed', () => {
    expect(parseServerMessage('{"type":"reply.done","status":"completed"}')).toEqual({
      type: 'reply.done',
      status: 'completed'
    });
  });

  it('parses tool.call with object arguments', () => {
    expect(
      parseServerMessage(
        '{"type":"tool.call","call_id":"t1","name":"suggest_cars","arguments":{"cars":[{"car_id":"vezel"}]}}'
      )
    ).toEqual({
      type: 'tool.call',
      call_id: 't1',
      name: 'suggest_cars',
      arguments: { cars: [{ car_id: 'vezel' }] }
    });
  });

  it('parses session.error', () => {
    expect(parseServerMessage('{"type":"session.error","code":"invalid_format","message":"boom"}')).toEqual({
      type: 'session.error',
      code: 'invalid_format',
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
    expect(parseServerMessage('{"type":"tool.call","call_id":"t1","arguments":{}}')).toBeNull();
    expect(parseServerMessage('{"type":"reply.audio"}')).toBeNull();
    expect(parseServerMessage('{"type":"reply.done"}')).toBeNull();
  });

  it('returns null when a required field has the wrong type', () => {
    expect(parseServerMessage('{"type":"tool.call","call_id":"t1","name":7,"arguments":{}}')).toBeNull();
    expect(parseServerMessage('{"type":"transcript.user.delta","text":5}')).toBeNull();
    expect(parseServerMessage('{"type":"session.ready","session_id":7}')).toBeNull();
  });

  it('returns null when tool.call arguments is not an object', () => {
    expect(
      parseServerMessage('{"type":"tool.call","call_id":"t1","name":"x","arguments":"{\\"a\\":1}"}')
    ).toBeNull();
    expect(parseServerMessage('{"type":"tool.call","call_id":"t1","name":"x","arguments":null}')).toBeNull();
  });
});
