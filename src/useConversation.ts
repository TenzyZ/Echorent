import { useEffect, useReducer, useRef } from 'react';
import type { ConversationDriver } from './conversation/driver';
import { initialState, reduce } from './state/uiState';

export function useConversation(makeDriver: () => ConversationDriver) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const driverRef = useRef<ConversationDriver | null>(null);
  const startedRef = useRef(false);
  if (driverRef.current === null) {
    driverRef.current = makeDriver();
    driverRef.current.onEvent = dispatch;
  }

  useEffect(() => () => driverRef.current?.stop(), []);

  const ensureStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    driverRef.current?.start();
  };

  return {
    state,
    toggleMic: () => {
      if (!startedRef.current) return ensureStarted();
      if (state.phase !== 'connecting') driverRef.current?.setMic(!state.micOn);
    },
    submitText: (text: string) => {
      dispatch({ type: 'ui.text.submit', text });
      ensureStarted();
      driverRef.current?.sendText(text);
    },
    dismissCard: (carId: string) => dispatch({ type: 'ui.card.dismiss', carId }),
    openDetails: (carId: string) => dispatch({ type: 'ui.details.open', carId }),
    closeDetails: () => dispatch({ type: 'ui.details.close' }),
    end: () => {
      dispatch({ type: 'ui.end' });
      driverRef.current?.stop();
    }
  };
}
