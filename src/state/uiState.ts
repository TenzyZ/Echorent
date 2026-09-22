export interface TripIntent {
  airport?: string;
  dates?: string;
  passengers?: number;
  luggage?: number;
}
export interface Suggestion {
  carId: string;
  reason: string;
}
export interface Agreement {
  carId: string;
}
export interface TranscriptLine {
  speaker: 'user' | 'agent';
  text: string;
}
export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface UIState {
  phase: Phase;
  micOn: boolean;
  trip: TripIntent;
  cards: Suggestion[];
  agreement: Agreement | null;
  submitted: boolean;
  detailsOpen: boolean;
  detailsCarId: string | null;
  line: TranscriptLine | null;
  ended: boolean;
}

export const initialState: UIState = {
  phase: 'idle',
  micOn: false,
  trip: {},
  cards: [],
  agreement: null,
  submitted: false,
  detailsOpen: false,
  detailsCarId: null,
  line: null,
  ended: false
};

export type UIEvent =
  // driver events (live WebSocket or scripted Storybook driver)
  | { type: 'session.open' }
  | { type: 'user.speech.started' }
  | { type: 'user.speech.stopped' }
  | { type: 'user.delta'; text: string } // replaces the user line (supersede semantics)
  | { type: 'agent.delta'; text: string } // appends to the agent line
  | { type: 'reply.interrupted' }
  | { type: 'reply.done' }
  | { type: 'tool.call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'session.closed' }
  // ui events
  | { type: 'ui.mic.toggle' }
  | { type: 'ui.text.submit'; text: string }
  | { type: 'ui.card.dismiss'; carId?: string }
  | { type: 'ui.details.open'; carId?: string }
  | { type: 'ui.details.close' }
  | { type: 'ui.agreement.submit' }
  | { type: 'ui.end' };

export function reduce(state: UIState, event: UIEvent): UIState {
  if (state.ended) return state;
  switch (event.type) {
    case 'session.open':
      return { ...state, micOn: true, phase: 'listening' };
    case 'user.speech.started':
      return { ...state, phase: 'listening' };
    case 'user.speech.stopped':
      return { ...state, phase: 'thinking' };
    case 'user.delta':
      return { ...state, line: { speaker: 'user', text: event.text } };
    case 'agent.delta':
      return {
        ...state,
        phase: 'speaking',
        line:
          state.line?.speaker === 'agent'
            ? { speaker: 'agent', text: state.line.text + event.text }
            : { speaker: 'agent', text: event.text }
      };
    case 'reply.interrupted':
    case 'reply.done':
      return { ...state, phase: state.micOn ? 'listening' : 'idle' };
    case 'tool.call':
      if (event.name === 'update_trip') {
        const trip = { ...state.trip };
        if (typeof event.args.airport === 'string') trip.airport = event.args.airport;
        if (typeof event.args.dates === 'string') trip.dates = event.args.dates;
        if (typeof event.args.passengers === 'number') trip.passengers = event.args.passengers;
        if (typeof event.args.luggage === 'number') trip.luggage = event.args.luggage;
        return { ...state, trip };
      }
      if (event.name === 'suggest_cars') {
        if (!Array.isArray(event.args.cars)) return state;
        const cards: Suggestion[] = [];
        for (const entry of event.args.cars) {
          const carId = String((entry as Record<string, unknown>)?.car_id ?? '');
          if (cards.some((c) => c.carId === carId)) continue;
          cards.push({ carId, reason: String((entry as Record<string, unknown>)?.reason ?? '') });
        }
        // New suggestions end any drafted agreement.
        return { ...state, cards, agreement: null };
      }
      if (event.name === 'draft_agreement') {
        if (typeof event.args.car_id !== 'string' || !event.args.car_id) return state;
        return { ...state, agreement: { carId: event.args.car_id } };
      }
      return state;
    case 'session.closed':
      return { ...state, ended: true };
    case 'ui.mic.toggle': {
      const micOn = !state.micOn;
      return { ...state, micOn, phase: micOn ? 'listening' : 'idle' };
    }
    case 'ui.text.submit':
      return { ...state, line: { speaker: 'user', text: event.text }, phase: 'thinking' };
    case 'ui.card.dismiss':
      return {
        ...state,
        cards: event.carId ? state.cards.filter((c) => c.carId !== event.carId) : []
      };
    case 'ui.details.open':
      return {
        ...state,
        detailsOpen: true,
        detailsCarId: event.carId ?? state.cards[0]?.carId ?? null
      };
    case 'ui.details.close':
      return { ...state, detailsOpen: false };
    case 'ui.agreement.submit':
      // The stage is done: no cards, no agreement, the orb takes over.
      return { ...state, cards: [], agreement: null, submitted: true };
    case 'ui.end':
      return { ...state, ended: true, micOn: false, phase: 'idle', line: null };
  }
}
