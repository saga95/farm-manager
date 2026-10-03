import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tokens } from '../../../design-system';

type Scale = Record<string | number, string>;

function Swatches({ name, scale }: { name: string; scale: Scale }) {
  return (
    <Box component='section' aria-labelledby={`scale-${name}`} sx={{ mb: 4 }}>
      <Typography
        id={`scale-${name}`}
        variant='h4'
        component='h2'
        sx={{ mb: 1 }}
      >
        {name}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${tokens.spacing[24]}, 1fr))`,
          gap: 1,
        }}
      >
        {Object.entries(scale).map(([step, hex]) => (
          <Stack key={step} spacing={0.5}>
            <Box
              sx={{
                height: tokens.spacing[16],
                borderRadius: tokens.radius.lg,
                bgcolor: hex,
                border: 1,
                borderColor: 'divider',
              }}
            />
            <Typography
              variant='caption'
              component='p'
              sx={{ fontWeight: 600 }}
            >
              {step}
            </Typography>
            <Typography
              variant='caption'
              component='p'
              sx={{ fontFamily: tokens.typography.fontFamily.mono }}
            >
              {hex}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

const meta = {
  title: 'Design System/Colors',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**Brand** ("coconut leaf" green) is the identity colour. In light mode the primary is `brand[600]`, because white text on it passes WCAG AA at 5.2:1. **Earth** ("husk") is the accent. Never hardcode a hex value; always use `tokens.colors.*` or the semantic theme.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <Box sx={{ p: 2 }}>
      <Swatches name='brand' scale={tokens.colors.brand} />
      <Swatches name='earth' scale={tokens.colors.earth} />
      <Swatches name='neutral' scale={tokens.colors.neutral} />
      <Swatches name='success' scale={tokens.colors.success} />
      <Swatches name='warning' scale={tokens.colors.warning} />
      <Swatches name='error' scale={tokens.colors.error} />
      <Swatches name='info' scale={tokens.colors.info} />
    </Box>
  ),
};
