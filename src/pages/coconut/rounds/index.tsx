import { useRouter } from 'next/router';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
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
  const router = useRouter();
  const rounds = useRounds();
  const { can } = useTenant();
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
            badge: t(`status.${r.status}`),
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
