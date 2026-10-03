/**
 * SummaryCard: dashboard section card (SRS §16) with title, icon and body.
 *
 * @tokens spacing, radius, typography from design-system/tokens.ts
 * @accessibility Rendered as <section> labelled by its heading, so each card
 * is a navigable region for screen readers.
 */

import { type ReactNode, useId } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';

export interface SummaryCardProps {
  title: string;
  /** Decorative icon shown before the title */
  icon?: ReactNode;
  /** Visual accent for the icon chip */
  tone?: 'primary' | 'secondary';
  children: ReactNode;
}

export function SummaryCard({
  title,
  icon,
  tone = 'primary',
  children,
}: SummaryCardProps) {
  const headingId = useId();
  return (
    <Card
      component='section'
      aria-labelledby={headingId}
      sx={{ height: '100%' }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction='row' spacing={1.5} alignItems='center' sx={{ mb: 2 }}>
          {icon && (
            <Box
              aria-hidden
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: tokens.spacing[9],
                height: tokens.spacing[9],
                borderRadius: tokens.radius.lg,
                bgcolor: `${tone}.main`,
                color: `${tone}.contrastText`,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Typography id={headingId} variant='h4' component='h2'>
            {title}
          </Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export default SummaryCard;
