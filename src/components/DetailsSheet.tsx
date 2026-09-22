import type { Car } from '../cars';
import type { TripIntent } from '../state/uiState';

export function DetailsSheet({
  trip,
  car,
  onClose
}: {
  trip: TripIntent;
  car?: Car;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Trip details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <h2 className="sheet__title">Trip details</h2>
        <dl className="sheet__rows">
          <div className="sheet__row">
            <dt>Airport</dt>
            <dd>{trip.airportName ?? trip.airport ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Pickup</dt>
            <dd>{trip.pickup ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Return</dt>
            <dd>{trip.return ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Driver age</dt>
            <dd>{trip.driverAge ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Car</dt>
            <dd>{car?.name ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Rate</dt>
            <dd>{car ? `${car.currency} ${car.pricePerDay} / day` : 'Not set'}</dd>
          </div>
        </dl>
        <button type="button" className="sheet__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
