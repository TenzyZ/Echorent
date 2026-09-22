// The one car contract both sides of the EchoRent flow share.
// The UI reads cars only through getCars(). The stub API in server/ serves
// the same data from shared/cars.json, keyed by airport code.
import cars from '../shared/cars.json';

export interface Car {
  id: string;
  name: string;
  category: string;
  transmission: string;
  seats: number;
  bags: number;
  pricePerDay: number;
  currency: string;
}

// Fake cars for now, priced in the currency of the airport. When the real
// backend is live, replace the body with
// `await fetch(`/api/cars?airport=${airport}`).then(r => r.json())`.
// No UI change is necessary.
export function getCars(airport?: string): Car[] {
  if (!airport) return [];
  return (cars as Record<string, Car[]>)[airport] ?? [];
}
