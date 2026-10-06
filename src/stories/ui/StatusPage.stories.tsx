import type { Meta, StoryObj } from '@storybook/react';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import { StatusPage } from '../../components/ui/StatusPage/StatusPage';

const meta: Meta<typeof StatusPage> = {
  title: 'UI/StatusPage',
  component: StatusPage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Whole-screen page outside the app shell: not found, server error, offline. Owns the document title, the main landmark and the h1.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof StatusPage>;

export const NotFound: Story = {
  args: {
    icon: <SearchOffOutlined fontSize='large' />,
    title: 'Page not found',
    message:
      "This page doesn't exist or has moved. Check the address, or go back to the start.",
    action: { label: 'Go to home', href: '/' },
  },
};

export const Offline: Story = {
  args: {
    icon: <CloudOffOutlined fontSize='large' />,
    title: "You're offline",
    message:
      "This page hasn't been opened on this phone yet. Pages you've used before still open, and counts you enter are kept and sent when you're back online.",
    action: { label: 'Try again', onClick: () => undefined },
  },
};

export const DarkMode: Story = {
  ...NotFound,
  globals: { theme: 'dark' },
};
