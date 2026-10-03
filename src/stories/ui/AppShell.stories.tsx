import type { Meta, StoryObj } from '@storybook/react';
import Typography from '@mui/material/Typography';
import { AppShell } from '../../components/ui/AppShell/AppShell';

const meta = {
  title: 'UI/AppShell',
  component: AppShell,
  parameters: {
    nextjs: { router: { pathname: '/farm' } },
    docs: {
      description: {
        component: `
**AppShell** is the authenticated app frame (SRS §20).

- **Mobile (< md):** top bar with the farm context, a fixed **bottom navigation** with five tabs, and floating **quick actions** above it.
- **Desktop (≥ md):** a permanent **side navigation** with the same five destinations.

### Design tokens
- Side nav width: \`tokens.spacing[64]\`
- Bottom nav height: \`tokens.spacing[14]\`
- Radii: \`tokens.radius.lg\`

### Accessibility
- Two \`<nav aria-label="Main navigation">\` landmarks (only one is visible at each breakpoint).
- The active tab has \`aria-current="page"\`.
- \`<main id="main-content">\` is the target for the skip link.
- Every target is at least 48px.
        `,
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Farm',
    farmName: 'One-acre farm',
    showQuickActions: true,
    children: <Typography>Page content</Typography>,
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {};

export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: 'responsive' } },
};

export const WithoutQuickActions: Story = {
  args: { showQuickActions: false },
};

export const DarkMode: Story = {
  globals: { theme: 'dark' },
};
