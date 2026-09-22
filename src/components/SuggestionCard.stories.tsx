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
    car: { id: 'demo-sin-2', name: 'Honda HR-V', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 3, pricePerDay: 95, currency: 'SGD' },
    note: 'Demo cars and prices, not live availability.',
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
    car: { id: 'demo-dxb-2', name: 'Nissan X-Trail', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 4, pricePerDay: 210, currency: 'AED' }
  },
  render: Hrv.render
};
