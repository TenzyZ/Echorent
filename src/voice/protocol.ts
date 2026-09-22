export type ClientMessage =
  | { type: 'session.update'; session: { agent: { agent_id: string } } }
  | { type: 'input_audio_buffer.append'; audio: string } // base64 PCM16 24kHz mono
  | { type: 'input_audio_buffer.terminate' }
  | { type: 'input_text.message'; text: string } // typed input from the keyboard
  | { type: 'tool.result'; tool_call_id: string; output: string };

export type ServerMessage =
  | { type: 'session.created'; session_id: string }
  | { type: 'input.speech.started' }
  | { type: 'input.speech.stopped' }
  | { type: 'transcript.user.delta'; text: string } // FULL text so far — supersedes
  | { type: 'transcript.agent.delta'; text: string } // incremental — appends
  | { type: 'reply.audio'; audio: string } // base64 PCM16 24kHz mono
  | { type: 'reply.done'; interrupted?: boolean }
  | { type: 'tool.call'; tool_call_id: string; name: string; arguments: string } // arguments is a JSON string
  | { type: 'error'; message: string };

// Required string fields per known server message type.
const requiredStrings: Record<string, string[]> = {
  'session.created': ['session_id'],
  'input.speech.started': [],
  'input.speech.stopped': [],
  'transcript.user.delta': ['text'],
  'transcript.agent.delta': ['text'],
  'reply.audio': ['audio'],
  'reply.done': [],
  'tool.call': ['tool_call_id', 'name', 'arguments'],
  'error': ['message']
};

export function parseServerMessage(data: string): ServerMessage | null {
  let msg: unknown;
  try {
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null) return null;
  const rec = msg as Record<string, unknown>;
  const fields = typeof rec.type === 'string' ? requiredStrings[rec.type] : undefined;
  if (fields === undefined) return null;
  if (rec.type === 'reply.done' && 'interrupted' in rec && typeof rec.interrupted !== 'boolean') return null;
  for (const field of fields) {
    if (typeof rec[field] !== 'string') return null;
  }
  return msg as ServerMessage;
}
