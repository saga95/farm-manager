import type { Meta, StoryObj } from '@storybook/react';
import { AppShell } from '../../components/ui/AppShell/AppShell';
import { FarmDashboard } from '../../features/analytics/components/FarmDashboard';

const meta = {
  title: 'Screens/SCR-003 Farm dashboard',
  component: FarmDashboard,
  parameters: {
    nextjs: { router: { pathname: '/' } },
    docs: {
      description: {
        component:
          'SCR-003 answers "What is happening on this farm now?" (SRS §16). V1 shell: each section shows an honest empty state until its epic supplies data.',
      },
    },
  },
  decorators: [
    Story => (
      <AppShell title='Home' farmName='One-acre farm' showQuickActions={false}>
        <Story />
      </AppShell>
    ),
  ],
  args: { farmName: 'One-acre farm' },
} satisfies Meta<typeof FarmDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {};
export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: 'responsive' } },
};
export const DarkMode: Story = { globals: { theme: 'dark' } };
