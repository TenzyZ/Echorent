import type { BackendSearchResult } from '../cars';
import type { ScriptStep } from './ScriptedDriver';

const dxbResult: BackendSearchResult = {
  ok: true,
  demo: true,
  notice: 'Demo cars and prices, not live availability.',
  rental: {
    airport: 'DXB',
    airport_name: 'Dubai International',
    pickup: { date: '2026-09-24', weekday: 'Thursday', time: '07:00' },
    return: { date: '2026-09-26', weekday: 'Saturday', time: '19:00' },
    driver_age: 24
  },
  cars: [
    { car_id: 'demo-dxb-1', airport: 'DXB', name: 'Toyota Corolla', category: 'economy', transmission: 'automatic', seats: 5, bags: 2, daily_rate: 120, currency: 'AED' },
    { car_id: 'demo-dxb-2', airport: 'DXB', name: 'Nissan X-Trail', category: 'suv', transmission: 'automatic', seats: 5, bags: 4, daily_rate: 210, currency: 'AED' },
    { car_id: 'demo-dxb-3', airport: 'DXB', name: 'BMW 3 Series', category: 'premium', transmission: 'automatic', seats: 5, bags: 2, daily_rate: 320, currency: 'AED' }
  ]
};

export const exampleConversation: ScriptStep[] = [
  { delayMs: 0, event: { type: 'session.open' } },
  { delayMs: 400, event: { type: 'reply.started' } },
  { delayMs: 300, event: { type: 'agent.delta', text: "Hey, welcome to EchoRent. I'm Shen." } },
  { delayMs: 900, event: { type: 'reply.done' } },
  { delayMs: 1400, event: { type: 'user.speech.started' } },
  { delayMs: 400, event: { type: 'user.delta', text: 'Dubai, September 24 at 7, back September 26 at 19:00. I am 24.' } },
  { delayMs: 500, event: { type: 'user.speech.stopped' } },
  { delayMs: 800, event: { type: 'search.result', args: {
    pickup_airport: 'DXB', pickup_date: 'September 24', pickup_time: '07:00',
    return_date: 'September 26', return_time: '19:00', driver_age: 24
  }, result: dxbResult } },
  { delayMs: 300, event: { type: 'reply.started' } },
  { delayMs: 300, event: { type: 'agent.delta', text: 'I found three demo cars at Dubai International.' } },
  { delayMs: 900, event: { type: 'reply.done' } },
  { delayMs: 1400, event: { type: 'user.speech.started' } },
  { delayMs: 400, event: { type: 'user.delta', text: 'The Nissan X-Trail works for me.' } },
  { delayMs: 500, event: { type: 'user.speech.stopped' } },
  { delayMs: 500, event: { type: 'reply.started' } },
  { delayMs: 300, event: { type: 'car.selected', carId: 'demo-dxb-2' } },
  { delayMs: 300, event: { type: 'agent.delta', text: 'Please type your email on screen to send a request.' } },
  { delayMs: 900, event: { type: 'reply.done' } }
];
