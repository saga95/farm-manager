import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { StatTile } from '../../components/ui/StatTile/StatTile';
import { DUE_BUCKETS } from '../../domain/prediction';
import { DueBucketChip } from '../../features/prediction/components/DueBucketChip';
import { PredictionCard } from '../../features/prediction/components/PredictionCard';

const prediction = {
  methodVersion: 'median-v1',
  confidence: 'MEDIUM',
  intervalCount: 4,
  harvestCount: 5,
  lastHarvestDate: '2026-08-20',
  medianIntervalDays: 63,
  variability: 0.12,
  highlyInconsistent: false,
  estimateDate: '2026-10-22',
  windowStart: '2026-10-18',
  windowEnd: '2026-10-26',
};

const meta = {
  title: 'Screens/SCR-007 Tree history & prediction',
  component: PredictionCard,
  decorators: [
    Story => (
      <Box sx={{ p: 2, maxWidth: 'sm' }}>
        <Story />
      </Box>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'The tree profile shows history stat tiles (missing values show "—", never 0), the next-plucking estimate with **Why this estimate?** (PR-006), and due-status chips that combine an icon, a label and a reserved status colour.',
      },
    },
  },
  args: { prediction },
} satisfies Meta<typeof PredictionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Estimate: Story = {};
export const NotEnoughHistory: Story = {
  args: {
    prediction: {
      ...prediction,
      confidence: 'NO_PREDICTION',
      estimateDate: null,
      intervalCount: 0,
    },
  },
};
export const StatTiles: Story = {
  render: () => (
    <Box
      sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}
    >
      <StatTile
        label='Last plucked'
        value='20 Aug 2026'
        caption='45 days ago'
      />
      <StatTile label='Last harvest' value={18} unit='nuts' />
      <StatTile label='Average per harvest' value={21.4} unit='nuts' />
      <StatTile label='Best harvest' value={null} unit='nuts' />
    </Box>
  ),
};
export const DueChips: Story = {
  render: () => (
    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
      {DUE_BUCKETS.map(b => (
        <DueBucketChip key={b} bucket={b} />
      ))}
    </Stack>
  ),
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
