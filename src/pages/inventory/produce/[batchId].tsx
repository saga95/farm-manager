import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { useCurrentFarm } from '@/features/farm/hooks';
import { MovementList } from '@/features/inventory/components/MovementList';
import {
  type StockAction,
  StockActionDialog,
  type StockActionValues,
} from '@/features/inventory/components/StockActionDialog';
import { useProduceBatch, useStockActions } from '@/features/inventory/hooks';
import { todayIso } from '@/features/plucking/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-016 Stock batch: balance by state, dehusk / use / adjust, history (#77–#79). */
export default function ProduceBatchPage() {
  const { t, i18n } = useTranslation('inventory');
  const router = useRouter();
  const batchId =
    typeof router.query['batchId'] === 'string'
      ? router.query['batchId']
      : undefined;
  const detail = useProduceBatch(batchId);
  const { farm } = useCurrentFarm();
  const { can } = useTenant();
  const { move, dehusk, newOperationId } = useStockActions(batchId);
  const [action, setAction] = useState<StockAction | null>(null);
  // One operation id per open dialog: a retried save is the same operation.
  const [operationId, setOperationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pages = detail.data?.pages ?? [];
  const batch = pages[0]?.batch;
  const transactions = pages.flatMap(p => p.transactions);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const usable = batch && batch.status !== 'VOID';

  const open = (a: StockAction) => {
    setError(null);
    setOperationId(newOperationId());
    setAction(a);
  };

  const save = async (v: StockActionValues) => {
    setError(null);
    try {
      if (v.transactionType === 'PROCESSING') {
        await dehusk.mutateAsync({
          operationId,
          quantity: v.quantity,
          transactionDate: v.transactionDate,
          notes: v.notes,
        });
      } else {
        await move.mutateAsync({ operationId, ...v });
      }
      setAction(null);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.code === 'VALIDATION' &&
        e.message.startsWith('quantity')
      ) {
        setError(e.message.replace(/^quantity:\s*/, ''));
      } else if (e instanceof ApiError && e.code === 'CONFLICT') {
        setError(t('dialog.conflict'));
      } else {
        setError(t('dialog.failed'));
      }
    }
  };

  return (
    <AppPage
      title={
        batch
          ? t('batch.title', { date: fmt(batch.batchDate) })
          : t('produce.title')
      }
      showQuickActions={false}
    >
      <Button
        component={NextLink}
        href='/inventory/produce'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('batch.back')}
      </Button>
      {detail.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {detail.isError && (
        <EmptyState size='page' message={t('batch.notFound')} />
      )}
      {batch && (
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            <StatTile
              label={t('produce.husked')}
              value={batch.availableByState.HUSKED}
              unit={t('produce.nuts')}
            />
            <StatTile
              label={t('produce.dehusked')}
              value={batch.availableByState.DEHUSKED}
              unit={t('produce.nuts')}
            />
            <StatTile
              label={t('produce.total')}
              value={batch.available}
              unit={t('produce.nuts')}
            />
            <StatTile
              label={t('batch.received')}
              value={batch.quantityReceived}
              unit={t('produce.nuts')}
            />
          </Box>
          {usable && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {can('inventory.dehusk') && (
                <Button
                  variant='contained'
                  size='large'
                  disabled={batch.availableByState.HUSKED === 0}
                  onClick={() => open('dehusk')}
                >
                  {t('batch.dehusk')}
                </Button>
              )}
              {can('inventory.adjust') && (
                <Button
                  variant='outlined'
                  size='large'
                  onClick={() => open('move')}
                >
                  {t('batch.move')}
                </Button>
              )}
            </Stack>
          )}
          <SummaryCard
            title={t('batch.history')}
            icon={<HistoryOutlined fontSize='small' />}
          >
            {transactions.length === 0 ? (
              <EmptyState message={t('batch.noHistory')} />
            ) : (
              <Card variant='outlined'>
                <MovementList
                  transactions={transactions}
                  label={t('batch.history')}
                />
              </Card>
            )}
            {detail.hasNextPage && (
              <Button
                onClick={() => void detail.fetchNextPage()}
                disabled={detail.isFetchingNextPage}
                sx={{ mt: 1 }}
              >
                {t('batch.loadMore')}
              </Button>
            )}
          </SummaryCard>
        </Stack>
      )}
      {batch && (
        <StockActionDialog
          open={action !== null}
          action={action ?? 'move'}
          available={batch.availableByState}
          today={todayIso(farm?.timezone)}
          saving={move.isLoading || dehusk.isLoading}
          error={error}
          onSave={v => void save(v)}
          onClose={() => setAction(null)}
        />
      )}
    </AppPage>
  );
}
