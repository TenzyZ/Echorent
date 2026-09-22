import { getCars } from '../cars';
import type { Suggestion } from '../state/uiState';

export function SuggestionCard({
  card,
  airport,
  onDismiss,
  onOpenDetails
}: {
  card: Suggestion;
  airport?: string;
  onDismiss: () => void;
  onOpenDetails: () => void;
}) {
  const car = getCars(airport).find((c) => c.id === card.carId);
  if (!car) return null;
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
          <p className="card__meta">or similar</p>
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
        <p className="card__reason">{card.reason}</p>
        <button type="button" className="card__details" onClick={onOpenDetails}>
          View details
        </button>
      </div>
    </article>
  );
}
