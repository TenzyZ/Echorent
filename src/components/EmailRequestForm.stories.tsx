import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EmailRequestForm } from './EmailRequestForm';

const meta = {
  title: 'Stage/EmailRequestForm', component: EmailRequestForm,
  args: {
    car: { car_id: 'demo-dxb-2', airport: 'DXB', name: 'Nissan X-Trail', category: 'suv', transmission: 'automatic', seats: 5, bags: 4, daily_rate: 210, currency: 'AED' },
    rental: { airport: 'DXB', airport_name: 'Dubai International', pickup: { date: '2026-10-07', weekday: 'Wednesday', time: '07:00' }, return: { date: '2026-10-10', weekday: 'Saturday', time: '07:00' }, driver_age: 30 },
    submitting: false, onSubmit: () => {}, onBack: () => {},
  },
  render: (args) => <div style={{ width: 430, maxWidth: '100%', margin: '0 auto', padding: 16 }}><EmailRequestForm {...args} /></div>,
} satisfies Meta<typeof EmailRequestForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Invalid: Story = { args: { failure: 'Enter a valid email address.' } };
export const Submitting: Story = {
  args: { submitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Sending request...' })).toBeDisabled();
  },
};
export const Failed: Story = { args: { failure: 'Request could not be completed. Please try again.' } };
export const Ended: Story = {
  args: { ended: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Call ended' })).toBeDisabled();
  },
};
export const Validation: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole('textbox', { name: 'Email' });
    await expect(email).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Send request' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await userEvent.type(email, 'traveller@example.test{enter}');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(args.onSubmit).toHaveBeenCalledWith('traveller@example.test');
  },
};
