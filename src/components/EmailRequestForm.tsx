import { useEffect, useId, useRef, useState } from 'react';
import type { BackendCar, BackendRental } from '../cars';

export function EmailRequestForm({ car, rental, submitting, ended = false, failure, onSubmit, onBack }: {
  car: BackendCar;
  rental: BackendRental;
  submitting: boolean;
  ended?: boolean;
  failure?: string;
  onSubmit: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  useEffect(() => { if (!submitting && !ended) input.current?.focus(); }, [submitting, ended, failure]);
  const error = invalid ? 'Enter a valid email address.' : failure;

  return (
    <form className="renter" aria-label="Reservation request" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (submitting || ended) return;
      const value = email.trim();
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || !input.current?.checkValidity()) {
        setInvalid(true);
        input.current?.focus();
        return;
      }
      setInvalid(false);
      onSubmit(value);
    }}>
      <header className="renter__head">
        <h3 className="renter__title">Request this car</h3>
        <p className="renter__context">Pending human review, demo inventory only.</p>
      </header>
      <dl className="request-summary">
        <div><dt>Car</dt><dd>{car.name} ({car.car_id})</dd></div>
        <div><dt>Airport</dt><dd>{rental.airport_name} ({rental.airport})</dd></div>
        <div><dt>Pickup</dt><dd>{rental.pickup.date} at {rental.pickup.time}</dd></div>
        <div><dt>Return</dt><dd>{rental.return.date} at {rental.return.time}</dd></div>
      </dl>
      <div className="renter__fields">
        <label className="renter__field">
          <span className="renter__label">Email</span>
          <span className="renter__entry">
            <input ref={input} className="renter__input" type="email" name="email" autoComplete="email"
              inputMode="email" required value={email} disabled={submitting || ended}
              aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
              onChange={(event) => { setEmail(event.target.value); setInvalid(false); }} />
            <span className="renter__hint">We'll send the agreement to this email.</span>
          </span>
        </label>
        {error && <p id={errorId} className="request-error" role="alert">{error}</p>}
      </div>
      <div className="renter__actions">
        <button className="renter__submit" type="submit" disabled={submitting || ended}>
          {submitting ? 'Sending request...' : ended ? 'Call ended' : 'Send request'}
        </button>
        <button className="request-back" type="button" onClick={onBack} disabled={submitting || ended}>Back to cars</button>
      </div>
    </form>
  );
}
