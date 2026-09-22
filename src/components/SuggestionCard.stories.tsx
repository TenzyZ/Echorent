import type { Meta, StoryObj } from '@storybook/react-vite';
import { SuggestionCard } from './SuggestionCard';

const meta = {
  title: 'Stage/SuggestionCard',
  component: SuggestionCard,
} satisfies Meta<typeof SuggestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vezel: Story = {
  args: {
    card: {
      carId: 'vezel',
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
    ...Vezel.args,
    airport: 'DXB'
  },
  render: Vezel.render
};
