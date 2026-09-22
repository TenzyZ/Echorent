import { useEffect, useRef } from 'react';
import type { ConversationDriver } from '../conversation/driver';
import { useConversation } from '../useConversation';
import { CardRow } from './CardRow';
import { DetailsSheet } from './DetailsSheet';
import { Dock } from './Dock';
import { Headline } from './Headline';
import { TopBar } from './TopBar';
import { TranscriptStrip } from './TranscriptStrip';
import { VoiceOrb } from './VoiceOrb';

export function Stage({ makeDriver }: { makeDriver: () => ConversationDriver }) {
  const { state, start, toggleMic, submitText, dismissCard, openDetails, closeDetails, end } =
    useConversation(makeDriver);
  // Start once. The guard keeps React StrictMode from opening a second session.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, []);

  return (
    <div className="stage" data-phase={state.phase}>
      <TopBar />
      <div className="hero">
        {state.cards.length === 0 ? (
          <Headline />
        ) : (
          <CardRow
            cards={state.cards}
            airport={state.trip.airport}
            onDismiss={dismissCard}
            onOpenDetails={openDetails}
          />
        )}
      </div>
      <TranscriptStrip line={state.line} />
      <VoiceOrb phase={state.phase} />
      <Dock micOn={state.micOn} onToggleMic={toggleMic} onSubmitText={submitText} onEnd={end} />
      {state.detailsOpen && (
        <DetailsSheet trip={state.trip} carId={state.detailsCarId ?? undefined} onClose={closeDetails} />
      )}
    </div>
  );
}
