import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { useProduceBatches } from '@/features/inventory/hooks';
import { EntityPhotos } from '@/features/media/components/EntityPhotos';
import { useSale, useSaleActions } from '@/features/sales/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-022 Sale detail: lines, calculated AND actual amounts, stock taken (#89). */
export default function SalePage() {
  const { t, i18n } = useTranslation('sales');
  const { t: ts } = useTranslation('samples');
  const { t: ti } = useTranslation('inventory');
  const router = useRouter();
  const saleId =
    typeof router.query['saleId'] === 'string'
      ? router.query['saleId']
      : undefined;
  const sale = useSale(saleId);
  const batches = useProduceBatches(false);
  const { remove, restore } = useSaleActions();
  const { can } = useTenant();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = sale.data;
  const money = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: s?.currency ?? 'LKR',
    maximumFractionDigits: 2,
  });
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const batchDate = new Map((batches.data ?? []).map(b => [b.id, b.batchDate]));
  const removed = Boolean(s?.deletedAt);
  const isCoconut = (s?.cropCode ?? 'COCONUT') === 'COCONUT';
  const unitLabel = ti(`units.${s?.quantityUnit ?? 'NUT'}`, {
    defaultValue: s?.quantityUnit ?? '',
  });
  const fail = (e: unknown) =>
    setError(
      e instanceof ApiError && e.code === 'VALIDATION'
        ? t('sale.stockUsed')
        : t('sale.failed')
    );

  return (
    <AppPage
      title={
        s ? t('sale.title', { date: fmtDate(s.saleDate) }) : t('history.title')
      }
      showQuickActions={false}
    >
      <Button
        component={NextLink}
        href='/sales/history'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('sale.back')}
      </Button>
      {sale.isLoading && (
        <Skeleton variant='rounded' height={300} aria-hidden />
      )}
      {sale.isError && <EmptyState size='page' message={t('sale.notFound')} />}
      {s && (
        <Stack spacing={2}>
          {removed && (
            <Alert
              severity='warning'
              action={
                can('record.restore') ? (
                  <Button
                    color='inherit'
                    size='small'
                    disabled={restore.isLoading}
                    onClick={() => void restore.mutateAsync(s).catch(fail)}
                  >
                    {t('sale.restore')}
                  </Button>
                ) : undefined
              }
            >
              {t('sale.removed')}
            </Alert>
          )}
          {error && (
            <Alert severity='error' role='alert'>
              {error}
            </Alert>
          )}
          <Typography variant='h3' component='h2'>
            {s.buyerName ?? t('sale.walkIn')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(4, 1fr)',
              },
              gap: 1.5,
            }}
          >
            <StatTile
              label={isCoconut ? t('sale.totalNuts') : t('sale.totalQty')}
              value={s.totalQuantity}
              unit={isCoconut ? undefined : unitLabel}
            />
            <StatTile
              label={t('sale.calculated')}
              value={money.format(s.calculatedAmount)}
            />
            <StatTile
              label={t('sale.actual')}
              value={
                s.actualAmountReceived != null
                  ? money.format(s.actualAmountReceived)
                  : t('sale.notEntered')
              }
            />
            <StatTile
              label={t('sale.difference')}
              value={
                s.difference != null
                  ? `${s.difference > 0 ? '+' : s.difference < 0 ? '−' : ''}${money.format(Math.abs(s.difference))}`
                  : undefined
              }
              caption={s.differenceReason ?? undefined}
            />
          </Box>
          <SummaryCard
            title={t('sale.lines')}
            icon={<ReceiptLongOutlined fontSize='small' />}
          >
            <List disablePadding aria-label={t('sale.lines')}>
              {s.lines.map((l, i) => (
                <ListItem
                  key={i}
                  divider={i < s.lines.length - 1}
                  disableGutters
                >
                  <ListItemText
                    primary={
                      isCoconut
                        ? t('sale.line', {
                            size: l.sizeClass
                              ? ts(`sizes.${l.sizeClass}`)
                              : t('sale.anySize'),
                            quantity: l.quantity,
                            price: money.format(l.unitPrice),
                          })
                        : t('sale.lineGeneric', {
                            quantity: l.quantity,
                            unit: unitLabel,
                            price: money.format(l.unitPrice),
                          })
                    }
                  />
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money.format(l.lineAmount)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </SummaryCard>
          <SummaryCard
            title={t('sale.stock')}
            icon={<Inventory2Outlined fontSize='small' />}
            tone='secondary'
          >
            <List disablePadding aria-label={t('sale.stock')}>
              {s.allocations.map(a => (
                <ListItem key={`${a.batchId}${a.state}`} disableGutters>
                  <ListItemText
                    primary={
                      isCoconut
                        ? t('sale.stockLine', {
                            quantity: a.quantity,
                            state: ti(
                              a.state === 'HUSKED'
                                ? 'produce.husked'
                                : 'produce.dehusked'
                            ).toLowerCase(),
                            date: batchDate.get(a.batchId)
                              ? fmtDate(batchDate.get(a.batchId)!)
                              : '…',
                          })
                        : t('sale.stockLineQty', {
                            quantity: a.quantity,
                            unit: unitLabel,
                            label: batchDate.get(a.batchId)
                              ? fmtDate(batchDate.get(a.batchId)!)
                              : '…',
                          })
                    }
                  />
                </ListItem>
              ))}
            </List>
          </SummaryCard>
          {s.notes && (
            <SummaryCard title={t('sale.notes')}>
              <Typography>{s.notes}</Typography>
            </SummaryCard>
          )}
          <EntityPhotos
            entityId={s.id}
            name={t('sale.title', { date: fmtDate(s.saleDate) })}
            category='SALE_LOT'
          />
          {!removed && (
            <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
              {can('record.edit') && (
                <Button
                  component={NextLink}
                  href={`/sales/${s.id}/edit`}
                  variant='outlined'
                >
                  {t('sale.edit')}
                </Button>
              )}
              {can('record.archive') &&
                (confirming ? (
                  <Alert
                    severity='warning'
                    action={
                      <Stack direction='row' spacing={1}>
                        <Button
                          color='inherit'
                          size='small'
                          onClick={() => setConfirming(false)}
                        >
                          {t('form.cancel')}
                        </Button>
                        <Button
                          color='error'
                          size='small'
                          variant='contained'
                          disabled={remove.isLoading}
                          onClick={() =>
                            void remove
                              .mutateAsync({ sale: s, reason: null })
                              .then(() => setConfirming(false))
                              .catch(fail)
                          }
                        >
                          {t('sale.removeYes')}
                        </Button>
                      </Stack>
                    }
                  >
                    {t('sale.removeConfirm')}
                  </Alert>
                ) : (
                  <Button color='error' onClick={() => setConfirming(true)}>
                    {t('sale.remove')}
                  </Button>
                ))}
            </Stack>
          )}
        </Stack>
      )}
    </AppPage>
  );
}
