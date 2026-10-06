/**
 * StatusPage: a whole-screen page outside the app shell (not found, server
 * error, offline). Owns the document <title>, the <main> landmark and the
 * page's only <h1> (#109: these pages were missing a title or failed contrast
 * in dark mode).
 *
 * @tokens spacing, radius, typography from design-system/tokens.ts
 * @accessibility <main id="main-content"> (skip-link target) + h1; decorative icon hidden; the action is a real link or button.
 */

import type { ReactNode } from 'react';
import Head from 'next/head';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';

export interface StatusPageProps {
  title: string;
  message: string;
  /** Decorative icon (aria-hidden is applied) */
  icon?: ReactNode;
  /** A link (`href`) or an in-page action (`onClick`) */
  action?:
    | { label: string; href: string }
    | { label: string; onClick: () => void };
}

export function StatusPage({ title, message, icon, action }: StatusPageProps) {
  const { t } = useTranslation('shell');
  return (
    <>
      <Head>
        <title>{`${title} · ${t('appName')}`}</title>
      </Head>
      <Box
        component='main'
        id='main-content'
        tabIndex={-1}
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 3,
          textAlign: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        {icon && (
          <Box
            aria-hidden
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: tokens.spacing[16],
              height: tokens.spacing[16],
              borderRadius: tokens.radius.full,
              bgcolor: 'action.hover',
              color: 'text.secondary',
            }}
          >
            {icon}
          </Box>
        )}
        <Typography variant='h2' component='h1'>
          {title}
        </Typography>
        <Typography
          color='text.secondary'
          sx={{ maxWidth: tokens.breakpoints.xs }}
        >
          {message}
        </Typography>
        {action &&
          ('href' in action ? (
            <Button component={NextLink} href={action.href} variant='contained'>
              {action.label}
            </Button>
          ) : (
            <Button onClick={action.onClick} variant='contained'>
              {action.label}
            </Button>
          ))}
      </Box>
    </>
  );
}

export default StatusPage;
