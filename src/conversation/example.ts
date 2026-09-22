import type { ScriptStep } from './ScriptedDriver';

// The demo conversation for the Storybook story. Data only.
// The first turn sets the pickup airport with the trip facts. The last turn
// moves the pickup to Dubai, so the prices switch to AED. The last turn also
// offers every car, so the slider is part of the demo.
export const exampleConversation: ScriptStep[] = [
  // mic on first, so the orb shows Listening between turns
  { delayMs: 0, event: { type: 'session.open' } },
  { delayMs: 600, event: { type: 'agent.delta', text: 'Where are you picking up?' } },
  { delayMs: 1500, event: { type: 'reply.done' } },
  { delayMs: 2200, event: { type: 'user.speech.started' } },
  { delayMs: 500, event: { type: 'user.delta', text: 'Changi airport, family trip this weekend' } },
  {
    delayMs: 900,
    event: { type: 'user.delta', text: 'Changi airport, family trip this weekend, two kids, one stroller, two big suitcases' }
  },
  { delayMs: 700, event: { type: 'user.speech.stopped' } },
  {
    delayMs: 1200,
    event: { type: 'tool.call', id: 't1', name: 'update_trip', args: { airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 } }
  },
  {
    delayMs: 400,
    event: {
      type: 'tool.call',
      id: 't2',
      name: 'suggest_cars',
      args: {
        cars: [{ car_id: 'hrv', reason: 'Fits your family of four with room for a stroller and three bags.' }]
      }
    }
  },
  { delayMs: 600, event: { type: 'agent.delta', text: 'For your family,' } },
  { delayMs: 700, event: { type: 'agent.delta', text: ' the Honda HR-V gives you the room you need.' } },
  { delayMs: 1600, event: { type: 'reply.done' } },
  { delayMs: 2500, event: { type: 'user.speech.started' } },
  { delayMs: 500, event: { type: 'user.delta', text: 'Something cheaper?' } },
  { delayMs: 600, event: { type: 'user.speech.stopped' } },
  {
    delayMs: 1200,
    event: {
      type: 'tool.call',
      id: 't3',
      name: 'suggest_cars',
      args: {
        cars: [{ car_id: 'corolla', reason: 'The same five seats at a lower daily rate.' }]
      }
    }
  },
  { delayMs: 600, event: { type: 'agent.delta', text: 'The Toyota Corolla Altis keeps five seats and costs less per day.' } },
  { delayMs: 1800, event: { type: 'reply.done' } },
  { delayMs: 2500, event: { type: 'user.speech.started' } },
  { delayMs: 500, event: { type: 'user.delta', text: 'Plans changed. I fly into Dubai instead.' } },
  {
    delayMs: 900,
    event: { type: 'user.delta', text: 'Plans changed. I fly into Dubai instead. Show me everything you have.' }
  },
  { delayMs: 700, event: { type: 'user.speech.stopped' } },
  {
    delayMs: 1200,
    event: { type: 'tool.call', id: 't4', name: 'update_trip', args: { airport: 'DXB' } }
  },
  {
    delayMs: 400,
    event: {
      type: 'tool.call',
      id: 't5',
      name: 'suggest_cars',
      args: {
        cars: [
          { car_id: 'corolla', reason: 'The lowest daily rate.' },
          { car_id: 'xtrail', reason: 'The most room for luggage.' },
          { car_id: 'bmw3', reason: 'A premium sedan with the same five seats.' }
        ]
      }
    }
  },
  { delayMs: 600, event: { type: 'agent.delta', text: 'Here is everything at Dubai International,' } },
  { delayMs: 700, event: { type: 'agent.delta', text: ' priced in dirhams. Swipe the cards to compare.' } },
  { delayMs: 1600, event: { type: 'reply.done' } }
];
