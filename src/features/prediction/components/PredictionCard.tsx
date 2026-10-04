/**
 * PredictionCard: next-plucking estimate with "Why this estimate?" (PR-006,
 * §10.1, AC-PD-004/005). Shows "Not enough history" instead of guessing.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import type { PredictionView } from '@/lib/api';

export function PredictionCard({ prediction }: { prediction: PredictionView }) {
  const { t, i18n } = useTranslation('coconut');
  const [open, setOpen] = useState(false);
  const fmt = (iso?: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'short',
        }).format(new Date(`${iso}T00:00:00`))
      : '';

  if (prediction.confidence === 'NO_PREDICTION' || !prediction.estimateDate) {
    return (
      <SummaryCard
        title={t('prediction.title')}
        icon={<EventRepeatOutlined fontSize='small' />}
      >
        <EmptyState
          title={t('prediction.notEnough')}
          message={t('prediction.notEnoughBody')}
        />
      </SummaryCard>
    );
  }

  return (
    <SummaryCard
      title={t('prediction.title')}
      icon={<EventRepeatOutlined fontSize='small' />}
    >
      <Stack spacing={1.5}>
        <Typography variant='h3' component='p'>
          {t('prediction.estimate', { date: fmt(prediction.estimateDate) })}
        </Typography>
        <Typography color='text.secondary'>
          {t('prediction.window', {
            start: fmt(prediction.windowStart),
            end: fmt(prediction.windowEnd),
          })}
        </Typography>
        <Chip
          sx={{ alignSelf: 'flex-start' }}
          size='small'
          variant='outlined'
          label={t(`prediction.confidence.${prediction.confidence}`)}
        />
        <Button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          endIcon={
            <ExpandMoreOutlined
              aria-hidden
              sx={{ transform: open ? 'rotate(180deg)' : 'none' }}
            />
          }
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('prediction.why')}
        </Button>
        <Collapse in={open}>
          <Stack spacing={1}>
            <Typography>
              {t('prediction.explain', {
                count: prediction.intervalCount,
                median: prediction.medianIntervalDays,
                last: fmt(prediction.lastHarvestDate),
              })}
            </Typography>
            {prediction.highlyInconsistent && (
              <Typography color='text.secondary'>
                {t('prediction.inconsistent')}
              </Typography>
            )}
            <Typography variant='caption' color='text.secondary'>
              {t('prediction.method', { method: prediction.methodVersion })}
            </Typography>
          </Stack>
        </Collapse>
      </Stack>
    </SummaryCard>
  );
}

export default PredictionCard;
