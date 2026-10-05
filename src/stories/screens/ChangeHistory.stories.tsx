import type { Meta, StoryObj } from '@storybook/react';
import { ChangeList } from '../../features/records/ChangeHistory';

const meta = {
  title: 'Screens/Change history',
  component: ChangeList,
  parameters: {
    docs: {
      description: {
        component:
          'Who changed what and when (§31, DQ-007). Only the fields that changed are shown, with the reason when one was given.',
      },
    },
  },
  args: {
    entries: [
      {
        id: '3',
        at: '2026-10-05T03:00:00.000Z',
        action: 'harvest.correct',
        entityId: 'h1',
        actorId: 'u1',
        actorEmail: 'owner@farm.lk',
        details: {
          before: { quantity: 20 },
          after: { quantity: 22 },
          reason: 'Recount at the store',
        },
      },
      {
        id: '2',
        at: '2026-10-04T08:00:00.000Z',
        action: 'round.complete',
        entityId: 'r1',
        actorId: 'u2',
        actorEmail: 'helper@farm.lk',
        details: { totalNuts: 375 },
      },
      {
        id: '1',
        at: '2026-10-04T06:30:00.000Z',
        action: 'harvest.record',
        entityId: 'h1',
        actorId: 'u2',
        actorEmail: 'helper@farm.lk',
        details: { quantity: 20 },
      },
    ],
  },
} satisfies Meta<typeof ChangeList>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { entries: [] } };
export const DarkMode: Story = { globals: { theme: 'dark' } };
