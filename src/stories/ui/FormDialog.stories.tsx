import type { Meta, StoryObj } from '@storybook/react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { FormDialog } from '../../components/ui/FormDialog/FormDialog';

const meta = {
  title: 'UI/FormDialog',
  component: FormDialog,
  parameters: {
    docs: {
      description: {
        component:
          '**FormDialog** holds a create or edit form. It is **full screen on phones** (SRS §25.1) and a dialog from `sm` up. The dialog is labelled by its title, errors are announced, and submit is a real form submit.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    title: 'Add zone',
    submitLabel: 'Save',
    submittingLabel: 'Saving…',
    cancelLabel: 'Cancel',
    onClose: () => undefined,
    onSubmit: () => undefined,
    children: (
      <>
        <TextField label='Name' defaultValue='Polytunnel' />
        <TextField select label='Type' defaultValue='POLYTUNNEL'>
          <MenuItem value='POLYTUNNEL'>Polytunnel</MenuItem>
          <MenuItem value='BACKYARD'>Backyard</MenuItem>
        </TextField>
      </>
    ),
  },
} satisfies Meta<typeof FormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {};
export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: 'responsive' } },
};
export const WithError: Story = {
  args: { error: 'Someone else changed this. Close the form and try again.' },
};
export const Submitting: Story = { args: { submitting: true } };
export const DarkMode: Story = { globals: { theme: 'dark' } };
