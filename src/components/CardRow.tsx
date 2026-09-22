import { useRef, useState } from 'react';
import type { Suggestion } from '../state/uiState';
import { SuggestionCard } from './SuggestionCard';

// The car results. One card fills the row. Swipe right for the next card.
export function CardRow({
  cards,
  airport,
  onDismiss,
  onOpenDetails
}: {
  cards: Suggestion[];
  airport?: string;
  onDismiss: (carId: string) => void;
  onOpenDetails: (carId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = (i: number) => {
    const item = trackRef.current?.children[i] as HTMLElement | undefined;
    item?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.children.length < 2) return;
    const step =
      (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
    setActive(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / step))));
  };

  return (
    <div className="cards">
      <div
        className="cards__track"
        ref={trackRef}
        role="group"
        aria-label="Car suggestions"
        onScroll={handleScroll}
      >
        {cards.map((card) => (
          <SuggestionCard
            key={card.carId}
            card={card}
            airport={airport}
            onDismiss={() => onDismiss(card.carId)}
            onOpenDetails={() => onOpenDetails(card.carId)}
          />
        ))}
      </div>
      {cards.length > 1 && (
        <div className="cards__dots">
          {cards.map((card, i) => (
            <button
              key={card.carId}
              type="button"
              className={i === active ? 'cards__dot cards__dot--on' : 'cards__dot'}
              aria-label={`Show car ${i + 1} of ${cards.length}`}
              aria-current={i === active}
              onClick={() => scrollTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
