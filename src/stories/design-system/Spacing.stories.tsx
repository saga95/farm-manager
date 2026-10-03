import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tokens } from '../../../design-system';

const meta = {
  title: 'Design System/Spacing & Radius',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The spacing scale follows `tokens.spacing`. MUI's `theme.spacing(n)` is 8px per unit, so `sx={{ p: 2 }}` = `tokens.spacing[4]` (16px). Interactive targets are at least 48px (`TOUCH_TARGET`).",
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpacingScale: Story = {
  render: () => (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Object.entries(tokens.spacing).map(([step, value]) => (
        <Stack key={step} direction='row' spacing={2} alignItems='center'>
          <Typography
            variant='caption'
            component='span'
            sx={{ width: tokens.spacing[12] }}
          >
            {step}
          </Typography>
          <Typography
            variant='caption'
            component='span'
            sx={{
              width: tokens.spacing[20],
              fontFamily: tokens.typography.fontFamily.mono,
            }}
          >
            {value}
          </Typography>
          <Box
            sx={{
              width: value,
              height: tokens.spacing[4],
              bgcolor: 'primary.main',
              borderRadius: tokens.radius.sm,
            }}
          />
        </Stack>
      ))}
    </Stack>
  ),
};

export const Radius: Story = {
  render: () => (
    <Stack direction='row' spacing={2} useFlexGap flexWrap='wrap' sx={{ p: 2 }}>
      {Object.entries(tokens.radius).map(([step, value]) => (
        <Stack key={step} spacing={0.5} alignItems='center'>
          <Box
            sx={{
              width: tokens.spacing[16],
              height: tokens.spacing[16],
              bgcolor: 'secondary.main',
              borderRadius: value,
            }}
          />
          <Typography variant='caption' component='span'>
            {step}
          </Typography>
        </Stack>
      ))}
    </Stack>
  ),
};
