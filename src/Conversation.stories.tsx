import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stage } from './components/Stage';
import { exampleConversation } from './conversation/example';
import { ScriptedDriver } from './conversation/ScriptedDriver';

const meta = {
  title: 'Conversation',
  component: Stage,
} satisfies Meta<typeof Stage>;

export default meta;
type Story = StoryObj<typeof meta>;

// The stage autostarts the script: greeting, family car at Changi, cheaper
// swap, then a move to Dubai that reprices every card in AED.
export const ExampleConversation: Story = {
  name: 'Example conversation',
  parameters: { layout: 'fullscreen' },
  args: { makeDriver: () => new ScriptedDriver(exampleConversation) },
  render: function Render({ makeDriver }) {
    const [run, setRun] = useState(0);
    return (
      <div
        style={{
          width: 430,
          maxWidth: '100%',
          minHeight: '100dvh',
          margin: '0 auto',
          position: 'relative',
          background: 'var(--ivory)'
        }}
      >
        <button
          type="button"
          onClick={() => setRun(run + 1)}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '6px 16px',
            borderRadius: 999,
            background: '#fff',
            border: '1px solid var(--line)',
            boxShadow: '0 2px 10px rgba(38,35,29,0.12)',
            fontSize: 12,
            color: 'var(--ink)'
          }}
        >
          Replay
        </button>
        <Stage key={run} makeDriver={makeDriver} />
      </div>
    );
  }
};
