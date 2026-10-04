import type { Meta, StoryObj } from '@storybook/react';
import { EntityList } from '../../features/farm/components/EntityList';
import { InputItemDialog } from '../../features/inventory/components/InputItemDialog';
import { InputMovementDialog } from '../../features/inventory/components/InputMovementDialog';
import type { InputItem } from '../../lib/api';

const urea: InputItem = {
  id: 'i1',
  farmId: 'f',
  name: 'Urea',
  category: 'FERTILIZER',
  unit: 'KG',
  quantity: 4,
  reorderLevel: 5,
  lowStock: true,
  status: 'ACTIVE',
  version: 3,
};

const meta = {
  title: 'Screens/SCR-017 Farm inputs',
  component: InputMovementDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Farm supplies (fertiliser, treatments, seeds, grow bags…) tracked separately from coconut stock. Quantity is the sum of stock in, use and adjustments. **Low stock** shows as text with an icon, never colour alone. Adjustments need a reason.',
      },
    },
  },
  args: {
    open: true,
    type: 'STOCK_OUT',
    item: urea,
    today: '2026-10-04',
    saving: false,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof InputMovementDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Use: Story = {};
export const StockIn: Story = { args: { type: 'STOCK_IN' } };
export const Adjust: Story = { args: { type: 'ADJUSTMENT' } };
export const DarkMode: Story = { globals: { theme: 'dark' } };

export const List: Story = {
  render: () => (
    <EntityList
      label='Farm inputs'
      rows={[
        {
          id: '1',
          primary: 'Coir grow bags',
          secondary: 'Grow bags · 40 bags',
        },
        {
          id: '2',
          primary: 'Urea',
          secondary: 'Fertiliser · 4 kg',
          badge: 'Low stock',
          badgeTone: 'warning',
        },
        {
          id: '3',
          primary: 'Drip emitters',
          secondary: 'Irrigation parts · 120 pieces',
        },
      ]}
    />
  ),
};

export const AddItem: Story = {
  render: () => (
    <InputItemDialog
      open
      saving={false}
      onSave={() => undefined}
      onClose={() => undefined}
    />
  ),
};
