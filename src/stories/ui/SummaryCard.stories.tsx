import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import { tokens } from '../../../design-system';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { SummaryCard } from '../../components/ui/SummaryCard/SummaryCard';

const meta = {
  title: 'UI/SummaryCard',
  component: SummaryCard,
  decorators: [
    Story => (
      <Box sx={{ p: 2, maxWidth: tokens.breakpoints.sm }}>
        <Story />
      </Box>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          '**SummaryCard** is a dashboard section (SRS §16). It renders a `<section>` labelled by its heading, so screen readers can navigate to it as a region.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Next plucking',
    icon: <EventRepeatOutlined fontSize='small' />,
    children: (
      <EmptyState
        message='Not enough history yet.'
        action={{ label: 'Plan a round', href: '/coconut/planning' }}
      />
    ),
  },
} satisfies Meta<typeof SummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const SecondaryTone: Story = {
  args: {
    title: 'Sales this month',
    tone: 'secondary',
    icon: <PaymentsOutlined fontSize='small' />,
  },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
