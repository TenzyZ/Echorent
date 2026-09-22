import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoUser } from '../auth';
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
    trip: { airport: 'DXB', dates: 'This weekend', passengers: 4, luggage: 3 },
    user: demoUser,
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
