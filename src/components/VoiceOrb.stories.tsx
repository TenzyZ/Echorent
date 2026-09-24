import type { Meta, StoryObj } from '@storybook/react-vite';
import { VoiceOrb } from './VoiceOrb';

const meta = {
  title: 'Stage/VoiceOrb',
  component: VoiceOrb,
} satisfies Meta<typeof VoiceOrb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stopped: Story = { args: { phase: 'idle' } };
export const Listening: Story = { args: { phase: 'listening' } };
export const Thinking: Story = { args: { phase: 'thinking' } };
export const Talking: Story = { args: { phase: 'speaking' } };
