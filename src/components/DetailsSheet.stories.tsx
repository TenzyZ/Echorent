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
    trip: { airport: 'SIN', dates: 'This weekend', passengers: 4, luggage: 3 },
    carId: 'vezel',
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
    trip: { airport: 'DXB', dates: 'Next month', passengers: 2, luggage: 1 },
    carId: 'model3'
  },
  render: Open.render
};
