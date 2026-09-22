import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyboardPanel } from './Dock';

const meta = {
  title: 'Stage/KeyboardPanel',
  component: KeyboardPanel,
} satisfies Meta<typeof KeyboardPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { onSend: () => {} },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', padding: '16px 0' }}>
      <KeyboardPanel {...args} />
    </div>
  ),
};
