import { adaptBackendCars, type BackendSearchResult, type Car } from '../cars';

export interface TripIntent {
  airport?: string;
  airportName?: string;
  pickup?: string;
  return?: string;
  driverAge?: number;
}

export interface TranscriptLine {
  speaker: 'user' | 'agent';
  text: string;
}

export type Phase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'ended';

export interface UIState {
  phase: Phase;
  micOn: boolean;
  trip: TripIntent;
  cards: Car[];
  notice: string | null;
  detailsOpen: boolean;
  detailsCarId: string | null;
  line: TranscriptLine | null;
  error: string | null;
  ended: boolean;
}

export const initialState: UIState = {
  phase: 'idle',
  micOn: false,
  trip: {},
  cards: [],
  notice: null,
  detailsOpen: false,
  detailsCarId: null,
  line: null,
  error: null,
  ended: false
};

export type UIEvent =
  | { type: 'session.connecting' }
  | { type: 'session.open' }
  | { type: 'session.error'; message: string }
  | { type: 'session.closed' }
  | { type: 'mic.changed'; enabled: boolean }
  | { type: 'user.speech.started' }
  | { type: 'user.speech.stopped' }
  | { type: 'user.delta'; text: string }
  | { type: 'agent.delta'; text: string }
  | { type: 'agent.final'; text: string }
  | { type: 'reply.started' }
  | { type: 'reply.interrupted' }
  | { type: 'reply.done' }
  | { type: 'tool.call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'search.result'; result: BackendSearchResult }
  | { type: 'ui.text.submit'; text: string }
  | { type: 'ui.card.dismiss'; carId?: string }
  | { type: 'ui.details.open'; carId?: string }
  | { type: 'ui.details.close' }
  | { type: 'ui.end' };

function appendDelta(current: string, delta: string): string {
  if (!current) return delta.trimStart();
  if (!delta) return current;
  if (/\s$/.test(current) || /^\s|^[,.;:!?)]/.test(delta)) return current + delta;
  return `${current} ${delta}`;
}

export function reduce(state: UIState, event: UIEvent): UIState {
  if (state.ended) return state;
  switch (event.type) {
    case 'session.connecting':
      return { ...state, phase: 'connecting', error: null };
    case 'session.open':
      return { ...state, micOn: true, phase: 'listening', error: null };
    case 'session.error':
      return { ...state, micOn: false, phase: 'error', error: event.message };
    case 'session.closed':
    case 'ui.end':
      return { ...state, ended: true, micOn: false, phase: 'ended', line: null };
    case 'mic.changed':
      return {
        ...state,
        micOn: event.enabled,
        phase: state.phase === 'speaking' || state.phase === 'thinking'
          ? state.phase
          : event.enabled ? 'listening' : 'idle'
      };
    case 'user.speech.started':
      return { ...state, phase: 'listening' };
    case 'user.speech.stopped':
      return { ...state, phase: 'thinking' };
    case 'user.delta':
      return { ...state, line: { speaker: 'user', text: event.text } };
    case 'reply.started':
      return { ...state, phase: 'thinking', line: { speaker: 'agent', text: '' } };
    case 'agent.delta':
      return {
        ...state,
        phase: 'speaking',
        line: {
          speaker: 'agent',
          text: state.line?.speaker === 'agent' ? appendDelta(state.line.text, event.text) : event.text.trimStart()
        }
      };
    case 'agent.final':
      return { ...state, line: { speaker: 'agent', text: event.text } };
    case 'reply.interrupted':
    case 'reply.done':
      return { ...state, phase: state.micOn ? 'listening' : 'idle' };
    case 'search.result':
      if (!event.result.ok) {
        return { ...state, cards: [], notice: null, detailsOpen: false, detailsCarId: null };
      }
      return {
        ...state,
        trip: {
          airport: event.result.rental.airport,
          airportName: event.result.rental.airport_name,
          pickup: `${event.result.rental.pickup.weekday} ${event.result.rental.pickup.date} ${event.result.rental.pickup.time}`,
          return: `${event.result.rental.return.weekday} ${event.result.rental.return.date} ${event.result.rental.return.time}`,
          driverAge: event.result.rental.driver_age
        },
        cards: adaptBackendCars(event.result.cars),
        notice: event.result.notice,
        detailsOpen: false,
        detailsCarId: null
      };
    case 'tool.call':
      return state;
    case 'ui.text.submit':
      return { ...state, line: { speaker: 'user', text: event.text }, phase: 'thinking' };
    case 'ui.card.dismiss':
      return { ...state, cards: event.carId ? state.cards.filter((car) => car.id !== event.carId) : [] };
    case 'ui.details.open':
      return {
        ...state,
        detailsOpen: true,
        detailsCarId: event.carId ?? state.cards[0]?.id ?? null
      };
    case 'ui.details.close':
      return { ...state, detailsOpen: false };
  }
}
