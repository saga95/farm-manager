import type { Meta, StoryObj } from '@storybook/react';
import { BarChart } from '../../components/ui/BarChart/BarChart';

const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const values = [310, 0, 420, 0, 385, 0, 450, 0, 395, 0, 0, 0];

const meta = {
  title: 'UI/BarChart',
  component: BarChart,
  parameters: {
    docs: {
      description: {
        component:
          'Single-series bar chart (dataviz guidance): one hue, no legend, thin rounded bars with a 2 px gap, recessive grid, hover/focus tooltip and a table view. Colours come from the theme (dark mode included).',
      },
    },
  },
  args: {
    title: 'Coconuts by month',
    data: months.map((m, i) => ({
      key: m,
      label: m,
      value: values[i] ?? 0,
      fullLabel: `${m} 2026`,
    })),
    valueLabel: 'Coconuts',
    categoryLabel: 'Month',
    showTableLabel: 'Show as table',
    showChartLabel: 'Show as chart',
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Money: Story = {
  args: {
    title: 'Sales value by month',
    format: (n: number) => `LKR ${n.toLocaleString('en')}`,
    data: months
      .slice(0, 6)
      .map((m, i) => ({
        key: m,
        label: m,
        value: [42000, 0, 51000, 8000, 47500, 0][i] ?? 0,
      })),
  },
};
export const Empty: Story = {
  args: { data: months.map(m => ({ key: m, label: m, value: 0 })) },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
