import type { Car } from '../cars';

export function SuggestionCard({
  car,
  note,
  onDismiss,
  onOpenDetails
}: {
  car: Car;
  note: string | null;
  onDismiss: () => void;
  onOpenDetails: () => void;
}) {
  return (
    <article className="card">
      <button
        type="button"
        className="card__close"
        aria-label="Dismiss suggestion"
        onClick={onDismiss}
      >
        ×
      </button>
      <div className="card__main">
        <div className="card__art" aria-hidden="true">
          {car.category
            .split(' ')
            .map((word) => word[0])
            .join('')}
        </div>
        <div className="card__info">
          <h3 className="card__name">{car.name}</h3>
          <p className="card__meta">{car.category}</p>
          <p className="card__meta">
            {car.seats} seats · {car.bags} bags · {car.transmission}
          </p>
        </div>
        <div className="card__price">
          <p className="card__amount">
            {car.currency} {car.pricePerDay}
          </p>
          <p className="card__per">/day</p>
        </div>
      </div>
      <div className="card__foot">
        <p className="card__reason">{note}</p>
        <button type="button" className="card__details" onClick={onOpenDetails}>
          View details
        </button>
      </div>
    </article>
  );
}
