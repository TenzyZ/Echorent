import { useEffect, useRef, useState } from 'react';
import { signInWithGoogle, type User } from '../auth';
import { submitAgreement } from '../api';
import type { ConversationDriver } from '../conversation/driver';
import { useConversation } from '../useConversation';
import { AgreementCard } from './AgreementCard';
import { CardRow } from './CardRow';
import { RenterForm } from './RenterForm';
import { DetailsSheet } from './DetailsSheet';
import { Dock } from './Dock';
import { Headline } from './Headline';
import { TopBar } from './TopBar';
import { TranscriptStrip } from './TranscriptStrip';
import { VoiceOrb } from './VoiceOrb';

export function Stage({ makeDriver }: { makeDriver: () => ConversationDriver }) {
  const {
    state,
    start,
    toggleMic,
    submitText,
    dismissCard,
    openDetails,
    closeDetails,
    clearAgreement,
    say,
    end
  } = useConversation(makeDriver);
  // Start once. The guard keeps React StrictMode from opening a second session.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, []);
  // Stub Google sign-in: the handler resolves a fake user; no backend yet.
  const [user, setUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Submit the draft, let the form animate out, then the orb takes over.
  const submit = async () => {
    if (!state.agreement || !user || submitting || leaving) return;
    setSubmitting(true);
    const { reference } = await submitAgreement({
      airport: state.trip.airport,
      dates: state.trip.dates,
      carId: state.agreement.carId,
      renter: { name: user.name, email: user.email }
    });
    setLeaving(true);
    window.setTimeout(() => {
      clearAgreement();
      say(`Agreement ${reference} submitted. We will contact you in 1-2 business days.`);
      setLeaving(false);
      setSubmitting(false);
    }, 340);
  };

  return (
    <div className="stage" data-phase={state.phase}>
      <TopBar />
      <div className="hero">
        {state.agreement ? (
          // Two steps: renter details first, then the draft with the renter.
          user ? (
            <AgreementCard
              agreement={state.agreement}
              trip={state.trip}
              user={user}
              submitting={submitting}
              leaving={leaving}
              onSubmit={() => void submit()}
              onOpenDetails={openDetails}
            />
          ) : (
            <RenterForm
              carId={state.agreement.carId}
              airport={state.trip.airport}
              onSubmit={setUser}
              onSignIn={() => void signInWithGoogle().then(setUser)}
            />
          )
        ) : state.cards.length === 0 ? (
          state.submitted ? null : <Headline />
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
