import type { Meta, StoryObj } from '@storybook/react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthCard } from '../../components/ui/AuthCard/AuthCard';
import { GateLoading } from '../../features/tenant/components/AppGate';

const meta = {
  title: 'UI/AuthCard',
  component: AuthCard,
  parameters: {
    docs: {
      description: {
        component:
          '**AuthCard** is the branded, centered layout for sign-in, sign-up, recovery and setup (SCR-001 and SCR-002). It renders the page `<main>` landmark and a single `<h1>`, and errors are announced through `role="alert"`. Width comes from `tokens.sizes.cardNarrow` or `cardWide`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Sign in',
    subtitle: 'Welcome back. Sign in to continue to your farm.',
    children: (
      <Stack spacing={2}>
        <TextField label='Email' />
        <TextField label='Password' type='password' />
        <Button variant='contained' size='large'>
          Sign in
        </Button>
      </Stack>
    ),
  },
} satisfies Meta<typeof AuthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {};
export const WithError: Story = {
  args: { error: 'Incorrect email or password.' },
};
export const WithNotice: Story = {
  args: { notice: 'Email verified. You can sign in now.' },
};
export const Wide: Story = { args: { wide: true, title: 'Set up your farm' } };
export const DarkMode: Story = { globals: { theme: 'dark' } };
export const GateLoadingState: Story = { render: () => <GateLoading /> };
