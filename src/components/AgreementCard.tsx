import type { User } from '../auth';
import { getCars } from '../cars';
import type { Agreement, TripIntent } from '../state/uiState';

// The drafted agreement. It appears where the car cards were, once the
// renter details are in, with the renter populated. Details live behind
// "View details"; Submit sends the draft to the backend.
export function AgreementCard({
  agreement,
  trip,
  user,
  submitting,
  leaving,
  onSubmit,
  onOpenDetails
}: {
  agreement: Agreement;
  trip: TripIntent;
  user: User;
  submitting: boolean;
  leaving: boolean;
  onSubmit: () => void;
  onOpenDetails: (carId: string) => void;
}) {
  const car = getCars(trip.airport).find((c) => c.id === agreement.carId);
  return (
    <article
      className={'agreement' + (leaving ? ' agreement--leaving' : '')}
      aria-label="Rental agreement"
    >
      <header className="agreement__head">
        <h3 className="agreement__title">Rental agreement</h3>
        <span className="agreement__status">Draft</span>
      </header>
      <div className="agreement__main">
        <div className="card__art" aria-hidden="true">
          {car?.category
            .split(' ')
            .map((word) => word[0])
            .join('') ?? '··'}
        </div>
        <div className="card__info">
          <p className="agreement__name">{car?.name ?? 'Not set'}</p>
          <p className="agreement__meta">
            {car ? `${car.currency} ${car.pricePerDay} / day · or similar` : 'Car to be confirmed'}
          </p>
        </div>
      </div>
      <div className="agreement__renter">
        <p className="agreement__label">Renter</p>
        <div className="agreement__user">
          <span className="agreement__avatar" aria-hidden="true">{user.name[0]}</span>
          <span className="agreement__who">
            <span className="agreement__username">{user.name}</span>
            <span className="agreement__usermail">{user.email}</span>
          </span>
        </div>
      </div>
      <div className="agreement__foot">
        <button
          type="button"
          className="card__details"
          onClick={() => onOpenDetails(agreement.carId)}
        >
          View details
        </button>
        <button
          type="button"
          className="agreement__submit"
          disabled={submitting}
          onClick={onSubmit}
        >
          Submit
        </button>
      </div>
    </article>
  );
}
