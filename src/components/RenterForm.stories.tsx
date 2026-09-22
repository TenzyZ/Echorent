import type { Meta, StoryObj } from '@storybook/react-vite';
import { RenterForm } from './RenterForm';

const meta = {
  title: 'Stage/RenterForm',
  component: RenterForm,
} satisfies Meta<typeof RenterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    car: { id: 'demo-dxb-2', name: 'Nissan X-Trail', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 4, pricePerDay: 210, currency: 'AED' },
    onSubmit: () => {},
    onSignIn: () => {}
  },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', margin: '0 auto', padding: 16 }}>
      <RenterForm {...args} />
    </div>
  )
};
