import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { TranscriptLine } from '../state/uiState';

export function TranscriptStrip({ line }: { line: TranscriptLine | null }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [pan, setPan] = useState<{ from: number; to: number; duration: number } | null>(null);

  useLayoutEffect(() => {
    const overflow = (text.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0);
    if (overflow <= 0) {
      setPan(null);
      return;
    }
    // The line is centered, so pan by half the overflow in each direction.
    // The extra 12% clears the mask fade at the edges.
    const shift = overflow / 2 + (box.current?.clientWidth ?? 0) * 0.12;
    setPan({ from: shift, to: -shift, duration: Math.max(6000, (line?.text.length ?? 0) * 70) });
  }, [line?.speaker, line?.text]);

  if (!line) return <div className="strip" />;
  return (
    <div className="strip" ref={box}>
      <span
        key={line.text}
        ref={text}
        dir="auto"
        className={`strip__text strip__text--${line.speaker}${pan ? ' strip__text--pan' : ''}`}
        style={
          pan
            ? ({
                '--pan-from': `${pan.from}px`,
                '--pan-to': `${pan.to}px`,
                '--pan-duration': `${pan.duration}ms`
              } as CSSProperties)
            : undefined
        }
      >
        {line.text}
      </span>
    </div>
  );
}
