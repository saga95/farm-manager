import type { Meta, StoryObj } from '@storybook/react';
import { BackfillRoundForm } from '../../features/plucking/components/BackfillRoundForm';
import type { Tree } from '../../lib/api';

const trees: Tree[] = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i + 1}`,
  tenantId: 't',
  farmId: 'f',
  code: `C-${String(i + 1).padStart(3, '0')}`,
  cropCode: 'COCONUT',
  status: 'PRODUCING',
  version: 1,
}));

const meta = {
  title: 'Screens/Backfill old records',
  component: BackfillRoundForm,
  parameters: {
    docs: {
      description: {
        component:
          "Enter a past plucking round from WhatsApp or notes (§18, §41.13). Counts are only linked to the tree you pick; nuts you can't tie to a tree go in a separate total. Mark estimates, keep unreliable rounds out of predictions, and leave stock untouched unless asked.",
      },
    },
  },
  args: {
    trees,
    today: '2026-10-05',
    saving: false,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof BackfillRoundForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PastRound: Story = {};
export const WithError: Story = {
  args: { error: 'The date must be today or earlier.' },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
