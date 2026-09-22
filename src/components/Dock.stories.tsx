import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dock } from './Dock';

const meta = {
  title: 'Stage/Dock',
  component: Dock,
} satisfies Meta<typeof Dock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MicOff: Story = {
  args: { micOn: false, onToggleMic: () => {}, onSubmitText: () => {}, onEnd: () => {} },
};

export const MicOn: Story = {
  args: { micOn: true, onToggleMic: () => {}, onSubmitText: () => {}, onEnd: () => {} },
};
