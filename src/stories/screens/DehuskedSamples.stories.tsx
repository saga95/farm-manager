import type { Meta, StoryObj } from '@storybook/react';
import { SampleDialog } from '../../features/samples/components/SampleDialog';
import { SizeHistoryCard } from '../../features/samples/components/SizeHistoryCard';

const meta = {
  title: 'Screens/SCR-012 Dehusked samples',
  component: SampleDialog,
  parameters: {
    docs: {
      description: {
        component:
          'One dehusked coconut per harvested tree is sized with a single tap. **Save & next tree** walks the unsampled trees of the round. Samples are evidence about the likely size; they never change inventory.',
      },
    },
  },
  args: {
    open: true,
    treeCode: 'C-012',
    saving: false,
    hasNext: true,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof SampleDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewSample: Story = {};
export const Correction: Story = {
  args: { initialSize: 'LARGE', initialWeight: 950, hasNext: false },
};
export const WithError: Story = {
  args: { error: "Couldn't save the sample. Please try again." },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };

const counts = { SMALL: 0, MEDIUM: 1, LARGE: 4, UNCLASSIFIED: 0 };

export const SizeHistory: Story = {
  render: () => (
    <SizeHistoryCard
      history={{
        latest: 'LARGE',
        latestDate: '2026-09-10',
        sampleCount: 5,
        counts,
        recent: ['LARGE', 'LARGE', 'MEDIUM', 'LARGE', 'LARGE'],
        tendency: 'LARGE',
        tendencyMatches: 4,
      }}
    />
  ),
};
export const SizeHistoryNotSampled: Story = {
  render: () => (
    <SizeHistoryCard
      history={{
        sampleCount: 0,
        counts: { ...counts, MEDIUM: 0, LARGE: 0 },
        recent: [],
        tendencyMatches: 0,
      }}
    />
  ),
};
