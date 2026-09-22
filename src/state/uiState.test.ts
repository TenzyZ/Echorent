import { describe, expect, it } from 'vitest';
import type { BackendSearchResult } from '../cars';
import { initialState, reduce, type UIState } from './uiState';

const success: BackendSearchResult = {
  ok: true,
  demo: true,
  notice: 'Demo cars and prices, not live availability.',
  rental: {
    airport: 'DXB',
    airport_name: 'Dubai International',
    pickup: { date: '2026-09-24', weekday: 'Thursday', time: '07:00' },
    return: { date: '2026-09-26', weekday: 'Saturday', time: '19:00' },
    driver_age: 24
  },
  cars: [
    { car_id: 'demo-dxb-2', airport: 'DXB', name: 'Nissan X-Trail', category: 'suv', transmission: 'automatic', seats: 5, bags: 4, daily_rate: 210, currency: 'AED' },
    { car_id: 'demo-dxb-1', airport: 'DXB', name: 'Toyota Corolla', category: 'economy', transmission: 'automatic', seats: 5, bags: 2, daily_rate: 120, currency: 'AED' }
  ]
};

describe('UI state', () => {
  it('starts idle without fabricated rental state', () => {
    expect(initialState).toEqual({
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
    });
  });

  it('tracks connecting, ready, microphone, error, and ended phases', () => {
    let state = reduce(initialState, { type: 'session.connecting' });
    expect(state.phase).toBe('connecting');
    state = reduce(state, { type: 'session.open' });
    expect(state).toMatchObject({ phase: 'listening', micOn: true });
    state = reduce(state, { type: 'mic.changed', enabled: false });
    expect(state).toMatchObject({ phase: 'idle', micOn: false });
    state = reduce(state, { type: 'session.error', message: 'Microphone unavailable.' });
    expect(state).toMatchObject({ phase: 'error', micOn: false, error: 'Microphone unavailable.' });
    state = reduce(state, { type: 'ui.end' });
    expect(state).toMatchObject({ phase: 'ended', ended: true, micOn: false });
  });

  it('uses replacement user deltas and starts each agent reply cleanly', () => {
    let state = reduce(initialState, { type: 'user.delta', text: 'a longer guess' });
    state = reduce(state, { type: 'user.delta', text: 'four' });
    expect(state.line).toEqual({ speaker: 'user', text: 'four' });
    state = reduce(state, { type: 'reply.started' });
    state = reduce(state, { type: 'agent.delta', text: 'Here are' });
    state = reduce(state, { type: 'agent.delta', text: 'your cars.' });
    expect(state.line).toEqual({ speaker: 'agent', text: 'Here are your cars.' });
    state = reduce(state, { type: 'reply.done' });
    state = reduce(state, { type: 'reply.started' });
    state = reduce(state, { type: 'agent.delta', text: 'Next reply.' });
    expect(state.line).toEqual({ speaker: 'agent', text: 'Next reply.' });
  });

  it('does not add spaces before punctuation or duplicate supplied whitespace', () => {
    let state = reduce(initialState, { type: 'reply.started' });
    for (const text of ['Hello', ',', ' traveller', '.']) state = reduce(state, { type: 'agent.delta', text });
    expect(state.line?.text).toBe('Hello, traveller.');
  });

  it('renders exactly the backend cars in backend order with backend IDs', () => {
    const state = reduce(initialState, { type: 'search.result', result: success });
    expect(state.cards).toHaveLength(2);
    expect(state.cards.map(({ id }) => id)).toEqual(['demo-dxb-2', 'demo-dxb-1']);
    expect(state.cards[0]).toMatchObject({ name: 'Nissan X-Trail', category: 'SUV', bags: 4, pricePerDay: 210 });
    expect(state.notice).toBe(success.notice);
    expect(state.trip).toEqual({
      airport: 'DXB',
      airportName: 'Dubai International',
      pickup: 'Thursday 2026-09-24 07:00',
      return: 'Saturday 2026-09-26 19:00',
      driverAge: 24
    });
  });

  it('closes stale details on a new successful result', () => {
    const stale: UIState = { ...initialState, detailsOpen: true, detailsCarId: 'old' };
    expect(reduce(stale, { type: 'search.result', result: success })).toMatchObject({
      detailsOpen: false,
      detailsCarId: null
    });
  });

  it('clears cards and details for canonical business failures', () => {
    const populated = reduce(initialState, { type: 'search.result', result: success });
    const open = reduce(populated, { type: 'ui.details.open', carId: 'demo-dxb-2' });
    const failed = reduce(open, {
      type: 'search.result',
      result: { ok: false, demo: true, errors: [{ field: 'driver_age', code: 'driver_underage', detail: 'Driver must be 21.' }] }
    });
    expect(failed).toMatchObject({ cards: [], notice: null, detailsOpen: false, detailsCarId: null });
  });

  it('keeps transitions immutable and ignores events after end', () => {
    const state = reduce(initialState, { type: 'search.result', result: success });
    const before = structuredClone(state);
    const next = reduce(state, { type: 'ui.card.dismiss', carId: 'demo-dxb-2' });
    expect(state).toEqual(before);
    expect(next.cards.map(({ id }) => id)).toEqual(['demo-dxb-1']);
    const ended = reduce(next, { type: 'ui.end' });
    expect(reduce(ended, { type: 'session.open' })).toBe(ended);
  });
});
