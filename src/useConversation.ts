import { useEffect, useReducer, useRef } from 'react';
import type { ConversationDriver } from './conversation/driver';
import { initialState, reduce } from './state/uiState';
import { postReservation, requestOutcomeNotice, SEARCH_EXPIRED } from './reservation';

export function useConversation(makeDriver: () => ConversationDriver) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const driverRef = useRef<ConversationDriver | null>(null);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const submissionRef = useRef<number | null>(null);
  const nextSubmission = useRef(0);
  const notifiedResult = useRef<object | null>(null);
  if (driverRef.current === null) {
    driverRef.current = makeDriver();
    driverRef.current.onEvent = dispatch;
  }

  useEffect(() => () => driverRef.current?.stop(), []);
  useEffect(() => {
    if (state.request?.phase === 'awaiting_email') submissionRef.current = null;
  }, [state.request]);
  useEffect(() => {
    const request = state.request;
    if (request && (request.phase === 'pending' || request.phase === 'conflict')
      && notifiedResult.current !== request.result) {
      notifiedResult.current = request.result;
      driverRef.current?.notify(requestOutcomeNotice(request.result));
    }
  }, [state.request]);

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
    submitRequest: (email: string) => {
      const request = state.request;
      if (endedRef.current || state.ended || !request || !state.currentSearch || !['awaiting_email', 'failed'].includes(request.phase) || submissionRef.current !== null) return;
      const submissionId = ++nextSubmission.current;
      submissionRef.current = submissionId;
      dispatch({ type: 'ui.request.submit', carId: request.carId, submissionId });
      void postReservation(state.currentSearch.args, request.carId, email, state.currentSearch.result.rental)
        .then((result) => dispatch({ type: 'reservation.result', carId: request.carId, submissionId, result }))
        .catch((error: unknown) => dispatch({ type: 'reservation.failed', carId: request.carId, submissionId,
          expired: error instanceof Error && error.message === SEARCH_EXPIRED }))
        .finally(() => { if (submissionRef.current === submissionId) submissionRef.current = null; });
    },
    backToCars: () => {
      submissionRef.current = null;
      dispatch({ type: 'ui.request.back' });
    },
    end: () => {
      endedRef.current = true;
      dispatch({ type: 'ui.end' });
      driverRef.current?.stop();
    }
  };
}
