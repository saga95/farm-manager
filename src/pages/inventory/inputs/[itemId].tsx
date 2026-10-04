import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import type { InputTxnType } from '@/domain/inputs';
import { useCurrentFarm } from '@/features/farm/hooks';
import { InputItemDialog } from '@/features/inventory/components/InputItemDialog';
import { InputMovementDialog } from '@/features/inventory/components/InputMovementDialog';
import { useInputActions, useInputItem } from '@/features/inventory/inputHooks';
import { todayIso } from '@/features/plucking/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-018 Farm-input item: quantity, low-stock flag, movements (#80, #81). */
export default function InputItemPage() {
  const { t, i18n } = useTranslation('inventory');
  const router = useRouter();
  const itemId =
    typeof router.query['itemId'] === 'string'
      ? router.query['itemId']
      : undefined;
  const detail = useInputItem(itemId);
  const { farm } = useCurrentFarm();
  const { can } = useTenant();
  const { update, move } = useInputActions(itemId);
  const [moving, setMoving] = useState<InputTxnType | null>(null);
  const [operationId, setOperationId] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = detail.data?.pages ?? [];
  const item = pages[0]?.item;
  const transactions = pages.flatMap(p => p.transactions);
  const canManage = can('input.manage');
  const unit = (u: string) => t(`inputs.units.${u}`, { defaultValue: u });
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const active = item?.status !== 'ARCHIVED';

  const openMove = (type: InputTxnType) => {
    setError(null);
    setOperationId(ulid());
    setMoving(type);
  };

  const fail = (e: unknown) =>
    setError(
      e instanceof ApiError && e.code === 'VALIDATION'
        ? e.message.replace(/^\w+:\s*/, '')
        : t('inputDialog.failed')
    );

  return (
    <AppPage title={item?.name ?? t('inputs.title')} showQuickActions={false}>
      <Button
        component={NextLink}
        href='/inventory/inputs'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('inputItem.back')}
      </Button>
      {detail.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {detail.isError && (
        <EmptyState size='page' message={t('inputItem.notFound')} />
      )}
      {item && (
        <Stack spacing={2}>
          {item.lowStock && active && (
            <Alert severity='warning' icon={<WarningAmberOutlined />}>
              {t('inputs.lowStock')} ·{' '}
              {t('inputs.reorderAt', {
                level: item.reorderLevel,
                unit: unit(item.unit),
              })}
            </Alert>
          )}
          {!active && <Alert severity='info'>{t('inputs.archived')}</Alert>}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            <StatTile
              label={t('inputItem.inStock')}
              value={item.quantity}
              unit={unit(item.unit)}
            />
            <StatTile
              label={t('inputItem.reorderLevel')}
              value={item.reorderLevel ?? t('inputItem.notSet')}
              unit={item.reorderLevel != null ? unit(item.unit) : undefined}
            />
          </Box>
          <Typography color='text.secondary'>
            {t(`inputs.categories.${item.category}`, {
              defaultValue: item.category,
            })}
            {item.notes ? ` · ${item.notes}` : ''}
          </Typography>
          {canManage && active && (
            <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
              <Button
                variant='contained'
                size='large'
                onClick={() => openMove('STOCK_IN')}
              >
                {t('inputItem.stockIn')}
              </Button>
              <Button
                variant='outlined'
                size='large'
                onClick={() => openMove('STOCK_OUT')}
                disabled={item.quantity <= 0}
              >
                {t('inputItem.use')}
              </Button>
              <Button
                variant='outlined'
                size='large'
                onClick={() => openMove('ADJUSTMENT')}
              >
                {t('inputItem.adjust')}
              </Button>
            </Stack>
          )}
          <SummaryCard
            title={t('inputItem.history')}
            icon={<HistoryOutlined fontSize='small' />}
          >
            {transactions.length === 0 ? (
              <EmptyState message={t('inputItem.noHistory')} />
            ) : (
              <Card variant='outlined'>
                <List aria-label={t('inputItem.history')} disablePadding>
                  {transactions.map((txn, i) => (
                    <ListItem
                      key={txn.id}
                      divider={i < transactions.length - 1}
                    >
                      <ListItemText
                        primary={t(`inputItem.txn.${txn.transactionType}`, {
                          defaultValue: txn.transactionType,
                        })}
                        secondary={[
                          fmt(txn.transactionDate),
                          txn.reason,
                          txn.notes,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                      <Stack alignItems='flex-end' sx={{ ml: 2 }}>
                        <Typography
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {`${txn.transactionType === 'STOCK_OUT' || txn.quantity < 0 ? '−' : '+'}${Math.abs(txn.quantity)} ${unit(item.unit)}`}
                        </Typography>
                        {txn.balanceAfter != null && (
                          <Typography variant='caption' color='text.secondary'>
                            {t('inputItem.balanceAfter', {
                              quantity: txn.balanceAfter,
                              unit: unit(item.unit),
                            })}
                          </Typography>
                        )}
                      </Stack>
                    </ListItem>
                  ))}
                </List>
              </Card>
            )}
            {detail.hasNextPage && (
              <Button
                onClick={() => void detail.fetchNextPage()}
                disabled={detail.isFetchingNextPage}
                sx={{ mt: 1 }}
              >
                {t('inputItem.loadMore')}
              </Button>
            )}
          </SummaryCard>
          {canManage && (
            <Stack direction='row' spacing={1}>
              {active && (
                <Button
                  onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  {t('inputItem.edit')}
                </Button>
              )}
              <Button
                color={active ? 'error' : 'primary'}
                disabled={update.isLoading}
                onClick={() =>
                  void update
                    .mutateAsync({
                      item,
                      changes: { status: active ? 'ARCHIVED' : 'ACTIVE' },
                    })
                    .catch(fail)
                }
              >
                {active ? t('inputItem.archive') : t('inputItem.restore')}
              </Button>
            </Stack>
          )}
        </Stack>
      )}
      {item && moving && (
        <InputMovementDialog
          open
          type={moving}
          item={item}
          today={todayIso(farm?.timezone)}
          saving={move.isLoading}
          error={error}
          onClose={() => setMoving(null)}
          onSave={v =>
            void move
              .mutateAsync({ operationId, ...v })
              .then(() => setMoving(null))
              .catch(fail)
          }
        />
      )}
      {item && (
        <InputItemDialog
          open={editing}
          item={item}
          saving={update.isLoading}
          error={error}
          onClose={() => setEditing(false)}
          onSave={fields =>
            void update
              .mutateAsync({
                item,
                changes: {
                  name: fields.name,
                  category: fields.category,
                  notes: fields.notes,
                  ...(fields.reorderLevel === null
                    ? { clearReorderLevel: true }
                    : { reorderLevel: fields.reorderLevel }),
                },
              })
              .then(() => setEditing(false))
              .catch(fail)
          }
        />
      )}
    </AppPage>
  );
}
