import type { Meta, StoryObj } from '@storybook/react';
import Stack from '@mui/material/Stack';
import { TREE_STATUSES } from '../../domain/coconut';
import { TreeStatusChip } from '../../features/coconut/components/TreeStatusChip';

const meta = {
  title: 'Coconut/TreeStatusChip',
  component: TreeStatusChip,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tree status (§7.1) shown as **text and colour**, never colour alone (SRS §25.5). Producing is green, Young is blue, and Damaged or Temporarily inactive is amber.',
      },
    },
  },
  tags: ['autodocs'],
  args: { status: 'PRODUCING' },
} satisfies Meta<typeof TreeStatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Producing: Story = {};
export const AllStatuses: Story = {
  render: () => (
    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
      {TREE_STATUSES.map(s => (
        <TreeStatusChip key={s} status={s} />
      ))}
    </Stack>
  ),
};
export const DarkMode: Story = {
  globals: { theme: 'dark' },
  render: AllStatuses.render!,
};
