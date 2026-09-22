import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Phase } from '../state/uiState';
import { VoiceOrb } from './VoiceOrb';

const meta = {
  title: 'Stage/VoiceOrb',
  component: VoiceOrb,
} satisfies Meta<typeof VoiceOrb>;

export default meta;
type Story = StoryObj<typeof meta>;

// The stage keys the orb styles off data-phase, so each story carries it on a wrapper.
function phaseStory(phase: Phase): Story {
  return {
    args: { phase },
    render: (args) => (
      <div data-phase={phase}>
        <VoiceOrb {...args} />
      </div>
    ),
  };
}

export const Idle: Story = phaseStory('idle');
export const Listening: Story = phaseStory('listening');
export const Thinking: Story = phaseStory('thinking');
export const Speaking: Story = phaseStory('speaking');
