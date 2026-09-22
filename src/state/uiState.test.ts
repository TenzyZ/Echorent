import { describe, expect, it } from 'vitest';
import { initialState, reduce, type UIEvent, type UIState } from './uiState';

describe('initialState', () => {
  it('starts idle', () => {
    expect(initialState).toEqual({
      phase: 'idle',
      micOn: false,
      trip: {},
      cards: [],
      agreement: null,
      submitted: false,
      detailsOpen: false,
      detailsCarId: null,
      line: null,
      ended: false
    });
  });
});

describe('reduce', () => {
  it('never mutates the input state', () => {
    const s: UIState = {
      ...initialState,
      trip: { dates: 'Today' },
      line: { speaker: 'agent', text: 'Hi' }
    };
    const before = structuredClone(s);
    reduce(s, { type: 'tool.call', id: 't', name: 'update_trip', args: { passengers: 2 } });
    reduce(s, { type: 'agent.delta', text: ' there' });
    reduce(s, { type: 'ui.end' });
    expect(s).toEqual(before);
  });

  it('ignores every event after the session ended', () => {
    const ended = reduce(reduce(initialState, { type: 'session.open' }), { type: 'ui.end' });
    const events: UIEvent[] = [
      { type: 'session.open' },
      { type: 'user.speech.started' },
      { type: 'user.delta', text: 'hi' },
      { type: 'agent.delta', text: 'hi' },
      { type: 'reply.done' },
      { type: 'tool.call', id: 't', name: 'update_trip', args: { passengers: 2 } },
      { type: 'ui.mic.toggle' },
      { type: 'session.closed' },
      { type: 'ui.end' }
    ];
    for (const event of events) {
      expect(reduce(ended, event)).toBe(ended);
    }
  });

  it('session.open turns the mic on and listens', () => {
    const s = reduce(initialState, { type: 'session.open' });
    expect(s.micOn).toBe(true);
    expect(s.phase).toBe('listening');
  });

  it('user.speech.started listens', () => {
    expect(reduce(initialState, { type: 'user.speech.started' }).phase).toBe('listening');
  });

  it('user.speech.stopped thinks', () => {
    const s = reduce(reduce(initialState, { type: 'session.open' }), { type: 'user.speech.stopped' });
    expect(s.phase).toBe('thinking');
  });

  it('user.delta replaces the user line, even with shorter text', () => {
    const s = reduce(
      reduce(initialState, { type: 'user.delta', text: 'a much longer earlier guess' }),
      { type: 'user.delta', text: 'four' }
    );
    expect(s.line).toEqual({ speaker: 'user', text: 'four' });
  });

  it('agent.delta appends to an agent line and speaks', () => {
    const first = reduce(initialState, { type: 'agent.delta', text: 'A' });
    expect(first.line).toEqual({ speaker: 'agent', text: 'A' });
    expect(first.phase).toBe('speaking');
    const second = reduce(first, { type: 'agent.delta', text: ' Honda Vezel' });
    expect(second.line).toEqual({ speaker: 'agent', text: 'A Honda Vezel' });
  });

  it('agent.delta starts a new line after a user line', () => {
    const s = reduce(
      reduce(initialState, { type: 'user.delta', text: 'Four of us' }),
      { type: 'agent.delta', text: 'Ok' }
    );
    expect(s.line).toEqual({ speaker: 'agent', text: 'Ok' });
  });

  it('reply.interrupted follows the mic state', () => {
    const micOn = reduce(initialState, { type: 'session.open' });
    expect(reduce(micOn, { type: 'reply.interrupted' }).phase).toBe('listening');
    expect(reduce(initialState, { type: 'reply.interrupted' }).phase).toBe('idle');
  });

  it('reply.done follows the mic state', () => {
    const micOn = reduce(initialState, { type: 'session.open' });
    expect(reduce(micOn, { type: 'reply.done' }).phase).toBe('listening');
    const speaking = reduce(initialState, { type: 'agent.delta', text: 'Hi' });
    expect(reduce(speaking, { type: 'reply.done' }).phase).toBe('idle');
  });

  it('update_trip merges only valid known keys', () => {
    const s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'update_trip',
      args: { airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 }
    });
    expect(s.trip).toEqual({ airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 });
  });

  it('update_trip ignores bad values and unknown keys', () => {
    const base = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'update_trip',
      args: { dates: 'Friday' }
    });
    const s = reduce(base, {
      type: 'tool.call',
      id: 't',
      name: 'update_trip',
      args: { airport: 9, dates: 9, passengers: 'four', luggage: true, color: 'red' }
    });
    expect(s.trip).toEqual({ dates: 'Friday' });
  });

  it('suggest_cars sets the card list', () => {
    const s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: {
        cars: [
          { car_id: 'vezel', reason: 'Fits bags.' },
          { car_id: 'corolla', reason: 'Cheaper.' }
        ]
      }
    });
    expect(s.cards).toEqual([
      { carId: 'vezel', reason: 'Fits bags.' },
      { carId: 'corolla', reason: 'Cheaper.' }
    ]);
  });

  it('suggest_cars with missing args on an entry makes empty strings', () => {
    const s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{}] }
    });
    expect(s.cards).toEqual([{ carId: '', reason: '' }]);
  });

  it('suggest_cars skips a duplicate car id inside one set', () => {
    const s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'vezel', reason: 'One' }, { car_id: 'vezel', reason: 'Two' }] }
    });
    expect(s.cards).toEqual([{ carId: 'vezel', reason: 'One' }]);
  });

  it('a second suggest_cars replaces the whole set and keeps detailsOpen', () => {
    let s = reduce(initialState, { type: 'ui.details.open' });
    s = reduce(s, {
      type: 'tool.call',
      id: 't1',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'vezel', reason: 'r1' }, { car_id: 'corolla', reason: 'r2' }] }
    });
    s = reduce(s, {
      type: 'tool.call',
      id: 't2',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'model3', reason: 'r3' }] }
    });
    expect(s.cards).toEqual([{ carId: 'model3', reason: 'r3' }]);
    expect(s.detailsOpen).toBe(true);
  });

  it('suggest_cars with a non-array cars field changes nothing', () => {
    expect(
      reduce(initialState, { type: 'tool.call', id: 't', name: 'suggest_cars', args: { cars: 'vezel' } })
    ).toBe(initialState);
  });

  it('draft_agreement records the agreed car, and a later suggest_cars ends it', () => {
    let s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'draft_agreement',
      args: { car_id: 'xtrail' }
    });
    expect(s.agreement).toEqual({ carId: 'xtrail' });
    s = reduce(s, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'corolla', reason: 'r' }] }
    });
    expect(s.agreement).toBeNull();
  });

  it('draft_agreement without a car id changes nothing', () => {
    expect(reduce(initialState, { type: 'tool.call', id: 't', name: 'draft_agreement', args: {} })).toBe(initialState);
  });

  it('ui.agreement.submit clears the stage and marks it submitted', () => {
    let s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'draft_agreement',
      args: { car_id: 'xtrail' }
    });
    s = reduce(s, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'corolla', reason: 'r' }] }
    });
    s = reduce(s, { type: 'ui.agreement.submit' });
    expect(s).toEqual({ ...initialState, submitted: true });
  });

  it('an unknown tool call changes nothing', () => {
    expect(reduce(initialState, { type: 'tool.call', id: 't', name: 'book_now', args: { x: 1 } })).toBe(initialState);
  });

  it('ui.mic.toggle turns the mic on and listens', () => {
    const s = reduce(initialState, { type: 'ui.mic.toggle' });
    expect(s.micOn).toBe(true);
    expect(s.phase).toBe('listening');
  });

  it('ui.mic.toggle turns the mic off and goes idle', () => {
    const s = reduce(reduce(initialState, { type: 'session.open' }), { type: 'ui.mic.toggle' });
    expect(s.micOn).toBe(false);
    expect(s.phase).toBe('idle');
  });

  it('ui.text.submit sets the user line and thinks', () => {
    const s = reduce(initialState, { type: 'ui.text.submit', text: 'Any Vezel free?' });
    expect(s.line).toEqual({ speaker: 'user', text: 'Any Vezel free?' });
    expect(s.phase).toBe('thinking');
  });

  it('ui.card.dismiss removes one card by car id', () => {
    let s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'vezel', reason: 'r1' }, { car_id: 'corolla', reason: 'r2' }] }
    });
    s = reduce(s, { type: 'ui.card.dismiss', carId: 'vezel' });
    expect(s.cards).toEqual([{ carId: 'corolla', reason: 'r2' }]);
  });

  it('ui.card.dismiss without a car id clears all cards', () => {
    let s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'vezel', reason: 'r1' }] }
    });
    s = reduce(s, { type: 'ui.card.dismiss' });
    expect(s.cards).toEqual([]);
  });

  it('ui.details.open stores the car id and falls back to the first card', () => {
    let s = reduce(initialState, {
      type: 'tool.call',
      id: 't',
      name: 'suggest_cars',
      args: { cars: [{ car_id: 'vezel', reason: 'r1' }, { car_id: 'corolla', reason: 'r2' }] }
    });
    const byId = reduce(s, { type: 'ui.details.open', carId: 'corolla' });
    expect(byId.detailsOpen).toBe(true);
    expect(byId.detailsCarId).toBe('corolla');
    const fallback = reduce(s, { type: 'ui.details.open' });
    expect(fallback.detailsCarId).toBe('vezel');
    expect(reduce(fallback, { type: 'ui.details.close' }).detailsOpen).toBe(false);
  });

  it('ui.end stops the mic, the phase and the line', () => {
    let s = reduce(initialState, { type: 'session.open' });
    s = reduce(s, { type: 'agent.delta', text: 'Hi' });
    s = reduce(s, { type: 'ui.end' });
    expect(s.ended).toBe(true);
    expect(s.micOn).toBe(false);
    expect(s.phase).toBe('idle');
    expect(s.line).toBeNull();
  });

  it('session.closed ends the session and keeps the rest', () => {
    let s = reduce(initialState, { type: 'session.open' });
    s = reduce(s, { type: 'tool.call', id: 't', name: 'update_trip', args: { passengers: 4 } });
    s = reduce(s, { type: 'session.closed' });
    expect(s.ended).toBe(true);
    expect(s.micOn).toBe(true);
    expect(s.trip).toEqual({ passengers: 4 });
  });

  it('runs a full conversation', () => {
    let s = reduce(initialState, { type: 'session.open' });
    s = reduce(s, { type: 'user.delta', text: 'We are ' });
    s = reduce(s, { type: 'user.delta', text: 'We are four this weekend' });
    s = reduce(s, { type: 'user.speech.stopped' });
    s = reduce(s, {
      type: 'tool.call',
      id: 't1',
      name: 'update_trip',
      args: { airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 }
    });
    s = reduce(s, {
      type: 'tool.call',
      id: 't2',
      name: 'suggest_cars',
      args: {
        cars: [
          { car_id: 'vezel', reason: 'Room for a stroller and three bags.' },
          { car_id: 'corolla', reason: 'The lower daily rate.' }
        ]
      }
    });
    s = reduce(s, { type: 'agent.delta', text: 'A' });
    s = reduce(s, { type: 'agent.delta', text: ' Honda Vezel' });
    s = reduce(s, { type: 'reply.done' });

    expect(s.micOn).toBe(true);
    expect(s.phase).toBe('listening');
    expect(s.trip).toEqual({ airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 });
    expect(s.cards).toEqual([
      { carId: 'vezel', reason: 'Room for a stroller and three bags.' },
      { carId: 'corolla', reason: 'The lower daily rate.' }
    ]);
    expect(s.line).toEqual({ speaker: 'agent', text: 'A Honda Vezel' });
  });
});
