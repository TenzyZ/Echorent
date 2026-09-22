export interface BackendCar {
  car_id: string;
  airport: string;
  name: string;
  category: string;
  transmission: string;
  seats: number;
  bags: number;
  daily_rate: number;
  currency: string;
}

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

export interface BackendRental {
  airport: string;
  airport_name: string;
  pickup: { date: string; weekday: string; time: string };
  return: { date: string; weekday: string; time: string };
  driver_age: number;
}

export type BackendSearchResult =
  | { ok: true; demo: true; notice: string; rental: BackendRental; cars: BackendCar[] }
  | { ok: false; demo: true; errors: { field: string; code: string; detail: string }[] };

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Economy',
  suv: 'SUV',
  premium: 'Premium'
};

export function adaptBackendCar(car: BackendCar): Car {
  return {
    id: car.car_id,
    name: car.name,
    category: CATEGORY_LABELS[car.category] ?? car.category,
    transmission: car.transmission === 'automatic' ? 'Automatic' : car.transmission,
    seats: car.seats,
    bags: car.bags,
    pricePerDay: car.daily_rate,
    currency: car.currency
  };
}

export function adaptBackendCars(cars: BackendCar[]): Car[] {
  return cars.map(adaptBackendCar);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBackendCar(value: unknown): value is BackendCar {
  if (!isRecord(value)) return false;
  return ['car_id', 'airport', 'name', 'category', 'transmission', 'currency'].every(
    (key) => typeof value[key] === 'string'
  ) && ['seats', 'bags', 'daily_rate'].every((key) => typeof value[key] === 'number');
}

export function isBackendSearchResult(value: unknown): value is BackendSearchResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || value.demo !== true) return false;
  if (!value.ok) {
    return Array.isArray(value.errors) && value.errors.every((entry) =>
      isRecord(entry) && typeof entry.field === 'string' && typeof entry.code === 'string' && typeof entry.detail === 'string'
    );
  }
  if (typeof value.notice !== 'string' || !Array.isArray(value.cars) || !value.cars.every(isBackendCar) || !isRecord(value.rental)) {
    return false;
  }
  const pickup = value.rental.pickup;
  const returned = value.rental.return;
  return typeof value.rental.airport === 'string'
    && typeof value.rental.airport_name === 'string'
    && typeof value.rental.driver_age === 'number'
    && isRecord(pickup)
    && isRecord(returned)
    && ['date', 'weekday', 'time'].every((key) => typeof pickup[key] === 'string' && typeof returned[key] === 'string');
}
