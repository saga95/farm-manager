import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import { SectionLinks } from '../../components/ui/SectionLinks/SectionLinks';

const meta = {
  title: 'UI/SectionLinks',
  component: SectionLinks,
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
          '**SectionLinks** is the destination list for a tab hub page. It is a labelled `<nav>`; each row is a link with a 48px target.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Farm',
    links: [
      {
        href: '/coconut/trees',
        label: 'Coconut trees',
        icon: <ParkOutlined />,
      },
      {
        href: '/coconut/rounds',
        label: 'Plucking rounds',
        description: 'Last round: not recorded yet',
        icon: <EventRepeatOutlined />,
      },
    ],
  },
} satisfies Meta<typeof SectionLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DarkMode: Story = { globals: { theme: 'dark' } };
