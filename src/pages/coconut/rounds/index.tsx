import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import { useRounds } from '@/features/plucking/hooks';
import { useTenant } from '@/features/tenant';

/** Plucking rounds list (newest first); open rounds can be resumed. */
export default function RoundsPage() {
  const { t, i18n } = useTranslation('plucking');
  const { t: tb } = useTranslation('backfill');
  const router = useRouter();
  const { can } = useTenant();
  const canRestore = can('record.restore');
  const [showRemoved, setShowRemoved] = useState(false);
  const rounds = useRounds(canRestore && showRemoved);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );

  return (
    <AppPage
      title={t('rounds.title')}
      showQuickActions={false}
      actions={
        can('round.record') ? (
          <Button
            component={NextLink}
            href='/coconut/rounds/new'
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
          >
            {t('rounds.new')}
          </Button>
        ) : undefined
      }
    >
      {canRestore && (
        <FormControlLabel
          control={
            <Switch
              checked={showRemoved}
              onChange={e => setShowRemoved(e.target.checked)}
            />
          }
          label={t('rounds.showRemoved')}
          sx={{ mb: 1 }}
        />
      )}
      {rounds.isLoading ? (
        <Skeleton variant='rounded' height={200} aria-hidden />
      ) : (
        <EntityList
          label={t('rounds.title')}
          rows={(rounds.data ?? []).map(r => ({
            id: r.id,
            primary: fmt(r.roundDate),
            secondary:
              r.status === 'COMPLETE'
                ? t('rounds.summary', {
                    trees: r.plannedTreeIds.length - r.skippedTreeIds.length,
                    nuts: r.totalNuts ?? 0,
                  })
                : t('rounds.summaryOpen', { count: r.plannedTreeIds.length }),
            badge: r.deletedAt
              ? t('rounds.removed')
              : r.backfilled && r.source
                ? tb(`badge.${r.source}`)
                : t(`status.${r.status}`),
          }))}
          onSelect={id => void router.push(`/coconut/rounds/${id}`)}
          empty={
            <EmptyState
              size='page'
              icon={<EventRepeatOutlined fontSize='large' />}
              message={t('rounds.empty')}
              {...(can('round.record')
                ? {
                    action: {
                      label: t('rounds.new'),
                      href: '/coconut/rounds/new',
                    },
                  }
                : {})}
            />
          }
        />
      )}
    </AppPage>
  );
}
