import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CaptureDialog } from '../../features/plucking/components/CaptureDialog';
import { TreePicker } from '../../features/plucking/components/TreePicker';
import type { Tree } from '../../lib/api';

const meta = {
  title: 'Screens/SCR-009 Plucking capture',
  component: CaptureDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Recording one tree during a plucking round. The plucker picked his trees first and plucks them in **any order**: tap a tree, enter the count on the numeric keypad, then **Save & Next** moves to the next *pending* planned tree. **Skip** never creates a zero harvest.',
      },
    },
  },
  args: {
    open: true,
    treeCode: 'C-012',
    saving: false,
    hasNext: true,
    onSave: () => undefined,
    onSkip: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof CaptureDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewCount: Story = {};
export const Correction: Story = {
  args: { initialQuantity: 18, hasNext: false },
};
export const WithError: Story = {
  args: { error: "Couldn't save. Check your connection and try again." },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };

const trees: Tree[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i + 1}`,
  tenantId: 't',
  farmId: 'f',
  code: `C-${String(i + 1).padStart(3, '0')}`,
  cropCode: 'COCONUT',
  status: 'PRODUCING',
  version: 1,
}));

function PickerDemo() {
  const [selected, setSelected] = useState<string[]>(['t12', 't3']);
  return (
    <TreePicker
      trees={trees}
      selected={selected}
      onChange={setSelected}
      labels={{
        search: 'Find a tree by code',
        selected: `${selected.length} trees selected`,
        hint: 'Tap trees to select them. The order you tap is kept.',
        list: 'Trees',
      }}
    />
  );
}

/** SCR-008: select the visit's trees first; tap order is the plucker's order. */
export const TreeSelection: Story = { render: () => <PickerDemo /> };
