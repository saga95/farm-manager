import type { Meta, StoryObj } from '@storybook/react';
import {
  CoconutReport,
  CropsReport,
  SalesStockReport,
} from '../../features/analytics/components/Reports';
import { sampleReport } from '../../features/analytics/sampleReport';

const meta = {
  title: 'Screens/SCR-014 & SCR-027 Reports',
  component: CoconutReport,
  parameters: {
    docs: {
      description: {
        component:
          'Reports follow §17.6: recorded facts and derived statistics only ("C-014 averaged 22 coconuts over its 4 recorded pluckings"), never "poor" or a diagnosis. Missing records show as —, not 0. Charts are single-series with a table view; received-per-coconut always states its scope (CALC-014).',
      },
    },
  },
  args: { report: sampleReport },
} satisfies Meta<typeof CoconutReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Coconut: Story = {};
export const SalesAndStock: Story = {
  render: () => <SalesStockReport report={sampleReport} currency='LKR' />,
};
export const OtherCrops: Story = {
  render: () => <CropsReport report={sampleReport} />,
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
