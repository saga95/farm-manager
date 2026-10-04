/**
 * RoundSamplesCard: dehusked samples for a round's harvested trees (SCR-012).
 * Lists every harvested tree with its sample size or "Not sampled"; tapping a
 * tree opens SampleDialog, and "Save & next tree" walks the unsampled ones.
 * Works on open and completed rounds: dehusking often happens after plucking.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';
import type { CoconutSample, TreeHarvest } from '@/lib/api';
import type { SizeClass } from '@/domain/samples';
import { useRecordSample } from '../hooks';
import { samplingProgress } from '../progress';
import { SampleDialog } from './SampleDialog';

export interface RoundSamplesCardProps {
  roundId: string;
  harvests: readonly TreeHarvest[];
  samples: readonly CoconutSample[];
  /** Planned tree order, so sampling follows the round's walk. */
  order?: readonly string[];
  canRecord: boolean;
}

export function RoundSamplesCard({
  roundId,
  harvests,
  samples,
  order = [],
  canRecord,
}: RoundSamplesCardProps) {
  const { t } = useTranslation('samples');
  const record = useRecordSample(roundId);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(
    () => samplingProgress(harvests, samples, order),
    [harvests, samples, order]
  );
  const sampleByHarvest = useMemo(
    () => new Map(samples.map(s => [s.harvestId, s])),
    [samples]
  );
  const current = harvests.find(h => h.id === currentId) ?? null;
  const next = progress.nextAfter(null);

  if (harvests.length === 0) return null;

  const save = async (sizeClass: SizeClass, weight: number | null) => {
    if (!current) return;
    setError(null);
    try {
      await record.mutateAsync({ harvestId: current.id, sizeClass, weight });
      setCurrentId(progress.nextAfter(current.id)?.id ?? null);
    } catch {
      setError(t('dialog.failed'));
    }
  };

  return (
    <Card component='section' aria-labelledby='round-samples-title'>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id='round-samples-title' variant='h3' component='h2'>
            {t('round.title')}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {t('round.intro')}
          </Typography>
          <Typography variant='body2'>
            {t('round.progress', {
              done: progress.done,
              total: progress.total,
            })}
          </Typography>
          <LinearProgress
            variant='determinate'
            value={(progress.done / progress.total) * 100}
            aria-label={t('round.progress', {
              done: progress.done,
              total: progress.total,
            })}
          />
          {canRecord && next && (
            <Button
              variant='contained'
              size='large'
              onClick={() => setCurrentId(next.id)}
            >
              {progress.done === 0
                ? t('round.start')
                : t('round.continue', { code: next.treeCode })}
            </Button>
          )}
        </Stack>
      </CardContent>
      <List dense disablePadding aria-label={t('round.title')}>
        {progress.ordered.map(h => {
          const s = sampleByHarvest.get(h.id);
          const chip = (
            <Chip
              size='small'
              label={s ? t(`sizes.${s.sizeClass}`) : t('round.notSampled')}
              color={s ? 'secondary' : 'default'}
              variant={s ? 'filled' : 'outlined'}
            />
          );
          return (
            <ListItem key={h.id} disablePadding divider>
              {canRecord ? (
                <ListItemButton
                  onClick={() => setCurrentId(h.id)}
                  sx={{ minHeight: tokens.spacing[12] }}
                >
                  <ListItemText primary={h.treeCode} />
                  {chip}
                </ListItemButton>
              ) : (
                <Stack
                  direction='row'
                  alignItems='center'
                  sx={{ px: 2, minHeight: tokens.spacing[12], width: '100%' }}
                >
                  <ListItemText primary={h.treeCode} />
                  {chip}
                </Stack>
              )}
            </ListItem>
          );
        })}
      </List>
      {current && (
        <SampleDialog
          open
          treeCode={current.treeCode}
          initialSize={sampleByHarvest.get(current.id)?.sizeClass}
          initialWeight={sampleByHarvest.get(current.id)?.weight}
          saving={record.isLoading}
          error={error}
          hasNext={Boolean(progress.nextAfter(current.id))}
          onSave={(size, weight) => void save(size, weight)}
          onClose={() => {
            setError(null);
            setCurrentId(null);
          }}
        />
      )}
    </Card>
  );
}

export default RoundSamplesCard;
