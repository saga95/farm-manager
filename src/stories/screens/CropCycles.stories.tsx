import type { Meta, StoryObj } from '@storybook/react';
import { ActivityDialog } from '../../features/polytunnel/components/ActivityDialog';
import { CycleDialog } from '../../features/polytunnel/components/CycleDialog';
import { HarvestDialog } from '../../features/polytunnel/components/HarvestDialog';
import type { InputItem, Zone } from '../../lib/api';

const zones: Zone[] = [
  {
    id: 'z1',
    tenantId: 't',
    farmId: 'f',
    name: 'Polytunnel',
    zoneType: 'POLYTUNNEL',
    status: 'ACTIVE',
    version: 1,
  },
];
const inputs: InputItem[] = [
  {
    id: 'i1',
    farmId: 'f',
    name: 'Compost',
    category: 'FERTILIZER',
    unit: 'KG',
    quantity: 40,
    lowStock: false,
    status: 'ACTIVE',
    version: 1,
  },
  {
    id: 'i2',
    farmId: 'f',
    name: 'Neem oil',
    category: 'TREATMENT',
    unit: 'L',
    quantity: 2,
    lowStock: false,
    status: 'ACTIVE',
    version: 1,
  },
];

const meta = {
  title: 'Screens/SCR-025 Crop cycles',
  component: ActivityDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Grouped crop management (§41.3): a cycle like "Ginger 2026-01, 180 plants" is one record; plants are a count. Activities (watering, fertiliser, weeding…) are one tap; fertiliser or treatment can come from farm-input stock, which then goes down.',
      },
    },
  },
  args: {
    open: true,
    today: '2026-02-01',
    inputs,
    saving: false,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof ActivityDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecordActivity: Story = {};
export const DarkMode: Story = { globals: { theme: 'dark' } };
export const NewCycle: Story = {
  render: () => (
    <CycleDialog
      open
      zones={zones}
      spaces={[]}
      today='2026-01-15'
      saving={false}
      onSave={() => undefined}
      onClose={() => undefined}
    />
  ),
};

export const RecordHarvest: Story = {
  render: () => (
    <HarvestDialog
      open
      cropName='Cucumber'
      today='2026-04-10'
      saving={false}
      onSave={() => undefined}
      onClose={() => undefined}
    />
  ),
};
