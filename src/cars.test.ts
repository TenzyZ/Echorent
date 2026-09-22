import { describe, expect, it } from 'vitest';
import { adaptBackendCar, adaptBackendCars, type BackendCar } from './cars';

const xTrail: BackendCar = {
  car_id: 'demo-dxb-2',
  airport: 'DXB',
  name: 'Nissan X-Trail',
  category: 'suv',
  transmission: 'automatic',
  seats: 5,
  bags: 4,
  daily_rate: 210,
  currency: 'AED'
};

describe('backend car adapter', () => {
  it('maps backend fields and keeps the backend ID', () => {
    expect(adaptBackendCar(xTrail)).toEqual({
      id: 'demo-dxb-2',
      name: 'Nissan X-Trail',
      category: 'SUV',
      transmission: 'Automatic',
      seats: 5,
      bags: 4,
      pricePerDay: 210,
      currency: 'AED'
    });
  });

  it.each([
    ['economy', 'Economy'],
    ['suv', 'SUV'],
    ['premium', 'Premium']
  ])('labels %s as %s', (category, label) => {
    expect(adaptBackendCar({ ...xTrail, category }).category).toBe(label);
  });

  it('shows an unknown category unchanged', () => {
    expect(adaptBackendCar({ ...xTrail, category: 'people carrier' }).category).toBe('people carrier');
  });

  it('preserves count and order', () => {
    const cars = [xTrail, { ...xTrail, car_id: 'demo-dxb-1', name: 'Toyota Corolla' }];
    expect(adaptBackendCars(cars).map(({ id }) => id)).toEqual(['demo-dxb-2', 'demo-dxb-1']);
    expect(adaptBackendCars(cars)).toHaveLength(2);
  });
});
