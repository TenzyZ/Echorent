import type { Meta, StoryObj } from '@storybook/react-vite';
import { SuggestionCard } from './SuggestionCard';

const meta = {
  title: 'Stage/SuggestionCard',
  component: SuggestionCard,
} satisfies Meta<typeof SuggestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hrv: Story = {
  args: {
    card: {
      carId: 'hrv',
      reason: 'Fits your family of four with room for a stroller and three bags.'
    },
    airport: 'SIN',
    onDismiss: () => {},
    onOpenDetails: () => {}
  },
  render: (args) => (
    <div style={{ width: 400, maxWidth: '100%', padding: 16 }}>
      <SuggestionCard {...args} />
    </div>
  ),
};

export const Dubai: Story = {
  args: {
    ...Hrv.args,
    airport: 'DXB'
  },
  render: Hrv.render
};
