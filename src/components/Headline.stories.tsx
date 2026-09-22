import type { Meta, StoryObj } from '@storybook/react-vite';
import { Headline } from './Headline';

const meta = {
  title: 'Stage/Headline',
  component: Headline,
} satisfies Meta<typeof Headline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invite: Story = {};
