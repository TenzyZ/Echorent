import type { UIEvent } from '../state/uiState';

export interface ConversationDriver {
  onEvent?: (event: UIEvent) => void;
  start(): void;
  stop(): void;
  sendText(text: string): void;
  sendToolResult(id: string, output: string): void;
}
