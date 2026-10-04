/**
 * SizeHistoryCard: sample-based size evidence for a tree (§9.3, §9.4, §17.6).
 * Wording is always about SAMPLES ("4 of the last 5 samples were Large"),
 * never about all coconuts on the tree.
 */

import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StraightenOutlined from '@mui/icons-material/StraightenOutlined';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import type { SizeHistoryView } from '@/lib/api';

export function SizeHistoryCard({ history }: { history: SizeHistoryView }) {
  const { t, i18n } = useTranslation('samples');
  const size = (s?: string | null) => (s ? t(`sizes.${s}`) : '');
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );

  return (
    <SummaryCard
      title={t('history.title')}
      icon={<StraightenOutlined fontSize='small' />}
      tone='secondary'
    >
      {history.sampleCount === 0 ? (
        <EmptyState message={t('history.never')} />
      ) : (
        <Stack spacing={1.5}>
          <Typography variant='h4' component='p'>
            {history.latestDate
              ? t('history.latestOn', {
                  date: fmt(history.latestDate),
                  size: size(history.latest),
                })
              : t('history.latest', { size: size(history.latest) })}
          </Typography>
          <Typography>
            {history.tendency
              ? t('history.tendency', {
                  matches: history.tendencyMatches,
                  total: history.recent.length,
                  size: size(history.tendency).toLowerCase(),
                })
              : t('history.noTendency')}
          </Typography>
          <Stack
            direction='row'
            spacing={1}
            useFlexGap
            flexWrap='wrap'
            aria-label={t('history.recent')}
          >
            {history.recent.map((s, i) => (
              <Chip
                key={`${s}-${i}`}
                size='small'
                variant='outlined'
                label={size(s)}
              />
            ))}
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            {t('history.counts')}:{' '}
            {(['SMALL', 'MEDIUM', 'LARGE', 'UNCLASSIFIED'] as const)
              .filter(k => history.counts[k] > 0)
              .map(k => `${size(k)} ${history.counts[k]}`)
              .join(' · ')}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {t('history.evidence')}
          </Typography>
        </Stack>
      )}
    </SummaryCard>
  );
}

export default SizeHistoryCard;
