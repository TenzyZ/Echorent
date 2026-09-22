import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { ReservationConflict, ReservationSuccess } from '../reservation';
import { RequestStatusCard } from './RequestStatusCard';

const pending: ReservationSuccess = {
  ok: true, demo: true, replayed: false,
  request: {
    request_id: 'ER-1A2B3C4D5E6F', created_at: '2026-09-22T00:00:00Z', status: 'pending',
    car: { car_id: 'demo-dxb-2', airport: 'DXB', name: 'Nissan X-Trail', category: 'suv', transmission: 'automatic', seats: 5, bags: 4, daily_rate: 210, currency: 'AED' },
    rental: { airport: 'DXB', airport_name: 'Dubai International', pickup: { date: '2026-10-07', weekday: 'Wednesday', time: '07:00' }, return: { date: '2026-10-10', weekday: 'Saturday', time: '07:00' }, driver_age: 30 },
  },
  notifications: { internal: { status: 'sent' }, traveller: { status: 'sent' } },
};
const conflict: ReservationConflict = {
  ok: false, demo: true,
  errors: [{ field: 'rental', code: 'existing_request', detail: 'A pending request already exists.' }],
  existing_request: { status: 'pending' },
};
const meta = {
  title: 'Stage/RequestStatusCard', component: RequestStatusCard,
  args: { result: pending, onBack: () => {} },
  render: (args) => <div style={{ width: 430, maxWidth: '100%', margin: '0 auto', padding: 16 }}><RequestStatusCard {...args} /></div>,
} satisfies Meta<typeof RequestStatusCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewPending: Story = {
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? '';
    await expect(within(canvasElement).getByText('Email acknowledgement: Sent')).toBeInTheDocument();
    await expect(text).not.toMatch(/team notification|internal/i);
  },
};
export const Replayed: Story = { args: { result: { ...pending, replayed: true } } };
export const AcknowledgementFailed: Story = {
  args: { result: { ...pending, notifications: { internal: { status: 'sent' }, traveller: { status: 'failed' } } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Email acknowledgement: Could not be sent')).toBeInTheDocument();
  },
};
export const TeamNotificationFailed: Story = {
  args: { result: { ...pending, notifications: { internal: { status: 'failed' }, traveller: { status: 'sent' } } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Email acknowledgement: Sent')).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toMatch(/team notification|failed/i);
  },
};
export const ExistingConflict: Story = { args: { result: conflict } };
