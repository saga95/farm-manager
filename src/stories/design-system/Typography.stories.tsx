import type { Meta, StoryObj } from '@storybook/react';
import Stack from '@mui/material/Stack';
import Typography, { type TypographyProps } from '@mui/material/Typography';

const variants: NonNullable<TypographyProps['variant']>[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body1',
  'body2',
  'button',
  'caption',
  'overline',
];

const meta = {
  title: 'Design System/Typography',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'DM Sans, self-hosted through `next/font`, is the only typeface. It is chosen for legibility outdoors on a phone (SRS PR-001). Sizes come from `tokens.typography.fontSize`.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
  render: () => (
    <Stack spacing={2} sx={{ p: 2 }}>
      {variants.map(v => (
        <Typography key={v} variant={v} component='p'>
          {v}: Tree 18 harvested 23 coconuts
        </Typography>
      ))}
    </Stack>
  ),
};
