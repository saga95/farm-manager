/**
 * StatTile: one headline figure (dataviz "stat tile": no plot, so no hover layer).
 * Value in primary ink, label/unit in secondary ink (text never wears a series colour).
 * Missing values render as an em dash, never as 0 (PR-007).
 *
 * @accessibility Rendered as a <div role="group"> labelled by its label, so the
 * value is announced with its meaning.
 */

import { useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';

export interface StatTileProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string | undefined;
  /** Secondary line, e.g. "22 days ago" */
  caption?: string | undefined;
}

export function StatTile({ label, value, unit, caption }: StatTileProps) {
  const id = useId();
  const missing = value === null || value === undefined || value === '';
  return (
    <Box
      role='group'
      aria-labelledby={id}
      sx={{
        p: 2,
        borderRadius: tokens.radius.lg,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        id={id}
        variant='caption'
        component='p'
        color='text.secondary'
      >
        {label}
      </Typography>
      <Typography
        variant='h3'
        component='p'
        sx={{ fontWeight: tokens.typography.fontWeight.bold }}
      >
        {missing ? '—' : value}
        {!missing && unit && (
          <Typography
            component='span'
            variant='body2'
            color='text.secondary'
            sx={{ ml: 0.5 }}
          >
            {unit}
          </Typography>
        )}
      </Typography>
      {caption && (
        <Typography variant='caption' component='p' color='text.secondary'>
          {caption}
        </Typography>
      )}
    </Box>
  );
}

export default StatTile;
