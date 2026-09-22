import { useEffect, useRef } from 'react';
import type { Phase } from '../state/uiState';

const LABELS: Record<Phase, string> = {
  idle: 'Tap the mic to start',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…'
};

export function VoiceOrb({ phase }: { phase: Phase }) {
  const orb = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = orb.current;
    if (!element) return;
    let visible = true;
    const update = () => { element.dataset.paused = String(document.hidden || !visible); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return (
    <div className="orb-zone" data-phase={phase} ref={orb}>
      <div className="orb" aria-hidden="true">
        <div className="orb__body">
          <span className="orb__cloud" />
          <span className="orb__veil" />
          <span className="orb__rim" />
        </div>
      </div>
      <p className="orb-zone__label" role="status"><span aria-hidden="true" />{LABELS[phase]}</p>
    </div>
  );
}
