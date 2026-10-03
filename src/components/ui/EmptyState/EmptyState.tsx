/**
 * EmptyState: honest "nothing recorded yet" message with an optional action.
 *
 * SRS PR-007 / DQ-001: missing data is shown as missing, never as zero.
 *
 * @tokens spacing, radius, typography from design-system/tokens.ts
 * @accessibility Plain text content; the action is a real link/button with a visible label.
 */

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';

export interface EmptyStateProps {
  /** Short explanation of what is missing */
  message: string;
  /** Optional heading (use on full-page empty states) */
  title?: string;
  /** Decorative icon (aria-hidden is applied) */
  icon?: ReactNode;
  /** Optional call to action */
  action?: { label: string; href: string };
  /** `compact` for inside cards, `page` for whole-screen placeholders */
  size?: 'compact' | 'page';
}

export function EmptyState({
  message,
  title,
  icon,
  action,
  size = 'compact',
}: EmptyStateProps) {
  const page = size === 'page';
  return (
    <Stack
      spacing={page ? 2 : 1.5}
      alignItems={page ? 'center' : 'flex-start'}
      sx={{ textAlign: page ? 'center' : 'left', py: page ? 6 : 0 }}
    >
      {icon && (
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: page ? tokens.spacing[16] : tokens.spacing[10],
            height: page ? tokens.spacing[16] : tokens.spacing[10],
            borderRadius: tokens.radius.full,
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          {icon}
        </Box>
      )}
      {title && (
        <Typography variant={page ? 'h2' : 'h4'} component='h2'>
          {title}
        </Typography>
      )}
      <Typography
        variant='body2'
        color='text.secondary'
        sx={{ maxWidth: tokens.spacing[64] }}
      >
        {message}
      </Typography>
      {action && (
        <Button
          component={NextLink}
          href={action.href}
          variant={page ? 'contained' : 'outlined'}
          size={page ? 'medium' : 'small'}
        >
          {action.label}
        </Button>
      )}
    </Stack>
  );
}

export default EmptyState;
