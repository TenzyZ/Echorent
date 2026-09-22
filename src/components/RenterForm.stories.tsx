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
    carId: 'xtrail',
    airport: 'DXB',
    onSubmit: () => {},
    onSignIn: () => {}
  },
  render: (args) => (
    <div style={{ width: 430, maxWidth: '100%', margin: '0 auto', padding: 16 }}>
      <RenterForm {...args} />
    </div>
  )
};
