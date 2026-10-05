import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ManageHistoryOutlined from '@mui/icons-material/ManageHistoryOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { EntityPhotos } from '@/features/media/components/EntityPhotos';
import { CorrectHarvestDialog } from '@/features/plucking/components/CorrectHarvestDialog';
import { useRoundCorrections } from '@/features/plucking/hooks';
import { ChangeHistory } from '@/features/records/ChangeHistory';
import { useTenant } from '@/features/tenant';
import { ApiError, getHarvest, setHarvestPredictionUse } from '@/lib/api';

/** SCR-011 Tree harvest detail (#58): one tree's harvest in full. */
export default function HarvestPage() {
  const { t, i18n } = useTranslation('plucking');
  const { t: ts } = useTranslation('samples');
  const { t: tb } = useTranslation('backfill');
  const { t: tr } = useTranslation('records');
  const router = useRouter();
  const harvestId =
    typeof router.query['harvestId'] === 'string'
      ? router.query['harvestId']
      : undefined;
  const { tenant, can } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['harvest', tenantId, harvestId],
    queryFn: () => getHarvest(tenantId, harvestId as string),
    enabled: Boolean(tenantId && harvestId),
    retry: false,
  });
  const d = detail.data;
  const fix = useRoundCorrections(d?.round?.id);
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['harvest', tenantId] }),
      qc.invalidateQueries({ queryKey: ['treeHistory', tenantId] }),
    ]);
  const predictionUse = useMutation({
    mutationFn: (exclude: boolean) =>
      setHarvestPredictionUse(tenantId, d!.harvest, exclude),
    onSuccess: refresh,
  });
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const h = d?.harvest;
  const removed = Boolean(h?.deletedAt);
  const completed = d?.round?.status === 'COMPLETE' && !d.round.deletedAt;
  const explain = (e: unknown) =>
    e instanceof ApiError && e.code === 'CONFLICT' && /stock/i.test(e.message)
      ? t('correct.stockUsed')
      : t('correct.failed');

  return (
    <AppPage
      title={
        h
          ? t('harvestDetail.title', {
              code: h.treeCode,
              date: fmt(h.harvestDate),
            })
          : t('rounds.title')
      }
      showQuickActions={false}
    >
      {detail.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {detail.isError && (
        <EmptyState size='page' message={t('harvestDetail.notFound')} />
      )}
      {d && h && (
        <Stack spacing={2}>
          {removed && (
            <Alert severity='warning'>{t('harvestDetail.removed')}</Alert>
          )}
          {error && (
            <Alert severity='error' role='alert' onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(4, 1fr)',
              },
            }}
          >
            <StatTile
              label={t('harvestDetail.nuts')}
              value={h.quantity}
              caption={
                h.previousQuantity != null
                  ? t('harvestDetail.previous', { count: h.previousQuantity })
                  : undefined
              }
            />
            <StatTile
              label={t('harvestDetail.quality')}
              value={t(`harvestDetail.qualities.${h.recordQuality}`)}
            />
            <StatTile
              label={t('harvestDetail.source')}
              value={t(`harvestDetail.sources.${h.source ?? 'LIVE_APP'}`)}
            />
            <StatTile
              label={t('harvestDetail.sample')}
              value={
                d.sample
                  ? ts(`sizes.${d.sample.sizeClass}`)
                  : t('harvestDetail.notSampled')
              }
            />
          </Box>
          {h.recordQuality === 'APPROXIMATE' && (
            <Chip
              label={t('harvestDetail.qualities.APPROXIMATE')}
              variant='outlined'
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
          <Stack
            direction='row'
            spacing={1}
            useFlexGap
            flexWrap='wrap'
            alignItems='center'
          >
            <Button
              component={NextLink}
              href={`/coconut/trees/${h.treeId}`}
              variant='outlined'
            >
              {t('harvestDetail.openTree')}
            </Button>
            {d.round && (
              <Button
                component={NextLink}
                href={`/coconut/rounds/${d.round.id}`}
                variant='outlined'
              >
                {t('harvestDetail.round', { date: fmt(d.round.roundDate) })}
              </Button>
            )}
          </Stack>
          {can('record.edit') ? (
            <FormControlLabel
              control={
                <Switch
                  checked={!h.excludeFromPrediction}
                  disabled={predictionUse.isLoading || removed}
                  onChange={e =>
                    void predictionUse
                      .mutateAsync(!e.target.checked)
                      .catch(() => undefined)
                  }
                />
              }
              label={tb(
                h.excludeFromPrediction
                  ? 'prediction.excluded'
                  : 'prediction.use'
              )}
            />
          ) : (
            <Typography color='text.secondary'>
              {tb(
                h.excludeFromPrediction
                  ? 'prediction.excluded'
                  : 'prediction.use'
              )}
            </Typography>
          )}
          {!removed &&
            (completed
              ? (can('record.edit') || can('record.archive')) && (
                  <Button
                    variant='contained'
                    onClick={() => setCorrecting(true)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('harvestDetail.correct')}
                  </Button>
                )
              : d.round &&
                can('harvest.record') && (
                  <Button
                    component={NextLink}
                    href={`/coconut/rounds/${d.round.id}`}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('harvestDetail.editInRound')}
                  </Button>
                ))}
          <EntityPhotos
            entityId={h.id}
            name={`${h.treeCode} · ${fmt(h.harvestDate)}`}
            category='HARVEST_PILE'
          />
          {can('audit.view') && (
            <SummaryCard
              title={tr('history.section')}
              icon={<ManageHistoryOutlined fontSize='small' />}
            >
              <ChangeHistory entityId={h.id} />
            </SummaryCard>
          )}
        </Stack>
      )}
      {h && (
        <CorrectHarvestDialog
          open={correcting}
          treeCode={h.treeCode}
          quantity={h.quantity ?? 0}
          previousQuantity={h.previousQuantity}
          canEdit={can('record.edit')}
          canRemove={can('record.archive')}
          saving={fix.correct.isLoading || fix.removeHarvest.isLoading}
          error={error}
          onClose={() => setCorrecting(false)}
          onSave={(quantity, reason) =>
            void fix.correct
              .mutateAsync({ harvest: h, quantity, reason })
              .then(() => refresh())
              .then(() => setCorrecting(false))
              .catch(e => setError(explain(e)))
          }
          onRemove={reason =>
            void fix.removeHarvest
              .mutateAsync({ harvest: h, reason })
              .then(() => refresh())
              .then(() => setCorrecting(false))
              .catch(e => setError(explain(e)))
          }
        />
      )}
    </AppPage>
  );
}
