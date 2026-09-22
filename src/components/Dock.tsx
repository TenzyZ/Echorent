import { useState } from 'react';

export function KeyboardPanel({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="keyboard"
      onSubmit={(e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        onSend(value);
        setText('');
      }}
    >
      <input
        className="keyboard__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your reply"
        aria-label="Type your reply"
      />
      <button className="keyboard__send" type="submit" aria-label="Send">
        →
      </button>
    </form>
  );
}

export function Dock({
  micOn,
  onToggleMic,
  onSubmitText,
  onEnd
}: {
  micOn: boolean;
  onToggleMic: () => void;
  onSubmitText: (text: string) => void;
  onEnd: () => void;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  return (
    <div className="dock-zone">
      {keyboardOpen && <KeyboardPanel onSend={onSubmitText} />}
      <div className="dock">
        <button
          type="button"
          className="dock__key"
          aria-label="Keyboard"
          aria-expanded={keyboardOpen}
          onClick={() => setKeyboardOpen(!keyboardOpen)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
            <path d="M7 10h.01M11 10h.01M15 10h.01M17.5 10h.01M8 14h8" />
          </svg>
        </button>
        <button
          type="button"
          className={`dock__mic${micOn ? ' dock__mic--on' : ''}`}
          aria-label="Microphone"
          aria-pressed={micOn}
          onClick={onToggleMic}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
            <path d="M12 18v3" />
          </svg>
        </button>
        <button type="button" className="dock__end" aria-label="End call" onClick={onEnd}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              transform="rotate(135 12 12)"
              d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.94.36 1.85.7 2.71a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.86.34 1.77.57 2.71.7A2 2 0 0 1 22 16.92Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
