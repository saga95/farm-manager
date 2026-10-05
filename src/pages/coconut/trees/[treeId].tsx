import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import ManageHistoryOutlined from '@mui/icons-material/ManageHistoryOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { TreeDialog } from '@/features/coconut/components/TreeDialog';
import { TreeStatusChip } from '@/features/coconut/components/TreeStatusChip';
import { useTree, useTreeHistory } from '@/features/coconut/hooks';
import { PredictionCard } from '@/features/prediction/components/PredictionCard';
import { EntityPhotos } from '@/features/media/components/EntityPhotos';
import { SizeHistoryCard } from '@/features/samples/components/SizeHistoryCard';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { useZones } from '@/features/farm/hooks';
import { ChangeHistory } from '@/features/records/ChangeHistory';
import { useTenant } from '@/features/tenant';
import { type TreeHarvest, setHarvestPredictionUse } from '@/lib/api';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack component='div' spacing={0.25}>
      <Typography component='dt' variant='caption' color='text.secondary'>
        {label}
      </Typography>
      <Typography component='dd' sx={{ m: 0 }}>
        {value}
      </Typography>
    </Stack>
  );
}

/** SCR-007 Coconut tree profile (shell): identity, details, history placeholder (§7.2). */
export default function TreeProfilePage() {
  const { t } = useTranslation('coconut');
  const router = useRouter();
  const treeId =
    typeof router.query['treeId'] === 'string'
      ? router.query['treeId']
      : undefined;
  const tree = useTree(treeId);
  const history = useTreeHistory(treeId);
  const { t: tb } = useTranslation('backfill');
  const { t: tr } = useTranslation('records');
  const qc = useQueryClient();
  // AC-BF-005: include / exclude a harvest from prediction
  const predictionUse = useMutation({
    mutationFn: (a: { harvest: TreeHarvest; exclude: boolean }) =>
      setHarvestPredictionUse(tenant?.tenantId ?? '', a.harvest, a.exclude),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treeHistory'] }),
  });
  const summary = history.data?.summary;
  const { i18n } = useTranslation();
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const zones = useZones(true);
  const { can, tenant } = useTenant();
  const canEdit = can('record.edit');
  const [editing, setEditing] = useState(false);
  const { data } = tree;
  const zone = data?.zoneId
    ? zones.data?.find(z => z.id === data.zoneId)?.name
    : undefined;
  const notSet = t('tree.notSet');

  return (
    <AppPage
      title={data ? data.code : t('trees.title')}
      actions={
        data && can('tree.manage') ? (
          <Button
            variant='outlined'
            startIcon={<EditOutlined aria-hidden />}
            onClick={() => setEditing(true)}
          >
            {t('tree.edit')}
          </Button>
        ) : undefined
      }
    >
      <Button
        component={NextLink}
        href='/coconut/trees'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 2 }}
      >
        {t('tree.back')}
      </Button>

      {tree.isLoading && (
        <Skeleton variant='rounded' height={200} aria-hidden />
      )}
      {tree.isError && <EmptyState size='page' message={t('tree.notFound')} />}

      {data && (
        <Stack spacing={2}>
          <Stack direction='row' spacing={1.5} alignItems='center'>
            <TreeStatusChip status={data.status} size='medium' />
            {data.displayLabel && (
              <Typography color='text.secondary'>
                {data.displayLabel}
              </Typography>
            )}
          </Stack>

          <Card>
            <CardContent>
              <Typography variant='h4' component='h2' sx={{ mb: 2 }}>
                {t('tree.details')}
              </Typography>
              <Stack
                component='dl'
                sx={{
                  m: 0,
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
                }}
              >
                <Detail label={t('tree.code')} value={data.code} />
                <Detail label={t('tree.zone')} value={zone ?? notSet} />
                <Detail
                  label={t('tree.variety')}
                  value={data.variety ?? notSet}
                />
                <Detail
                  label={t('tree.plantedAt')}
                  value={data.plantedAt ?? notSet}
                />
                <Detail
                  label={t('tree.locationNote')}
                  value={data.locationNote ?? notSet}
                />
              </Stack>
              {data.notes && (
                <Typography
                  sx={{ mt: 2, whiteSpace: 'pre-wrap' }}
                  color='text.secondary'
                >
                  {data.notes}
                </Typography>
              )}
            </CardContent>
          </Card>

          {history.data && (
            <>
              {/* §7.2 summary tiles: missing values show "—", never 0 */}
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
                  label={t('history.lastPlucked')}
                  value={
                    summary?.lastHarvestDate
                      ? fmtDate(summary.lastHarvestDate)
                      : null
                  }
                  caption={
                    summary?.daysSinceLast != null
                      ? t('history.daysAgo', { count: summary.daysSinceLast })
                      : undefined
                  }
                />
                <StatTile
                  label={t('history.lastCount')}
                  value={summary?.lastQuantity}
                  unit={t('history.nuts')}
                />
                <StatTile
                  label={t('history.average')}
                  value={summary?.averagePerHarvest}
                  unit={t('history.nuts')}
                />
                <StatTile
                  label={t('history.best')}
                  value={summary?.best}
                  unit={t('history.nuts')}
                />
                <StatTile
                  label={t('history.thisYear')}
                  value={summary?.currentYearTotal}
                  unit={t('history.nuts')}
                />
                <StatTile
                  label={t('history.lifetime')}
                  value={summary?.lifetimeTotal}
                  unit={t('history.nuts')}
                />
                <StatTile
                  label={t('history.records')}
                  value={summary?.harvestCount}
                />
              </Box>
              <PredictionCard prediction={history.data.prediction} />
              <SizeHistoryCard history={history.data.sizeHistory} />
            </>
          )}

          {tree.data && can('audit.view') && (
            <SummaryCard
              title={tr('history.section')}
              icon={<ManageHistoryOutlined fontSize='small' />}
            >
              <ChangeHistory entityId={tree.data.id} />
            </SummaryCard>
          )}
          {tree.data && (
            <EntityPhotos
              entityId={tree.data.id}
              name={tree.data.code}
              category='TREE_PROFILE'
            />
          )}

          <SummaryCard
            title={t('history.title')}
            icon={<HistoryOutlined fontSize='small' />}
          >
            {history.isLoading ? (
              <Skeleton variant='rounded' height={120} aria-hidden />
            ) : (history.data?.harvests ?? []).length === 0 ? (
              /* §7.2: "No history" must be distinguishable from "Recorded harvest = 0" */
              <EmptyState message={t('tree.noHistory')} />
            ) : (
              <List disablePadding aria-label={t('history.title')}>
                {history.data!.harvests.map((h, i) => (
                  <ListItem
                    key={h.id}
                    divider={i < history.data!.harvests.length - 1}
                    disableGutters
                  >
                    <ListItemText
                      primary={`${h.quantity ?? '—'} ${t('history.nuts')}`}
                      secondary={
                        <>
                          {fmtDate(h.harvestDate)}
                          {h.source && h.source !== 'LIVE_APP' && (
                            <> · {tb(`badge.${h.source}`)}</>
                          )}
                          {canEdit ? (
                            <FormControlLabel
                              sx={{ display: 'flex', ml: 0 }}
                              control={
                                <Switch
                                  size='small'
                                  checked={!h.excludeFromPrediction}
                                  disabled={predictionUse.isLoading}
                                  onChange={e =>
                                    void predictionUse.mutateAsync({
                                      harvest: h,
                                      exclude: !e.target.checked,
                                    })
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
                            h.excludeFromPrediction && (
                              <> · {tb('prediction.excluded')}</>
                            )
                          )}
                        </>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                    {h.recordQuality === 'APPROXIMATE' && (
                      <Chip
                        size='small'
                        variant='outlined'
                        label={t('history.approximate')}
                        sx={{ mr: 1 }}
                      />
                    )}
                    <Button
                      component={NextLink}
                      href={`/coconut/harvests/${h.id}`}
                      size='small'
                    >
                      {t('history.details')}
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </SummaryCard>
        </Stack>
      )}

      {data && (
        <TreeDialog
          open={editing}
          tree={data}
          zones={zones.data ?? []}
          onClose={() => setEditing(false)}
        />
      )}
    </AppPage>
  );
}
