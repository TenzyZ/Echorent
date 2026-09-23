import { describe, expect, it } from 'vitest';
import type { BackendSearchResult } from '../cars';
import type { ReservationSuccess, ReservationConflict } from '../reservation';
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
const args = { pickup_airport: 'DXB', pickup_date: 'September 24', pickup_time: '07:00', return_date: 'September 26', return_time: '19:00', driver_age: 24 };
const canonical = success as Extract<BackendSearchResult, { ok: true }>;
const pending: ReservationSuccess = {
  ok: true, demo: true, replayed: false,
  request: { request_id: 'ER-1A2B3C4D5E6F', created_at: '2026-09-22T00:00:00Z', status: 'pending', car: canonical.cars[0], rental: canonical.rental },
  notifications: { internal: { status: 'sent' }, traveller: { status: 'sent' } }
};
const conflict: ReservationConflict = { ok: false, demo: true, errors: [{ field: 'rental', code: 'existing_request', detail: 'Pending overlap.' }], existing_request: { status: 'pending' } };

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
      ended: false,
      currentSearch: null,
      request: null,
      optimisticSelection: null
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
    const state = reduce(initialState, { type: 'search.result', args, result: success });
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
    expect(reduce(stale, { type: 'search.result', args, result: success })).toMatchObject({
      detailsOpen: false,
      detailsCarId: null
    });
  });

  it('clears cards and details for canonical business failures', () => {
    const populated = reduce(initialState, { type: 'search.result', args, result: success });
    const open = reduce(populated, { type: 'ui.details.open', carId: 'demo-dxb-2' });
    const failed = reduce(open, {
      type: 'search.result',
      args,
      result: { ok: false, demo: true, errors: [{ field: 'driver_age', code: 'driver_underage', detail: 'Driver must be 21.' }] }
    });
    expect(failed).toMatchObject({ cards: [], notice: null, detailsOpen: false, detailsCarId: null });
  });

  it('keeps transitions immutable and ignores events after end', () => {
    const state = reduce(initialState, { type: 'search.result', args, result: success });
    const before = structuredClone(state);
    const next = reduce(state, { type: 'ui.card.dismiss', carId: 'demo-dxb-2' });
    expect(state).toEqual(before);
    expect(next.cards.map(({ id }) => id)).toEqual(['demo-dxb-1']);
    const ended = reduce(next, { type: 'ui.end' });
    expect(reduce(ended, { type: 'session.open' })).toBe(ended);
  });

  it('selects only a car in the released search and carries exact search arguments', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    expect(searched.currentSearch?.args).toBe(args);
    expect(reduce(searched, { type: 'car.selected', carId: 'stale-car' })).toBe(searched);
    const selected = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' });
    expect(selected.request).toEqual({ phase: 'awaiting_email', carId: 'demo-dxb-2' });
    const failedSearch = reduce(selected, { type: 'search.result', args, result: { ok: false, demo: true, errors: [] } });
    expect(failedSearch.currentSearch).toBeNull();
    expect(reduce(failedSearch, { type: 'car.selected', carId: 'demo-dxb-2' })).toBe(failedSearch);
  });

  it('restores an empty request after the first optimistic selection is interrupted', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const selected = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2', optimistic: true });
    expect(selected.request).toEqual({ phase: 'awaiting_email', carId: 'demo-dxb-2' });
    const restored = reduce(selected, { type: 'car.selection.dropped', carId: 'demo-dxb-2' });
    expect(restored.request).toBeNull();
    expect(restored.optimisticSelection).toBeNull();
  });

  it('restores the exact previous selected request after an interrupted change', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const previous = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' });
    const optimistic = reduce(previous, { type: 'car.selected', carId: 'demo-dxb-1', optimistic: true });
    expect(optimistic.request).toEqual({ phase: 'awaiting_email', carId: 'demo-dxb-1' });
    const restored = reduce(optimistic, { type: 'car.selection.dropped', carId: 'demo-dxb-1' });
    expect(restored.request).toBe(previous.request);
    expect(restored.optimisticSelection).toBeNull();
  });

  it('protects post-submission request states from optimistic selection', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const selected = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' });
    const submitting = reduce(selected, { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 1 });
    const pendingState = reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: pending });
    const replayed = reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: { ...pending, replayed: true } });
    const conflicted = reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: conflict });
    const failed = reduce(submitting, { type: 'reservation.failed', carId: 'demo-dxb-2', submissionId: 1 });
    for (const state of [submitting, pendingState, replayed, conflicted, failed]) {
      expect(reduce(state, { type: 'car.selected', carId: 'demo-dxb-1', optimistic: true })).toBe(state);
    }
  });

  it('keeps a successful changed selection after reply.done', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const previous = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' });
    const optimistic = reduce(previous, { type: 'car.selected', carId: 'demo-dxb-1', optimistic: true });
    const completed = reduce(optimistic, { type: 'reply.done' });
    expect(completed.request).toEqual({ phase: 'awaiting_email', carId: 'demo-dxb-1' });
    expect(completed.optimisticSelection).toBeNull();
    expect(reduce(completed, { type: 'car.selection.dropped', carId: 'demo-dxb-1' })).toBe(completed);
  });

  it('handles pending, replay, conflict, failure, duplicate submit, and stale completion', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const selected = reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' });
    const submitting = reduce(selected, { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 1 });
    expect(submitting.request?.phase).toBe('submitting');
    expect(reduce(submitting, { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 2 })).toBe(submitting);
    expect(reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-1', submissionId: 1, result: pending })).toBe(submitting);
    expect(reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 2, result: pending })).toBe(submitting);
    const completed = reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: pending });
    expect(completed.request?.phase).toBe('pending');
    const replay = reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: { ...pending, replayed: true } });
    expect(replay.request?.phase).toBe('pending');
    if (replay.request?.phase === 'pending') expect(replay.request.result.replayed).toBe(true);
    expect(reduce(submitting, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: conflict }).request?.phase).toBe('conflict');
    const failed = reduce(submitting, { type: 'reservation.failed', carId: 'demo-dxb-2', submissionId: 1 });
    expect(failed.request?.phase).toBe('failed');
    const backed = reduce(failed, { type: 'ui.request.back' });
    expect(backed.request).toBeNull();
    expect(reduce(backed, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: pending })).toBe(backed);
  });

  it('keeps an in-flight submission through voice reselection, Back, and a new search', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    const submitting = reduce(reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' }),
      { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 1 });
    expect(reduce(submitting, { type: 'car.selected', carId: 'demo-dxb-3' })).toBe(submitting);
    expect(reduce(submitting, { type: 'ui.request.back' })).toBe(submitting);
    const newArgs = { ...args, pickup_date: 'October 8' };
    const researched = reduce(submitting, { type: 'search.result', args: newArgs, result: success });
    expect(researched.currentSearch?.args).toBe(newArgs);
    expect(researched.request).toBe(submitting.request);
    const failedSearch = reduce(submitting, { type: 'search.result', args, result: { ok: false, demo: true, errors: [] } });
    expect(failedSearch.currentSearch).toBeNull();
    expect(failedSearch.request).toBe(submitting.request);
    for (const state of [researched, failedSearch]) {
      const completed = reduce(state, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 1, result: pending });
      expect(completed.request).toEqual({ phase: 'pending', carId: 'demo-dxb-2', result: pending });
    }
  });

  it('shows search-again wording when the reviewed search expired', () => {
    const searched = reduce(initialState, { type: 'search.result', args, result: success });
    expect(searched.currentSearch?.result.rental).toBe(success.rental);
    const submitting = reduce(reduce(searched, { type: 'car.selected', carId: 'demo-dxb-2' }),
      { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 4 });
    const expired = reduce(submitting, { type: 'reservation.failed', carId: 'demo-dxb-2', submissionId: 4, expired: true });
    expect(expired.request).toEqual({ phase: 'failed', carId: 'demo-dxb-2', error: 'This search has changed since you reviewed it. Please search again.' });
  });

  it('allows only the started reservation result to update request state after End', () => {
    const selected = reduce(reduce(initialState, { type: 'search.result', args, result: success }), { type: 'car.selected', carId: 'demo-dxb-2' });
    const submitting = reduce(selected, { type: 'ui.request.submit', carId: 'demo-dxb-2', submissionId: 7 });
    const ended = reduce(submitting, { type: 'ui.end' });
    expect(reduce(ended, { type: 'session.open' })).toBe(ended);
    expect(reduce(ended, { type: 'car.selected', carId: 'demo-dxb-1' })).toBe(ended);
    const completed = reduce(ended, { type: 'reservation.result', carId: 'demo-dxb-2', submissionId: 7, result: pending });
    expect(completed.ended).toBe(true);
    expect(completed.request?.phase).toBe('pending');
  });
});
