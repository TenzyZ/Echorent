import { useState } from 'react';
import type { User } from '../auth';
import { getCars } from '../cars';

// The renter step of the agreement flow. It appears where the car cards were,
// right after the spoken confirm: type name and email, or take the Google
// shortcut. The drafted agreement follows with the renter populated.
export function RenterForm({
  carId,
  airport,
  onSubmit,
  onSignIn
}: {
  carId: string;
  airport?: string;
  onSubmit: (user: User) => void;
  onSignIn: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const car = getCars(airport).find((c) => c.id === carId);
  const ready = name.trim() !== '' && email.trim() !== '';
  return (
    <form
      className="renter"
      aria-label="Renter details"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ name: name.trim(), email: email.trim() });
      }}
    >
      <header className="renter__head">
        <h3 className="renter__title">Renter details</h3>
        <p className="renter__context">
          {car ? `${car.name} · ${car.currency} ${car.pricePerDay} / day` : 'Car to be confirmed'}
        </p>
      </header>
      <div className="renter__fields">
        <label className="renter__field">
          <span className="renter__label">Name</span>
          <input
            className="renter__input"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Amirah Tan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="renter__field">
          <span className="renter__label">Email</span>
          <input
            className="renter__input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      <div className="renter__or" aria-hidden="true">or</div>
      <button type="button" className="renter__google" onClick={onSignIn}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        <span>Continue with Google</span>
      </button>
      <button type="submit" className="renter__submit" disabled={!ready}>
        Continue
      </button>
    </form>
  );
}
