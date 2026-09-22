import { useReducer, useRef } from 'react';
import type { ConversationDriver } from './conversation/driver';
import { initialState, reduce } from './state/uiState';

// Owns the UI state and the one driver instance for the stage.
export function useConversation(makeDriver: () => ConversationDriver) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const driverRef = useRef<ConversationDriver | null>(null);
  if (driverRef.current === null) {
    driverRef.current = makeDriver();
    driverRef.current.onEvent = (event) => {
      dispatch(event);
      // The client answers every tool call.
      if (event.type === 'tool.call') {
        driverRef.current?.sendToolResult(event.id, JSON.stringify({ ok: true }));
      }
    };
  }
  return {
    state,
    start: () => driverRef.current?.start(),
    toggleMic: () => dispatch({ type: 'ui.mic.toggle' }),
    submitText: (text: string) => {
      dispatch({ type: 'ui.text.submit', text });
      driverRef.current?.sendText(text);
    },
    dismissCard: (carId: string) => dispatch({ type: 'ui.card.dismiss', carId }),
    openDetails: (carId: string) => dispatch({ type: 'ui.details.open', carId }),
    closeDetails: () => dispatch({ type: 'ui.details.close' }),
    clearAgreement: () => dispatch({ type: 'ui.agreement.submit' }),
    say: (text: string) => {
      // An empty user line first, so the agent reply starts a fresh line.
      dispatch({ type: 'user.delta', text: '' });
      dispatch({ type: 'agent.delta', text });
      dispatch({ type: 'reply.done' });
    },
    end: () => {
      dispatch({ type: 'ui.end' });
      driverRef.current?.stop();
    }
  };
}
