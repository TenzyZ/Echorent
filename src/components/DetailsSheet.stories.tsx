import type { Meta, StoryObj } from '@storybook/react-vite';
import { DetailsSheet } from './DetailsSheet';

const meta = {
  title: 'Stage/DetailsSheet',
  component: DetailsSheet,
} satisfies Meta<typeof DetailsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    trip: { airport: 'SIN', airportName: 'Singapore Changi', pickup: 'Thursday 2026-09-24 07:00', return: 'Saturday 2026-09-26 19:00', driverAge: 24 },
    car: { id: 'demo-sin-2', name: 'Honda HR-V', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 3, pricePerDay: 95, currency: 'SGD' },
    onClose: () => {}
  },
  render: (args) => (
    <div style={{ position: 'relative', width: 430, maxWidth: '100%', height: 560, margin: '0 auto' }}>
      <DetailsSheet {...args} />
    </div>
  ),
};

export const Dubai: Story = {
  args: {
    ...Open.args,
    trip: { airport: 'DXB', airportName: 'Dubai International', pickup: 'Thursday 2026-09-24 07:00', return: 'Saturday 2026-09-26 19:00', driverAge: 24 },
    car: { id: 'demo-dxb-3', name: 'BMW 3 Series', category: 'Premium', transmission: 'Automatic', seats: 5, bags: 2, pricePerDay: 320, currency: 'AED' }
  },
  render: Open.render
};
