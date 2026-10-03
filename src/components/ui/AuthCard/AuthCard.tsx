/**
 * AuthCard: branded, centered card for sign-in / sign-up / recovery / setup screens.
 *
 * @tokens spacing, radius, typography, breakpoints from design-system/tokens.ts
 * @accessibility <main id="main-content"> landmark, single <h1>, error region
 * announced with role="alert".
 */

import type { ReactNode } from 'react';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SpaOutlined from '@mui/icons-material/SpaOutlined';
import { tokens } from '@/design-system';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  /** Error message shown above the form */
  error?: string | null;
  /** Success/info message shown above the form */
  notice?: string | null;
  /** Links under the card (e.g. "Create an account") */
  footer?: ReactNode;
  /** Wider card for multi-section forms (setup wizard) */
  wide?: boolean;
  children: ReactNode;
}

export function AuthCard({
  title,
  subtitle,
  error,
  notice,
  footer,
  wide = false,
  children,
}: AuthCardProps) {
  const { t } = useTranslation(['shell', 'auth']);
  return (
    <>
      <Head>
        <title>{`${title} · ${t('shell:appName')}`}</title>
        <meta name='robots' content='noindex, nofollow' />
      </Head>
      <Box
        component='main'
        id='main-content'
        tabIndex={-1}
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: { xs: 'start center', sm: 'center' },
          bgcolor: 'background.default',
          px: 2,
          py: { xs: 3, sm: 6 },
          outline: 'none',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: wide ? tokens.sizes.cardWide : tokens.sizes.cardNarrow,
          }}
        >
          <Stack
            direction='row'
            spacing={1.5}
            alignItems='center'
            sx={{ mb: 3 }}
          >
            <Box
              aria-hidden
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: tokens.spacing[10],
                height: tokens.spacing[10],
                borderRadius: tokens.radius.lg,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <SpaOutlined fontSize='small' />
            </Box>
            <Box>
              <Typography
                variant='subtitle2'
                component='p'
                sx={{ fontWeight: tokens.typography.fontWeight.bold }}
              >
                {t('shell:appName')}
              </Typography>
              <Typography
                variant='caption'
                component='p'
                color='text.secondary'
              >
                {t('auth:tagline')}
              </Typography>
            </Box>
          </Stack>

          <Card>
            <CardContent
              sx={{
                p: { xs: 2.5, sm: 4 },
                '&:last-child': { pb: { xs: 2.5, sm: 4 } },
              }}
            >
              <Typography variant='h2' component='h1'>
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ mt: 1 }}
                >
                  {subtitle}
                </Typography>
              )}
              {error && (
                <Alert severity='error' role='alert' sx={{ mt: 2.5 }}>
                  {error}
                </Alert>
              )}
              {notice && (
                <Alert severity='success' sx={{ mt: 2.5 }}>
                  {notice}
                </Alert>
              )}
              <Box sx={{ mt: 3 }}>{children}</Box>
            </CardContent>
          </Card>

          {footer && (
            <Box sx={{ mt: 2.5, textAlign: 'center' }}>
              <Typography
                variant='body2'
                component='div'
                color='text.secondary'
              >
                {footer}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

export default AuthCard;
