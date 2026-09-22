import type { ConversationDriver } from '../conversation/driver';
import { useConversation } from '../useConversation';
import { CardRow } from './CardRow';
import { DetailsSheet } from './DetailsSheet';
import { Dock } from './Dock';
import { Headline } from './Headline';
import { TopBar } from './TopBar';
import { TranscriptStrip } from './TranscriptStrip';
import { VoiceOrb } from './VoiceOrb';
import { EmailRequestForm } from './EmailRequestForm';
import { RequestStatusCard } from './RequestStatusCard';

export function Stage({ makeDriver }: { makeDriver: () => ConversationDriver }) {
  const {
    state,
    toggleMic,
    submitText,
    dismissCard,
    openDetails,
    closeDetails,
    submitRequest,
    backToCars,
    end
  } = useConversation(makeDriver);
  const detailsCar = state.cards.find((car) => car.id === state.detailsCarId);
  const selectedCar = state.currentSearch?.result.cars.find(({ car_id }) => car_id === state.request?.carId);

  return (
    <div className="stage" data-phase={state.phase}>
      <TopBar />
      <div className="hero">
        {state.request?.phase === 'pending' || state.request?.phase === 'conflict' ? (
          <RequestStatusCard result={state.request.result} onBack={backToCars} ended={state.ended} />
        ) : state.request && selectedCar && state.currentSearch ? (
          <EmailRequestForm key={state.request.carId} car={selectedCar} rental={state.currentSearch.result.rental}
            submitting={state.request.phase === 'submitting'}
            ended={state.ended}
            failure={state.request.phase === 'failed' ? state.request.error : undefined}
            onSubmit={submitRequest} onBack={backToCars} />
        ) : state.cards.length === 0 ? (
          <Headline />
        ) : (
          <CardRow
            cards={state.cards}
            notice={state.notice}
            onDismiss={dismissCard}
            onOpenDetails={openDetails}
          />
        )}
      </div>
      <TranscriptStrip line={state.line} />
      <VoiceOrb phase={state.phase} />
      <Dock micOn={state.micOn} onToggleMic={toggleMic} onSubmitText={submitText} onEnd={end} />
      {state.detailsOpen && (
        <DetailsSheet trip={state.trip} car={detailsCar} onClose={closeDetails} />
      )}
    </div>
  );
}
