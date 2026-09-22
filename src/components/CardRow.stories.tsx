import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardRow } from './CardRow';

const meta = {
  title: 'Stage/CardRow',
  component: CardRow,
} satisfies Meta<typeof CardRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: {
    cards: [{ id: 'demo-sin-2', name: 'Honda HR-V', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 3, pricePerDay: 95, currency: 'SGD' }],
    notice: 'Demo cars and prices, not live availability.',
    onDismiss: () => {},
    onOpenDetails: () => {}
  },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', margin: '0 auto' }}>
      <CardRow {...args} />
    </div>
  )
};

export const Swipeable: Story = {
  args: {
    cards: [
      { id: 'demo-sin-1', name: 'Toyota Corolla Altis', category: 'Economy', transmission: 'Automatic', seats: 5, bags: 2, pricePerDay: 60, currency: 'SGD' },
      { id: 'demo-sin-2', name: 'Honda HR-V', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 3, pricePerDay: 95, currency: 'SGD' },
      { id: 'demo-sin-3', name: 'BMW 3 Series', category: 'Premium', transmission: 'Automatic', seats: 5, bags: 2, pricePerDay: 160, currency: 'SGD' }
    ],
    notice: 'Demo cars and prices, not live availability.',
    onDismiss: () => {},
    onOpenDetails: () => {}
  },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', margin: '0 auto' }}>
      <CardRow {...args} />
    </div>
  )
};

export const Dubai: Story = {
  args: {
    ...Single.args,
    cards: [{ id: 'demo-dxb-2', name: 'Nissan X-Trail', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 4, pricePerDay: 210, currency: 'AED' }]
  },
  render: Swipeable.render
};
