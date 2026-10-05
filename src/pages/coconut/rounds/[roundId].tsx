import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { tokens } from '@/design-system';
import {
  nextPendingTree,
  roundEntries,
  summarizeRound,
} from '@/domain/plucking';
import { useTrees } from '@/features/coconut/hooks';
import { CaptureDialog } from '@/features/plucking/components/CaptureDialog';
import { CorrectHarvestDialog } from '@/features/plucking/components/CorrectHarvestDialog';
import { TreePicker } from '@/features/plucking/components/TreePicker';
import {
  useRound,
  useRoundActions,
  useRoundCorrections,
} from '@/features/plucking/hooks';
import { EntityPhotos } from '@/features/media/components/EntityPhotos';
import { RoundSamplesCard } from '@/features/samples/components/RoundSamplesCard';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-009 capture + SCR-010 review for one plucking round (plan first, any order). */
export default function RoundPage() {
  const { t, i18n } = useTranslation('plucking');
  const { t: tb } = useTranslation('backfill');
  const router = useRouter();
  const roundId =
    typeof router.query['roundId'] === 'string'
      ? router.query['roundId']
      : undefined;
  const detail = useRound(roundId);
  const trees = useTrees(true);
  const { record, plan, complete } = useRoundActions(roundId);
  const fix = useRoundCorrections(roundId);
  const { can } = useTenant();
  const [current, setCurrent] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [removingRound, setRemovingRound] = useState(false);
  const [roundReason, setRoundReason] = useState('');

  const round = detail.data?.round;
  const harvests = useMemo(() => detail.data?.harvests ?? [], [detail.data]);
  const treeById = useMemo(
    () => new Map((trees.data ?? []).map(tr => [tr.id, tr])),
    [trees.data]
  );
  const entries = useMemo(
    () =>
      round
        ? roundEntries(round.plannedTreeIds, round.skippedTreeIds, harvests)
        : [],
    [round, harvests]
  );
  const summary = summarizeRound(entries, harvests);
  const harvestByTree = useMemo(
    () => new Map(harvests.map(h => [h.treeId, h])),
    [harvests]
  );
  const removed = Boolean(round?.deletedAt);
  const open =
    !removed && (round?.status === 'IN_PROGRESS' || round?.status === 'DRAFT');
  const complete_ = round?.status === 'COMPLETE' && !removed;
  const canEdit = can('record.edit');
  const canArchive = can('record.archive');
  const canRestore = can('record.restore');
  const removedHarvests = detail.data?.removedHarvests ?? [];
  const correctingHarvest = correcting
    ? harvestByTree.get(correcting)
    : undefined;

  /** Map server errors from corrections to plain language. */
  const fixMessage = (e: unknown, stockKey: string) =>
    e instanceof ApiError && e.code === 'CONFLICT' && /stock/i.test(e.message)
      ? t(stockKey)
      : t('removed.failed');
  const canRecord = can('harvest.record');
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const code = (treeId: string) =>
    treeById.get(treeId)?.code ?? harvestByTree.get(treeId)?.treeCode ?? '…';

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'CONFLICT') {
      setCaptureError(t('capture.conflict'));
      void detail.refetch();
    } else {
      setCaptureError(t('capture.failed'));
    }
  };

  /** Move to the next pending tree after `treeId`, treating it as done. */
  const advance = (treeId: string) => {
    const after = entries.map(e =>
      e.treeId === treeId ? { ...e, state: 'RECORDED' as const } : e
    );
    const next = nextPendingTree(after, treeId);
    setCurrent(next);
    if (!next) setReviewing(true);
  };

  const save = async (quantity: number, approximate: boolean) => {
    if (!current) return;
    setCaptureError(null);
    try {
      await record.mutateAsync({ treeId: current, quantity, approximate });
      advance(current);
    } catch (e) {
      handleError(e);
    }
  };

  const skip = async () => {
    if (!current || !round) return;
    setCaptureError(null);
    try {
      await plan.mutateAsync({ round, changes: { skipTreeIds: [current] } });
      advance(current);
    } catch (e) {
      handleError(e);
    }
  };

  const addTrees = async () => {
    if (!round || toAdd.length === 0) return;
    try {
      await plan.mutateAsync({ round, changes: { addTreeIds: toAdd } });
      setAdding(false);
      setCurrent(toAdd[0] ?? null);
      setToAdd([]);
    } catch (e) {
      handleError(e);
    }
  };

  const doComplete = async () => {
    if (!round) return;
    try {
      const done = await complete.mutateAsync(round);
      setReviewing(false);
      setNotice(t('review.done', { nuts: done.totalNuts ?? 0 }));
    } catch (e) {
      handleError(e);
    }
  };

  const stateLabel = (treeId: string, state: string) => {
    if (state === 'RECORDED')
      return t('capture.recorded', {
        count: harvestByTree.get(treeId)?.quantity ?? 0,
      });
    return state === 'SKIPPED' ? t('capture.skipped') : t('capture.pending');
  };

  return (
    <AppPage
      title={
        round
          ? t('capture.title', { date: fmtDate(round.roundDate) })
          : t('rounds.title')
      }
      showQuickActions={false}
    >
      <Button
        component={NextLink}
        href='/coconut/rounds'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('rounds.title')}
      </Button>

      {detail.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {detail.isError && (
        <EmptyState size='page' message={t('capture.failed')} />
      )}
      {notice && (
        <Alert
          severity='success'
          sx={{ mb: 2 }}
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      )}

      {round && removed && (
        <Alert
          severity='warning'
          sx={{ mb: 2 }}
          action={
            canRestore ? (
              <Button
                color='inherit'
                size='small'
                disabled={fix.restoreRound.isLoading}
                onClick={() =>
                  void fix.restoreRound
                    .mutateAsync(round)
                    .catch(() => setNotice(null))
                }
              >
                {t('removed.restoreRound')}
              </Button>
            ) : undefined
          }
        >
          {t('removed.roundBanner')}
        </Alert>
      )}

      {round && (
        <Stack spacing={2}>
          <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            useFlexGap
            flexWrap='wrap'
          >
            <Chip
              label={t(`status.${round.status}`)}
              color={open ? 'primary' : 'success'}
              variant='outlined'
            />
            {round.backfilled && round.source && (
              <Chip label={tb(`badge.${round.source}`)} variant='outlined' />
            )}
            {Boolean(round.unattributedQuantity) && (
              <Typography color='text.secondary'>
                {tb('unattributed', { count: round.unattributedQuantity ?? 0 })}
              </Typography>
            )}
            {round.pluckerName && (
              <Typography color='text.secondary'>
                {round.pluckerName}
              </Typography>
            )}
          </Stack>

          {/* Running total + progress */}
          <Card>
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                '&:last-child': { pb: 2 },
              }}
            >
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  {t('capture.total')}
                </Typography>
                <Typography variant='h1' component='p' aria-live='polite'>
                  {summary.totalNuts}
                  <Typography
                    component='span'
                    variant='body1'
                    color='text.secondary'
                    sx={{ ml: 1 }}
                  >
                    {t('capture.nuts')}
                  </Typography>
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant='body2' color='text.secondary'>
                  {t('capture.progress', {
                    done: summary.recorded + summary.skipped,
                    total: summary.planned,
                  })}
                </Typography>
                <LinearProgress
                  variant='determinate'
                  value={
                    summary.planned
                      ? ((summary.recorded + summary.skipped) /
                          summary.planned) *
                        100
                      : 0
                  }
                  aria-hidden
                  sx={{
                    mt: 1,
                    height: tokens.spacing[2],
                    borderRadius: tokens.radius.full,
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Checklist: tap ANY tree (plucker's order is free) */}
          <Card>
            <List aria-label={t('capture.checklist')} disablePadding>
              {entries.map((entry, i) => (
                <ListItem
                  key={entry.treeId}
                  disablePadding
                  divider={i < entries.length - 1}
                >
                  <ListItemButton
                    disabled={
                      open
                        ? !canRecord
                        : !(
                            complete_ &&
                            entry.state === 'RECORDED' &&
                            (canEdit || canArchive)
                          )
                    }
                    onClick={() => {
                      if (open) {
                        setCaptureError(null);
                        setCurrent(entry.treeId);
                      } else {
                        setFixError(null);
                        setCorrecting(entry.treeId);
                      }
                    }}
                    sx={{ borderRadius: 0, py: 1.5 }}
                  >
                    <ListItemText
                      primary={code(entry.treeId)}
                      primaryTypographyProps={{
                        fontWeight: 700,
                        fontSize: tokens.typography.fontSize.lg,
                      }}
                    />
                    <Chip
                      size='small'
                      label={stateLabel(entry.treeId, entry.state)}
                      color={entry.state === 'RECORDED' ? 'success' : 'default'}
                      variant={
                        entry.state === 'PENDING' ? 'outlined' : 'filled'
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Card>

          {open && canRecord && (
            <Button
              variant='outlined'
              startIcon={<AddOutlined aria-hidden />}
              onClick={() => setAdding(true)}
            >
              {t('capture.addTree')}
            </Button>
          )}

          {roundId && harvests.length > 0 && (
            <RoundSamplesCard
              roundId={roundId}
              harvests={harvests}
              samples={detail.data?.samples ?? []}
              order={round.plannedTreeIds}
              canRecord={can('sample.record')}
            />
          )}

          {removedHarvests.length > 0 && (
            <Card component='section' aria-labelledby='removed-title'>
              <CardContent sx={{ pb: 0 }}>
                <Typography id='removed-title' variant='h3' component='h2'>
                  {t('removed.title')}
                </Typography>
              </CardContent>
              <List disablePadding>
                {removedHarvests.map(h => (
                  <ListItem
                    key={h.id}
                    divider
                    secondaryAction={
                      canRestore && !removed ? (
                        <Button
                          size='small'
                          disabled={fix.restoreHarvest.isLoading}
                          onClick={() =>
                            void fix.restoreHarvest
                              .mutateAsync(h)
                              .catch(e =>
                                setNotice(fixMessage(e, 'removed.failed'))
                              )
                          }
                        >
                          {t('removed.restore')}
                        </Button>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={t('removed.item', {
                        code: h.treeCode,
                        count: h.quantity ?? 0,
                      })}
                      secondary={h.deleteReason ?? undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          {roundId && (
            <EntityPhotos
              entityId={roundId}
              name={fmtDate(round.roundDate)}
              category='HARVEST_PILE'
            />
          )}

          {canArchive && !removed && !open && (
            <Button
              color='error'
              variant='outlined'
              onClick={() => {
                setRoundReason('');
                setFixError(null);
                setRemovingRound(true);
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('removed.removeRound')}
            </Button>
          )}

          {!open && harvests.length === 0 && (
            <EmptyState message={t('detail.noRecords')} />
          )}

          {open && canRecord && (
            <Paper
              elevation={0}
              sx={{
                position: 'sticky',
                bottom: {
                  xs: `calc(${tokens.spacing[14]} + ${tokens.spacing[2]})`,
                  md: tokens.spacing[4],
                },
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                zIndex: tokens.zIndex.raised,
              }}
            >
              <Stack direction='row' spacing={1}>
                {summary.pending > 0 && (
                  <Button
                    fullWidth
                    size='large'
                    variant='contained'
                    onClick={() =>
                      setCurrent(
                        nextPendingTree(entries) ?? entries[0]?.treeId ?? null
                      )
                    }
                  >
                    {t('capture.nextTree', {
                      code: code(nextPendingTree(entries) ?? ''),
                    })}
                  </Button>
                )}
                <Button
                  fullWidth
                  size='large'
                  variant={summary.pending > 0 ? 'outlined' : 'contained'}
                  onClick={() => setReviewing(true)}
                >
                  {t('capture.review')}
                </Button>
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      {current && round && (
        <CaptureDialog
          open={Boolean(current)}
          treeCode={code(current)}
          initialQuantity={harvestByTree.get(current)?.quantity}
          initialApproximate={
            harvestByTree.get(current)?.recordQuality === 'APPROXIMATE'
          }
          saving={record.isLoading || plan.isLoading}
          error={captureError}
          hasNext={entries.some(
            e => e.state === 'PENDING' && e.treeId !== current
          )}
          onSave={(q, a) => void save(q, a)}
          onSkip={() => void skip()}
          onClose={() => setCurrent(null)}
        />
      )}

      {round && (
        <FormDialog
          open={adding}
          title={t('capture.addTitle')}
          submitLabel={t('capture.add')}
          submittingLabel={t('capture.saving')}
          cancelLabel={t('review.back')}
          submitting={plan.isLoading}
          error={captureError}
          onClose={() => setAdding(false)}
          onSubmit={() => void addTrees()}
        >
          <TreePicker
            trees={(trees.data ?? []).filter(
              tr => !['REMOVED', 'DEAD', 'ARCHIVED'].includes(tr.status)
            )}
            selected={toAdd}
            onChange={setToAdd}
            excludeIds={entries.map(e => e.treeId)}
            labels={{
              search: t('new.search'),
              selected: t('new.selected', { count: toAdd.length }),
              hint: t('new.selectedHint'),
              list: t('capture.addTitle'),
            }}
          />
        </FormDialog>
      )}

      {round && (
        <FormDialog
          open={reviewing}
          title={t('review.title')}
          submitLabel={
            complete.isLoading ? t('review.completing') : t('review.complete')
          }
          submittingLabel={t('review.completing')}
          cancelLabel={t('review.back')}
          submitting={complete.isLoading}
          error={captureError}
          onClose={() => setReviewing(false)}
          onSubmit={() => void doComplete()}
        >
          <Stack
            component='dl'
            direction='row'
            spacing={3}
            sx={{ m: 0 }}
            useFlexGap
            flexWrap='wrap'
          >
            {(
              [
                ['planned', summary.planned],
                ['recorded', summary.recorded],
                ['skipped', summary.skipped],
                ['pending', summary.pending],
              ] as const
            ).map(([k, n]) => (
              <Box key={k}>
                <Typography
                  component='dt'
                  variant='caption'
                  color='text.secondary'
                >
                  {t(`review.${k}`)}
                </Typography>
                <Typography component='dd' variant='h3' sx={{ m: 0 }}>
                  {n}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Divider />
          <Typography>
            {t('review.total')}: <strong>{summary.totalNuts}</strong>
          </Typography>
          {summary.pending > 0 && (
            <Alert severity='warning'>
              {t('review.pendingWarning', { count: summary.pending })}
            </Alert>
          )}
          {summary.recorded === 0 ? (
            <Alert severity='info'>{t('review.needOne')}</Alert>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              {t('review.confirm', { nuts: summary.totalNuts })}
            </Typography>
          )}
        </FormDialog>
      )}

      {correctingHarvest && (
        <CorrectHarvestDialog
          open
          treeCode={correctingHarvest.treeCode}
          quantity={correctingHarvest.quantity ?? 0}
          previousQuantity={correctingHarvest.previousQuantity}
          canEdit={canEdit}
          canRemove={canArchive}
          saving={fix.correct.isLoading || fix.removeHarvest.isLoading}
          error={fixError}
          onSave={(quantity, reason) =>
            void fix.correct
              .mutateAsync({ harvest: correctingHarvest, quantity, reason })
              .then(() => setCorrecting(null))
              .catch(e => setFixError(fixMessage(e, 'correct.stockUsed')))
          }
          onRemove={reason =>
            void fix.removeHarvest
              .mutateAsync({ harvest: correctingHarvest, reason })
              .then(() => setCorrecting(null))
              .catch(e => setFixError(fixMessage(e, 'correct.stockUsed')))
          }
          onClose={() => setCorrecting(null)}
        />
      )}

      {round && (
        <FormDialog
          open={removingRound}
          title={t('removed.removeRoundTitle')}
          submitLabel={t('removed.removeRoundYes')}
          submittingLabel={t('removed.removing')}
          cancelLabel={t('review.back')}
          submitting={fix.removeRound.isLoading}
          error={fixError}
          onClose={() => setRemovingRound(false)}
          onSubmit={() =>
            void fix.removeRound
              .mutateAsync({
                round,
                reason: roundReason.trim() === '' ? null : roundReason.trim(),
              })
              .then(() => setRemovingRound(false))
              .catch(e => setFixError(fixMessage(e, 'removed.stockUsed')))
          }
        >
          <Typography>{t('removed.removeRoundBody')}</Typography>
          <TextField
            label={t('removed.reason')}
            value={roundReason}
            onChange={e => setRoundReason(e.target.value)}
          />
        </FormDialog>
      )}
    </AppPage>
  );
}
