import type { ReservationResult } from '../reservation';

export function RequestStatusCard({ result, onBack, ended = false }: { result: ReservationResult; onBack: () => void; ended?: boolean }) {
  if (!result.ok) return (
    <article className="agreement" aria-label="Existing reservation request">
      <header className="agreement__head">
        <h3 className="agreement__title">Existing reservation request</h3>
        <span className="agreement__status">Pending review</span>
      </header>
      <p className="request-status-text">You already have a pending request for overlapping dates. Changing a submitted request isn't available yet. Choose different dates for another request.</p>
      <button className="request-back" type="button" onClick={onBack} disabled={ended}>Back to cars</button>
    </article>
  );
  const { request, notifications, replayed } = result;
  return (
    <article className="agreement" aria-label="Reservation request status">
      <header className="agreement__head">
        <h3 className="agreement__title">{replayed ? 'Request already submitted' : 'Request received'}</h3>
        <span className="agreement__status">Pending review</span>
      </header>
      <p className="request-status-text">Request ID: {request.request_id}</p>
      <dl className="request-summary">
        <div><dt>Car</dt><dd>{request.car.name} ({request.car.car_id})</dd></div>
        <div><dt>Airport</dt><dd>{request.rental.airport_name} ({request.rental.airport})</dd></div>
        <div><dt>Pickup</dt><dd>{request.rental.pickup.date} at {request.rental.pickup.time}</dd></div>
        <div><dt>Return</dt><dd>{request.rental.return.date} at {request.rental.return.time}</dd></div>
      </dl>
      <p className="request-status-text">Your request is saved and waiting for human review. The car is not reserved or guaranteed.</p>
      <p className="request-status-text">Email acknowledgement: {notifications.traveller.status === 'sent' ? 'Sent' : 'Could not be sent'}</p>
      <button className="request-back" type="button" onClick={onBack} disabled={ended}>Back to cars</button>
    </article>
  );
}
