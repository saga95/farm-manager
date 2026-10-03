/**
 * AppShell: authenticated application frame (SRS §20, SCR-003 container).
 *
 * - Mobile (< md): top app bar + fixed bottom navigation (5 tabs) + quick actions.
 * - Desktop (≥ md): permanent side navigation with the same 5 destinations.
 * Both navs are rendered and toggled with CSS breakpoints, so SSR output is
 * stable (no layout jump after hydration).
 *
 * @tokens spacing, radius, typography, zIndex from design-system/tokens.ts
 * @accessibility <nav> landmarks with labels, aria-current on the active tab,
 * <main id="main-content"> target for the skip link, 48px targets.
 */

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import SpaOutlined from '@mui/icons-material/SpaOutlined';
import { tokens } from '@/design-system';
import { NAV_ICONS } from './icons';
import { NAV_ITEMS, getActiveNavKey } from './navigation';
import { BOTTOM_NAV_HEIGHT, QuickActions } from './QuickActions';

export const SIDE_NAV_WIDTH = tokens.spacing[64]; // 256px

export interface AppShellProps {
  /** Page title shown in the top app bar */
  title: string;
  /** Farm/tenant context label (SRS §16 "Farm selector/context") */
  farmName?: string | undefined;
  /** Show the floating quick-action menu (hidden for VIEWER, or where a page has its own) */
  showQuickActions?: boolean | undefined;
  /** Optional element beside the page heading (e.g. page actions) */
  actions?: ReactNode;
  children: ReactNode;
}

function Brand({ farmName }: { farmName: string }) {
  const { t } = useTranslation('shell');
  return (
    <Stack
      direction='row'
      spacing={1.5}
      alignItems='center'
      sx={{ minWidth: 0 }}
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
          flexShrink: 0,
        }}
      >
        <SpaOutlined fontSize='small' />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant='subtitle2'
          component='p'
          noWrap
          sx={{ fontWeight: tokens.typography.fontWeight.bold }}
        >
          {t('appName')}
        </Typography>
        <Typography
          variant='caption'
          component='p'
          color='text.secondary'
          noWrap
        >
          {farmName}
        </Typography>
      </Box>
    </Stack>
  );
}

export function AppShell({
  title,
  farmName,
  showQuickActions = true,
  actions,
  children,
}: AppShellProps) {
  const { t } = useTranslation('shell');
  const { pathname } = useRouter();
  const active = getActiveNavKey(pathname);
  const farm = farmName ?? t('farmFallback');

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* ── Desktop side navigation ─────────────────────────────────── */}
      <Box
        component='nav'
        aria-label={t('nav.label')}
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          position: 'fixed',
          inset: 0,
          right: 'auto',
          width: SIDE_NAV_WIDTH,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          gap: 3,
        }}
      >
        <Brand farmName={farm} />
        <List disablePadding sx={{ display: 'grid', gap: 0.5 }}>
          {NAV_ITEMS.map(item => {
            const selected = active === item.key;
            return (
              <ListItemButton
                key={item.key}
                component={NextLink}
                href={item.href}
                selected={selected}
                aria-current={selected ? 'page' : undefined}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: tokens.spacing[10] }}>
                  {NAV_ICONS[item.key]}
                </ListItemIcon>
                <ListItemText
                  primary={t(item.labelKey)}
                  primaryTypographyProps={{
                    fontWeight: tokens.typography.fontWeight.semibold,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* ── Content column ──────────────────────────────────────────── */}
      <Box sx={{ ml: { md: SIDE_NAV_WIDTH } }}>
        {/* Mobile only: brand + farm context (desktop shows it in the side nav) */}
        <AppBar
          position='sticky'
          color='inherit'
          elevation={0}
          sx={{
            display: { xs: 'flex', md: 'none' },
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Toolbar>
            <Brand farmName={farm} />
          </Toolbar>
        </AppBar>

        <Container
          component='main'
          id='main-content'
          tabIndex={-1}
          maxWidth='lg'
          sx={{
            pt: 3,
            // Room for the bottom nav + FAB on mobile
            pb: {
              xs: `calc(${BOTTOM_NAV_HEIGHT} + ${tokens.spacing[24]} + env(safe-area-inset-bottom))`,
              md: tokens.spacing[24],
            },
            outline: 'none',
          }}
        >
          <Stack direction='row' alignItems='center' spacing={2} sx={{ mb: 3 }}>
            <Typography variant='h1' component='h1' sx={{ flex: 1 }}>
              {title}
            </Typography>
            {actions}
          </Stack>
          {children}
        </Container>
      </Box>

      {showQuickActions && <QuickActions />}

      {/* ── Mobile bottom navigation ────────────────────────────────── */}
      <Paper
        component='nav'
        aria-label={t('nav.label')}
        elevation={0}
        square
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: tokens.zIndex.sticky,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
          borderRadius: 0,
        }}
      >
        <BottomNavigation
          showLabels
          value={active ?? false}
          sx={{ height: BOTTOM_NAV_HEIGHT, bgcolor: 'background.paper' }}
        >
          {NAV_ITEMS.map(item => (
            <BottomNavigationAction
              key={item.key}
              value={item.key}
              label={t(item.labelKey)}
              icon={NAV_ICONS[item.key]}
              component={NextLink}
              href={item.href}
              aria-current={active === item.key ? 'page' : undefined}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default AppShell;
