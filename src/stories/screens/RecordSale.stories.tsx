import type { Meta, StoryObj } from '@storybook/react';
import { SaleForm } from '../../features/sales/components/SaleForm';
import type { Buyer, ProduceBatch, Sale } from '../../lib/api';

const batches: ProduceBatch[] = [
  {
    id: 'b1',
    cropCode: 'COCONUT',
    sourceType: 'PLUCKING_ROUND',
    batchDate: '2026-10-01',
    quantityReceived: 120,
    unit: 'NUT',
    available: 120,
    availableByState: { HUSKED: 90, DEHUSKED: 30 },
    status: 'AVAILABLE',
    version: 3,
  },
  {
    id: 'b2',
    cropCode: 'COCONUT',
    sourceType: 'PLUCKING_ROUND',
    batchDate: '2026-10-03',
    quantityReceived: 64,
    unit: 'NUT',
    available: 64,
    availableByState: { HUSKED: 64, DEHUSKED: 0 },
    status: 'AVAILABLE',
    version: 1,
  },
];
const buyers: Buyer[] = [
  {
    id: 'r1',
    name: 'Lake View Restaurant',
    preferredSizes: ['MEDIUM'],
    acceptableSizes: ['LARGE'],
    status: 'ACTIVE',
    version: 1,
  },
  {
    id: 's1',
    name: 'Corner store',
    preferredSizes: ['LARGE'],
    acceptableSizes: ['MEDIUM'],
    status: 'ACTIVE',
    version: 1,
  },
];
const sale: Sale = {
  id: 's',
  farmId: 'f',
  saleDate: '2026-10-04',
  buyerId: 's1',
  buyerName: 'Corner store',
  lines: [
    { sizeClass: 'LARGE', quantity: 23, unitPrice: 140, lineAmount: 3220 },
    { sizeClass: 'MEDIUM', quantity: 16, unitPrice: 120, lineAmount: 1920 },
  ],
  allocations: [{ batchId: 'b1', state: 'HUSKED', quantity: 39 }],
  totalQuantity: 39,
  calculatedAmount: 5140,
  actualAmountReceived: 5000,
  difference: -140,
  differenceReason: 'Rounded for regular buyer',
  currency: 'LKR',
  status: 'COMPLETE',
  version: 1,
};

const meta = {
  title: 'Screens/SCR-021 Record sale',
  component: SaleForm,
  parameters: {
    docs: {
      description: {
        component:
          'Record a coconut sale: one line per size and price (amounts and the calculated total update as you type), choose which stock the nuts came from ("Fill from oldest" suggests it), and optionally the amount actually received. The calculated total and the actual amount are both kept; a difference shows with an optional reason.',
      },
    },
  },
  args: {
    buyers,
    batches,
    currency: 'LKR',
    today: '2026-10-04',
    initialBuyerId: 'r1',
    saving: false,
    onSubmit: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof SaleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewSale: Story = {};
export const EditSale: Story = { args: { sale } };
export const NoStock: Story = { args: { batches: [] } };
export const DarkMode: Story = { globals: { theme: 'dark' } };
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
