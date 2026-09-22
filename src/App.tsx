import { Stage } from './components/Stage';
import { VoiceSession } from './voice/session';

export default function App() {
  return <Stage makeDriver={() => new VoiceSession()} />;
}
