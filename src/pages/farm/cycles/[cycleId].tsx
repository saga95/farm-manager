import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { type CycleStatus, nextCycleStatuses } from '@/domain/cycles';
import { useCurrentFarm, useSpaces, useZones } from '@/features/farm/hooks';
import { useInputItems } from '@/features/inventory/inputHooks';
import { EntityPhotos } from '@/features/media/components/EntityPhotos';
import { todayIso } from '@/features/plucking/hooks';
import { ActivityDialog } from '@/features/polytunnel/components/ActivityDialog';
import { CycleDialog } from '@/features/polytunnel/components/CycleDialog';
import { useCycle, useCycleActions } from '@/features/polytunnel/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-025 Crop cycle: status, plants, activity timeline, photos (#93, #94). */
export default function CyclePage() {
  const { t, i18n } = useTranslation('growing');
  const { t: tf } = useTranslation('farm');
  const { t: ti } = useTranslation('inventory');
  const router = useRouter();
  const cycleId =
    typeof router.query['cycleId'] === 'string'
      ? router.query['cycleId']
      : undefined;
  const detail = useCycle(cycleId);
  const { farm } = useCurrentFarm();
  const zones = useZones();
  const spaces = useSpaces();
  const inputs = useInputItems();
  const { can } = useTenant();
  const { update, record, removeActivity } = useCycleActions();
  const [recording, setRecording] = useState(false);
  const [activityId, setActivityId] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<CycleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const c = detail.data?.cycle;
  const activities = detail.data?.activities ?? [];
  const today = todayIso(farm?.timezone);
  const fmt = (iso?: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
          new Date(`${iso}T00:00:00`)
        )
      : null;
  const space = (spaces.data ?? []).find(s => s.id === c?.growingSpaceId);
  const unitName = (u?: string | null) =>
    u ? ti(`inputs.units.${u}`, { defaultValue: u }) : '';
  const fail = (e: unknown) =>
    setError(
      e instanceof ApiError && e.code === 'VALIDATION'
        ? e.message.replace(/^\w+:\s*/, '')
        : t('activityDialog.failed')
    );

  const move = (to: CycleStatus) => {
    if (!c) return;
    setConfirm(null);
    void update
      .mutateAsync({ cycle: c, changes: { status: to, statusDate: today } })
      .catch(fail);
  };

  return (
    <AppPage title={c?.name ?? t('cycles.title')} showQuickActions={false}>
      <Button
        component={NextLink}
        href='/farm/cycles'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('cycle.back')}
      </Button>
      {detail.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {detail.isError && (
        <EmptyState size='page' message={t('cycle.notFound')} />
      )}
      {c && (
        <Stack spacing={2}>
          <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            useFlexGap
            flexWrap='wrap'
          >
            <Chip
              label={t(`status.${c.status}`)}
              color='primary'
              variant='outlined'
            />
          </Stack>
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
              label={t('cycle.crop')}
              value={[c.cropName, c.variety].filter(Boolean).join(' · ')}
            />
            <StatTile
              label={t('cycle.where')}
              value={[c.zoneName, space?.name].filter(Boolean).join(' · ')}
            />
            <StatTile
              label={t('cycle.planted')}
              value={fmt(c.plantedAt)}
              caption={
                c.endedAt ? `${t('cycle.ended')} ${fmt(c.endedAt)}` : undefined
              }
            />
            <StatTile
              label={t('cycle.plants')}
              value={c.estimatedPlantCount}
              caption={
                c.areaUsed != null
                  ? `${t('cycle.area')}: ${c.areaUsed} ${tf(`options.${c.areaUnit ?? 'SQ_M'}`)}`
                  : undefined
              }
            />
          </Box>
          {c.notes && (
            <Alert severity='info' variant='outlined'>
              {c.notes}
            </Alert>
          )}

          {can('activity.record') && c.status !== 'CANCELLED' && (
            <Button
              variant='contained'
              size='large'
              onClick={() => {
                setActivityId(ulid()); // stable per dialog: a retried save replays
                setError(null);
                setRecording(true);
              }}
            >
              {t('cycle.record')}
            </Button>
          )}

          <SummaryCard
            title={t('cycle.timeline')}
            icon={<EventNoteOutlined fontSize='small' />}
          >
            {activities.length === 0 ? (
              <EmptyState message={t('cycle.noActivity')} />
            ) : (
              <List disablePadding aria-label={t('cycle.timeline')}>
                {activities.map((a, i) => (
                  <ListItem
                    key={a.id}
                    divider={i < activities.length - 1}
                    disableGutters
                    secondaryAction={
                      can('record.archive') ? (
                        <Button
                          size='small'
                          color='inherit'
                          onClick={() =>
                            void removeActivity.mutateAsync(a).catch(fail)
                          }
                        >
                          {t('cycle.removeActivity')}
                        </Button>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={`${fmt(a.activityDate)} · ${t(`activity.${a.activityType}`, { defaultValue: a.activityType })}`}
                      secondary={[
                        a.materialName && a.quantity
                          ? t('cycle.used', {
                              quantity: a.quantity,
                              unit: unitName(a.unit),
                              material: a.materialName,
                            })
                          : a.materialName,
                        !a.materialName && a.quantity
                          ? `${a.quantity} ${unitName(a.unit)}`
                          : null,
                        a.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </SummaryCard>

          <EntityPhotos
            entityId={c.id}
            name={c.name}
            category='CROP_PROGRESS'
          />

          {can('cycle.manage') && (
            <Stack spacing={1}>
              {confirm && (
                <Alert
                  severity='warning'
                  action={
                    <Stack direction='row' spacing={1}>
                      <Button
                        color='inherit'
                        size='small'
                        onClick={() => setConfirm(null)}
                      >
                        {t('activityDialog.cancel')}
                      </Button>
                      <Button
                        size='small'
                        variant='contained'
                        onClick={() => move(confirm)}
                      >
                        {t(`move.${confirm}`)}
                      </Button>
                    </Stack>
                  }
                >
                  {t(
                    confirm === 'CANCELLED'
                      ? 'move.confirmCancel'
                      : 'move.confirmComplete'
                  )}
                </Alert>
              )}
              <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                {nextCycleStatuses(c.status as CycleStatus).map(to => (
                  <Button
                    key={to}
                    variant={to === 'CANCELLED' ? 'text' : 'outlined'}
                    color={to === 'CANCELLED' ? 'error' : 'primary'}
                    disabled={update.isLoading}
                    onClick={() =>
                      to === 'COMPLETED' || to === 'CANCELLED'
                        ? setConfirm(to)
                        : move(to)
                    }
                  >
                    {t(`move.${to}`)}
                  </Button>
                ))}
                {c.status !== 'CANCELLED' && (
                  <Button onClick={() => setEditing(true)}>
                    {t('cycle.edit')}
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </Stack>
      )}
      {c && (
        <ActivityDialog
          open={recording}
          today={today}
          inputs={inputs.data ?? []}
          saving={record.isLoading}
          error={error}
          onClose={() => setRecording(false)}
          onSave={v =>
            void record
              .mutateAsync({ activityId, targetId: c.id, ...v })
              .then(() => setRecording(false))
              .catch(fail)
          }
        />
      )}
      {c && (
        <CycleDialog
          open={editing}
          cycle={c}
          zones={zones.data ?? []}
          spaces={spaces.data ?? []}
          today={today}
          saving={update.isLoading}
          error={error}
          onClose={() => setEditing(false)}
          onSave={fields =>
            void update
              .mutateAsync({ cycle: c, changes: fields })
              .then(() => setEditing(false))
              .catch(fail)
          }
        />
      )}
    </AppPage>
  );
}
