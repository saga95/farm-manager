import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  decorators: [
    Story => (
      <Box sx={{ p: 2 }}>
        <Story />
      </Box>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          '**EmptyState** says honestly that nothing has been recorded yet (SRS PR-007, DQ-001: missing data must never be shown as zero). Use `compact` inside cards and `page` for whole screens.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    message: 'No trees registered yet.',
    action: { label: 'Register trees', href: '/coconut/trees/bulk' },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {};
export const Page: Story = {
  args: {
    size: 'page',
    title: 'No trees yet',
    icon: <ParkOutlined fontSize='large' />,
  },
};
export const WithoutAction: Story = {
  args: { message: 'Harvests, samples, stock movements and sales will appear here.' },
  render: ({ message }) => <EmptyState message={message} />,
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
