import type { Meta, StoryObj } from '@storybook/react';
import { BuyerDialog } from '../../features/buyers/components/BuyerDialog';
import { EntityList } from '../../features/farm/components/EntityList';

const meta = {
  title: 'Screens/SCR-019 Buyers',
  component: BuyerDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Buyers keep their own size preferences (§13.2): a restaurant usually needs Medium, a shop prefers Large but also takes Medium. A buyer type never implies a size; each size is tapped to Preferred / Also accepts / No, and the choice is written on the button.',
      },
    },
  },
  args: {
    open: true,
    saving: false,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof BuyerDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddBuyer: Story = {};
export const EditBuyer: Story = {
  args: {
    buyer: {
      id: 'b1',
      name: 'Lake View Restaurant',
      preferredSizes: ['MEDIUM'],
      acceptableSizes: ['LARGE'],
      requirementNote: '40 medium every Friday',
      status: 'ACTIVE',
      version: 2,
    },
  },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };

export const List: Story = {
  render: () => (
    <EntityList
      label='Buyers'
      rows={[
        { id: '1', primary: 'Corner store', secondary: 'Prefers Large' },
        { id: '2', primary: 'Kottu stall', secondary: 'Prefers Small' },
        {
          id: '3',
          primary: 'Lake View Restaurant',
          secondary: 'Prefers Medium',
        },
      ]}
    />
  ),
};
