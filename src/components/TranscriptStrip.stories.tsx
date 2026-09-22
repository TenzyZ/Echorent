import type { Meta, StoryObj } from '@storybook/react-vite';
import { TranscriptStrip } from './TranscriptStrip';

const meta = {
  title: 'Stage/TranscriptStrip',
  component: TranscriptStrip,
} satisfies Meta<typeof TranscriptStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AgentLine: Story = {
  render: (args) => (
    <div style={{ width: 360, padding: '0 8px' }}>
      <TranscriptStrip {...args} />
    </div>
  ),
  args: { line: { speaker: 'agent', text: 'Where are you heading?' } },
};

export const LongPanningUserLine: Story = {
  render: (args) => (
    <div style={{ width: 360, padding: '0 8px' }}>
      <TranscriptStrip {...args} />
    </div>
  ),
  args: {
    line: {
      speaker: 'user',
      text: 'Family trip to Johor Bahru this weekend, two kids, one stroller, two big suitcases and a cooler box'
    }
  },
};
