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
    cards: [{ carId: 'hrv', reason: 'Fits your family of four with room for a stroller and three bags.' }],
    airport: 'SIN',
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
      { carId: 'corolla', reason: 'The lowest daily rate.' },
      { carId: 'hrv', reason: 'The most room for luggage.' },
      { carId: 'bmw3', reason: 'A premium sedan with the same five seats.' }
    ],
    airport: 'SIN',
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
    ...Swipeable.args,
    airport: 'DXB'
  },
  render: Swipeable.render
};
