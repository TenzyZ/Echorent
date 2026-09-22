import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgreementCard } from './AgreementCard';

const meta = {
  title: 'Stage/AgreementCard',
  component: AgreementCard,
} satisfies Meta<typeof AgreementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {
  args: {
    agreement: { carId: 'xtrail' },
    car: { id: 'demo-dxb-2', name: 'Nissan X-Trail', category: 'SUV', transmission: 'Automatic', seats: 5, bags: 4, pricePerDay: 210, currency: 'AED' },
    user: { name: 'Amirah Tan', email: 'amirah@example.com' },
    submitting: false,
    leaving: false,
    onSubmit: () => {},
    onOpenDetails: () => {}
  },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', margin: '0 auto', padding: 16 }}>
      <AgreementCard {...args} />
    </div>
  )
};
