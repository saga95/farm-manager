/**
 * FarmDashboard: SCR-003, "What is happening on this farm now?" (SRS §16).
 *
 * V1 shell: renders every §16 section with an honest empty state until each
 * feature epic supplies data (PR-007: missing ≠ zero). No charts on mobile.
 */

import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import GrassOutlined from '@mui/icons-material/GrassOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { tokens } from '@/design-system';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { QUICK_ACTION_ICONS } from '@/components/ui/AppShell/icons';
import { QUICK_ACTIONS } from '@/components/ui/AppShell/navigation';

export interface FarmDashboardProps {
  farmName: string;
}

function QuickActionTiles() {
  const { t } = useTranslation(['dashboard', 'shell']);
  return (
    <Box
      component='section'
      aria-labelledby='dashboard-quick-actions'
      sx={{ mb: 4 }}
    >
      <Typography
        id='dashboard-quick-actions'
        variant='overline'
        component='h2'
        color='text.secondary'
      >
        {t('dashboard:quickActions')}
      </Typography>
      <Box
        component='ul'
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          mt: 1,
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
        }}
      >
        {QUICK_ACTIONS.map((action, i) => (
          <li key={action.key}>
            <ButtonBase
              component={NextLink}
              href={action.href}
              sx={{
                width: '100%',
                minHeight: tokens.spacing[24],
                p: 2,
                borderRadius: tokens.radius.xl,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1.5,
                textAlign: 'left',
                // First action (New plucking round) is the flagship workflow
                bgcolor: i === 0 ? 'primary.main' : 'background.paper',
                color: i === 0 ? 'primary.contrastText' : 'text.primary',
                border: 1,
                borderColor: i === 0 ? 'primary.main' : 'divider',
                transition: `background-color ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut}`,
                '&:hover': {
                  bgcolor: i === 0 ? 'primary.dark' : 'action.hover',
                },
                '&.Mui-focusVisible': {
                  outline: 3,
                  outlineColor: 'primary.light',
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  color: i === 0 ? 'inherit' : 'primary.main',
                  display: 'flex',
                }}
              >
                {QUICK_ACTION_ICONS[action.key]}
              </Box>
              <Typography
                variant='body1'
                component='span'
                sx={{ fontWeight: tokens.typography.fontWeight.semibold }}
              >
                {t(`shell:${action.labelKey}`)}
              </Typography>
            </ButtonBase>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export function FarmDashboard({ farmName }: FarmDashboardProps) {
  const { t } = useTranslation('dashboard');

  return (
    <>
      <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
        {t('greeting', { farm: farmName })}
      </Typography>

      <QuickActionTiles />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
        }}
      >
        <SummaryCard
          title={t('coconut.title')}
          icon={<ParkOutlined fontSize='small' />}
        >
          <EmptyState
            message={t('coconut.empty')}
            action={{ label: t('coconut.cta'), href: '/coconut/trees/bulk' }}
          />
        </SummaryCard>
        <SummaryCard
          title={t('nextPlucking.title')}
          icon={<EventRepeatOutlined fontSize='small' />}
        >
          <EmptyState
            message={t('nextPlucking.empty')}
            action={{ label: t('nextPlucking.cta'), href: '/coconut/planning' }}
          />
        </SummaryCard>
        <SummaryCard
          title={t('produce.title')}
          icon={<Inventory2Outlined fontSize='small' />}
          tone='secondary'
        >
          <EmptyState
            message={t('produce.empty')}
            action={{ label: t('produce.cta'), href: '/inventory' }}
          />
        </SummaryCard>
        <SummaryCard
          title={t('sales.title')}
          icon={<PaymentsOutlined fontSize='small' />}
          tone='secondary'
        >
          <EmptyState
            message={t('sales.empty')}
            action={{ label: t('sales.cta'), href: '/sales/new' }}
          />
        </SummaryCard>
        <SummaryCard
          title={t('polytunnel.title')}
          icon={<GrassOutlined fontSize='small' />}
        >
          <EmptyState
            message={t('polytunnel.empty')}
            action={{ label: t('polytunnel.cta'), href: '/farm' }}
          />
        </SummaryCard>
        <SummaryCard
          title={t('inputs.title')}
          icon={<ScienceOutlined fontSize='small' />}
          tone='secondary'
        >
          <EmptyState
            message={t('inputs.empty')}
            action={{ label: t('inputs.cta'), href: '/inventory/inputs' }}
          />
        </SummaryCard>
      </Box>

      <Box sx={{ mt: 2 }}>
        <SummaryCard
          title={t('activity.title')}
          icon={<HistoryOutlined fontSize='small' />}
        >
          <EmptyState message={t('activity.empty')} />
        </SummaryCard>
      </Box>
    </>
  );
}

export default FarmDashboard;
