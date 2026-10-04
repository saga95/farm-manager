import type { Meta, StoryObj } from '@storybook/react';
import Card from '@mui/material/Card';
import { MovementList } from '../../features/inventory/components/MovementList';
import { StockActionDialog } from '../../features/inventory/components/StockActionDialog';

const meta = {
  title: 'Screens/SCR-016 Coconut stock',
  component: StockActionDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Stock actions on one batch. **Dehusk** moves husked nuts to dehusked and keeps the total. **Record use or adjustment** covers household use, damage, waste and adjustments (a reason is required for adjustments). The dialog never accepts more than is available.',
      },
    },
  },
  args: {
    open: true,
    action: 'dehusk',
    available: { HUSKED: 120, DEHUSKED: 0 },
    today: '2026-10-04',
    saving: false,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof StockActionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dehusk: Story = {};
export const UseOrAdjust: Story = {
  args: { action: 'move', available: { HUSKED: 90, DEHUSKED: 30 } },
};
export const WithError: Story = { args: { error: 'Only 12 husked in stock' } };
export const DarkMode: Story = { globals: { theme: 'dark' } };

export const Movements: Story = {
  render: () => (
    <Card variant='outlined'>
      <MovementList
        label='Movements'
        transactions={[
          {
            id: '4',
            batchId: 'b',
            transactionType: 'HOUSEHOLD_USE',
            quantity: 4,
            unit: 'NUT',
            state: 'DEHUSKED',
            transactionDate: '2026-10-05',
          },
          {
            id: '3',
            batchId: 'b',
            transactionType: 'ADJUSTMENT_OUT',
            quantity: 2,
            unit: 'NUT',
            state: 'HUSKED',
            transactionDate: '2026-10-04',
            notes: 'Recount at the store',
          },
          {
            id: '2',
            batchId: 'b',
            transactionType: 'PROCESSING',
            quantity: 30,
            unit: 'NUT',
            transactionDate: '2026-10-04',
          },
          {
            id: '1',
            batchId: 'b',
            transactionType: 'HARVEST_IN',
            quantity: 120,
            unit: 'NUT',
            state: 'HUSKED',
            transactionDate: '2026-10-01',
          },
        ]}
      />
    </Card>
  ),
};
