export type ClientMessage =
  | { type: 'session.update'; session: { agent_id: string } }
  | { type: 'input.audio'; audio: string } // base64 PCM16 24kHz mono
  | { type: 'session.end' }
  | { type: 'conversation.message'; role: 'user' | 'system'; content: string } // typed input
  | { type: 'reply.create' }
  | { type: 'tool.result'; call_id: string; result: string; is_error: boolean }; // result is a JSON string

export type ServerMessage =
  | { type: 'session.ready'; session_id: string }
  | { type: 'session.ended' }
  | { type: 'reply.started' }
  | { type: 'input.speech.started' }
  | { type: 'input.speech.stopped' }
  | { type: 'transcript.user.delta'; text: string } // FULL text so far — supersedes
  | { type: 'transcript.user'; text: string }
  | { type: 'transcript.agent.delta'; delta: string } // incremental — appends
  | { type: 'transcript.agent'; text: string; interrupted: boolean }
  | { type: 'reply.audio'; data: string } // base64 PCM16 24kHz mono
  | { type: 'reply.done'; status: string } // "completed" or "interrupted"
  | { type: 'tool.call'; call_id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'session.error'; code?: string; message: string };

// Required string fields per known server message type.
const requiredStrings: Record<string, string[]> = {
  'session.ready': ['session_id'],
  'session.ended': [],
  'reply.started': [],
  'input.speech.started': [],
  'input.speech.stopped': [],
  'transcript.user.delta': ['text'],
  'transcript.user': ['text'],
  'transcript.agent.delta': ['delta'],
  'transcript.agent': ['text'],
  'reply.audio': ['data'],
  'reply.done': ['status'],
  'tool.call': ['call_id', 'name'],
  'session.error': ['message']
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
  if (rec.type === 'tool.call' && (typeof rec.arguments !== 'object' || rec.arguments === null || Array.isArray(rec.arguments))) return null;
  if (rec.type === 'transcript.agent' && typeof rec.interrupted !== 'boolean') return null;
  for (const field of fields) {
    if (typeof rec[field] !== 'string') return null;
  }
  return msg as ServerMessage;
}
