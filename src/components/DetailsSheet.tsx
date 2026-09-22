import { getCars } from '../cars';
import { getLocations } from '../locations';
import type { TripIntent } from '../state/uiState';

export function DetailsSheet({
  trip,
  carId,
  onClose
}: {
  trip: TripIntent;
  carId?: string;
  onClose: () => void;
}) {
  const car = getCars(trip.airport).find((c) => c.id === carId);
  const location = getLocations().find((l) => l.code === trip.airport);
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
            <dd>{location?.name ?? trip.airport ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Dates</dt>
            <dd>{trip.dates ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Passengers</dt>
            <dd>{trip.passengers ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Luggage</dt>
            <dd>{trip.luggage ?? 'Not set'}</dd>
          </div>
          <div className="sheet__row">
            <dt>Car</dt>
            <dd>{car?.name ?? 'Not set'}</dd>
          </div>
        </dl>
        <button type="button" className="sheet__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
