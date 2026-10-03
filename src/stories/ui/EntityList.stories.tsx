import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { EntityList } from '../../features/farm/components/EntityList';

const meta = {
  title: 'Farm/EntityList',
  component: EntityList,
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
          'A list of zones or growing spaces. Rows are buttons only when the user can edit. Status is shown as a **text chip**, never as colour alone (SRS §25.5).',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Growing spaces',
    rows: [
      {
        id: '1',
        primary: 'Back strip',
        secondary: 'Narrow strip · In Backyard · 9.6 m²',
      },
      {
        id: '2',
        primary: 'Under the jak tree',
        secondary: 'Under trees',
        badge: 'Unused',
      },
      { id: '3', primary: 'Bed 1', secondary: 'Bed · In Polytunnel · 12 m²' },
    ],
    onSelect: () => undefined,
  },
} satisfies Meta<typeof EntityList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};
export const ReadOnly: Story = {
  render: ({ label, rows }) => <EntityList label={label} rows={rows} />,
};
export const Empty: Story = {
  args: { rows: [], empty: <EmptyState message='No growing spaces yet.' /> },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
