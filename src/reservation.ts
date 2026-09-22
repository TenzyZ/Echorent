import { isBackendSearchResult, type BackendCar, type BackendRental } from './cars';

export interface PendingRequest {
  request_id: string;
  created_at: string;
  status: 'pending';
  car: BackendCar;
  rental: BackendRental;
}

export interface ReservationSuccess {
  ok: true;
  demo: true;
  replayed: boolean;
  request: PendingRequest;
  notifications: { internal: { status: 'sent' | 'failed' }; traveller: { status: 'sent' | 'failed' } };
}

export interface ReservationConflict {
  ok: false;
  demo: true;
  errors: [{ field: 'rental'; code: 'existing_request'; detail: string }];
  existing_request: { status: 'pending' };
}

export type ReservationResult = ReservationSuccess | ReservationConflict;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function status(value: unknown): value is { status: 'sent' | 'failed' } {
  return record(value) && keys(value, ['status']) && (value.status === 'sent' || value.status === 'failed');
}

export function isReservationResult(value: unknown): value is ReservationResult {
  if (!record(value) || value.demo !== true || typeof value.ok !== 'boolean') return false;
  if (value.ok) {
    const request = value.request;
    const notifications = value.notifications;
    return keys(value, ['ok', 'demo', 'replayed', 'request', 'notifications'])
      && typeof value.replayed === 'boolean' && record(request)
      && keys(request, ['request_id', 'created_at', 'status', 'car', 'rental'])
      && request.status === 'pending'
      && typeof request.request_id === 'string' && /^ER-[0-9A-F]{12}$/.test(request.request_id)
      && typeof request.created_at === 'string' && record(notifications)
      && keys(notifications, ['internal', 'traveller'])
      && status(notifications.internal) && status(notifications.traveller)
      && record(request.car) && keys(request.car, ['car_id', 'airport', 'name', 'category', 'transmission', 'seats', 'bags', 'daily_rate', 'currency'])
      && record(request.rental) && keys(request.rental, ['airport', 'airport_name', 'pickup', 'return', 'driver_age'])
      && record(request.rental.pickup) && keys(request.rental.pickup, ['date', 'weekday', 'time'])
      && record(request.rental.return) && keys(request.rental.return, ['date', 'weekday', 'time'])
      && isBackendSearchResult({ ok: true, demo: true, notice: '', rental: request.rental, cars: [request.car] });
  }
  return keys(value, ['ok', 'demo', 'errors', 'existing_request'])
    && Array.isArray(value.errors) && value.errors.length === 1
    && record(value.errors[0]) && keys(value.errors[0], ['field', 'code', 'detail']) && value.errors[0].field === 'rental'
    && value.errors[0].code === 'existing_request' && typeof value.errors[0].detail === 'string'
    && record(value.existing_request) && Object.keys(value.existing_request).length === 1
    && value.existing_request.status === 'pending';
}

export const SEARCH_EXPIRED = 'search_expired';

export async function postReservation(search: Record<string, unknown>, carId: string, email: string, reviewedRental: BackendRental): Promise<ReservationResult> {
  const response = await fetch('/api/reservation_requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search, car_id: carId, email, reviewed_rental: reviewedRental })
  });
  const body: unknown = await response.json();
  if (response.status === 409 && record(body) && Array.isArray(body.errors)
    && record(body.errors[0]) && body.errors[0].code === SEARCH_EXPIRED) {
    throw new Error(SEARCH_EXPIRED);
  }
  if (!isReservationResult(body) || (response.status === 409 ? body.ok : !response.ok || !body.ok)) {
    throw new Error('Reservation response unavailable.');
  }
  return body;
}

export function requestOutcomeMessage(result: ReservationResult): string {
  if (!result.ok) return "A pending request already exists for overlapping dates. Changing it isn't available yet. You can choose different dates.";
  // Team notification status is operator-only; the traveller hears only their own acknowledgement.
  const sent = result.notifications.traveller.status === 'sent';
  if (result.replayed) {
    return sent ? 'That request was already submitted and is still pending human review.'
      : "That request was already submitted and is still pending human review. I couldn't send the acknowledgement email.";
  }
  return sent
    ? "Your request has been received and is pending human review. I've sent an acknowledgement email, but this is not a confirmed rental yet."
    : "Your request has been received and is pending human review. I couldn't send the acknowledgement email, but your request is still saved.";
}

// Shen speaks the backend-derived outcome verbatim, once, instead of improvising provider state.
export function requestOutcomeNotice(result: ReservationResult): string {
  return `Reservation request outcome. Say exactly this to the traveller once, then wait: "${requestOutcomeMessage(result)}"`;
}
