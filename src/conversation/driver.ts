import type { UIEvent } from '../state/uiState';

export interface ConversationDriver {
  onEvent?: (event: UIEvent) => void;
  start(): void;
  stop(): void;
  setMic(enabled: boolean): void;
  sendText(text: string): void;
  notify(text: string): void;
}
