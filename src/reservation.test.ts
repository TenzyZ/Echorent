import { describe, expect, it, vi } from 'vitest';
import { isReservationResult, postReservation, requestOutcomeMessage, requestOutcomeNotice, SEARCH_EXPIRED, type ReservationConflict, type ReservationSuccess } from './reservation';

const success: ReservationSuccess = {
  ok: true, demo: true, replayed: false,
  request: {
    request_id: 'ER-1A2B3C4D5E6F', created_at: '2026-09-22T00:00:00Z', status: 'pending',
    car: { car_id: 'demo-dxb-1', airport: 'DXB', name: 'Toyota Corolla', category: 'economy', transmission: 'automatic', seats: 5, bags: 2, daily_rate: 120, currency: 'AED' },
    rental: { airport: 'DXB', airport_name: 'Dubai International', pickup: { date: '2026-10-07', weekday: 'Wednesday', time: '07:00' }, return: { date: '2026-10-10', weekday: 'Saturday', time: '07:00' }, driver_age: 30 },
  },
  notifications: { internal: { status: 'sent' }, traveller: { status: 'sent' } },
};
const conflict: ReservationConflict = {
  ok: false, demo: true, errors: [{ field: 'rental', code: 'existing_request', detail: 'A pending request exists.' }],
  existing_request: { status: 'pending' },
};

describe('reservation client boundary', () => {
  it('accepts pending and existence-only conflict, rejects authority changes and leaked conflict details', () => {
    expect(isReservationResult(success)).toBe(true);
    expect(isReservationResult(conflict)).toBe(true);
    expect(isReservationResult({ ...success, request: { ...success.request, status: 'confirmed' } })).toBe(false);
    expect(isReservationResult({ ...success, request: { ...success.request, email: 'typed@example.test' } })).toBe(false);
    expect(isReservationResult({ ...success, status: 'confirmed' })).toBe(false);
    expect(isReservationResult({ ...conflict, request_id: 'ER-1A2B3C4D5E6F' })).toBe(false);
    expect(isReservationResult({ ...conflict, existing_request: { status: 'approved' } })).toBe(false);
  });

  it('sends raw email only in the dedicated request body and rejects invalid backend status', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return { ok: true, status: 201, json: async () => success };
    }));
    try {
      const released = success.request.rental;
      expect(await postReservation({ pickup_airport: 'DXB' }, 'demo-dxb-1', 'typed@example.test', released)).toEqual(success);
      expect(calls).toEqual([{ search: { pickup_airport: 'DXB' }, car_id: 'demo-dxb-1', email: 'typed@example.test', reviewed_rental: released }]);
      expect(Object.keys(calls[0] as object)).toEqual(['search', 'car_id', 'email', 'reviewed_rental']);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ ...success, request: { ...success.request, status: 'confirmed' } }) })));
      await expect(postReservation({}, 'demo-dxb-1', 'typed@example.test', released)).rejects.toThrow();
    } finally { vi.unstubAllGlobals(); }
  });

  it('surfaces search_expired as its own failure, never as a conflict or pending result', async () => {
    const expired = { ok: false, demo: true, errors: [{ field: 'rental', code: 'search_expired', detail: 'search_expired' }] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => expired })));
    try {
      expect(isReservationResult(expired)).toBe(false);
      await expect(postReservation({}, 'demo-dxb-1', 'typed@example.test', success.request.rental)).rejects.toThrow(SEARCH_EXPIRED);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => conflict })));
      await expect(postReservation({}, 'demo-dxb-1', 'typed@example.test', success.request.rental)).resolves.toEqual(conflict);
    } finally { vi.unstubAllGlobals(); }
  });

  it('speaks one deterministic, grounded outcome from the traveller acknowledgement status only', () => {
    const outcome = (traveller: 'sent' | 'failed', internal: 'sent' | 'failed', replayed = false) =>
      requestOutcomeMessage({ ...success, replayed, notifications: { internal: { status: internal }, traveller: { status: traveller } } });
    const sent = "Your request has been received and is pending human review. I've sent an acknowledgement email, but this is not a confirmed rental yet.";
    const failed = "Your request has been received and is pending human review. I couldn't send the acknowledgement email, but your request is still saved.";
    for (const internal of ['sent', 'failed'] as const) {
      expect(outcome('sent', internal)).toBe(sent);
      expect(outcome('failed', internal)).toBe(failed);
      expect(outcome('sent', internal, true)).toBe('That request was already submitted and is still pending human review.');
      expect(outcome('failed', internal, true)).toBe("That request was already submitted and is still pending human review. I couldn't send the acknowledgement email.");
    }
    expect(requestOutcomeMessage(conflict)).toBe("A pending request already exists for overlapping dates. Changing it isn't available yet. You can choose different dates.");
    for (const result of [
      success, conflict, { ...success, replayed: true },
      { ...success, notifications: { internal: { status: 'failed' as const }, traveller: { status: 'failed' as const } } },
    ]) {
      const message = requestOutcomeMessage(result);
      expect(message).not.toMatch(/@|ER-|\u2014|team|booked|\baccept|approv|shortly|wait time|minutes?|hours?|\b(is|are) (confirmed|reserved|guaranteed)/i);
      expect(message.match(/pending/g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(requestOutcomeNotice(result)).toBe(`Reservation request outcome. Say exactly this to the traveller once, then wait: "${message}"`);
    }
  });
});
