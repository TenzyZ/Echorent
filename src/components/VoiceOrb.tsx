import { useEffect, useRef } from 'react';
import type { Phase } from '../state/uiState';

const LABELS: Record<Phase, string> = {
  idle: 'Tap the mic to start',
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Talking…',
  error: 'Connection error',
  ended: 'Call ended'
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
        <div className="orb__sky">
          <span className="orb__shade" />
          <span className="orb__bank" />
          <span className="orb__bank orb__bank--taper" />
          <span className="orb__wisp" />
          <span className="orb__wisp orb__wisp--high" />
        </div>
      </div>
      <p className="orb-zone__label" role="status"><span aria-hidden="true" />{LABELS[phase]}</p>
    </div>
  );
}
