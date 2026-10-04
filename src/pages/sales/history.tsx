import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useBuyers } from '@/features/buyers/hooks';
import { EntityList } from '@/features/farm/components/EntityList';
import { useSales } from '@/features/sales/hooks';
import { useTenant } from '@/features/tenant';

/** SCR-023 Sales history: newest first, by buyer and date, paginated (#89). */
export default function SalesHistoryPage() {
  const { t, i18n } = useTranslation('sales');
  const { t: ti } = useTranslation('inventory');
  const router = useRouter();
  const { can, tenant } = useTenant();
  const buyers = useBuyers(true);
  const [buyerId, setBuyerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const filters = useMemo(
    () => ({
      buyerId: buyerId || null,
      from: from || null,
      to: to || null,
      includeDeleted: showRemoved,
    }),
    [buyerId, from, to, showRemoved]
  );
  const sales = useSales(filters);
  const list = (sales.data?.pages ?? []).flatMap(p => p.sales);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <AppPage
      title={t('history.title')}
      actions={
        can('sale.record') ? (
          <Button
            component={NextLink}
            href='/sales/new'
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
          >
            {t('history.record')}
          </Button>
        ) : undefined
      }
    >
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 1fr 1fr' },
          mb: 1,
        }}
      >
        <TextField
          select
          label={t('history.buyer')}
          value={buyerId}
          onChange={e => setBuyerId(e.target.value)}
          sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        >
          <MenuItem value=''>{t('history.allBuyers')}</MenuItem>
          {(buyers.data ?? []).map(b => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t('history.from')}
          type='date'
          value={from}
          onChange={e => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t('history.to')}
          type='date'
          value={to}
          onChange={e => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      {can('record.restore') && (
        <FormControlLabel
          control={
            <Switch
              checked={showRemoved}
              onChange={e => setShowRemoved(e.target.checked)}
            />
          }
          label={t('history.showRemoved')}
          sx={{ mb: 1 }}
        />
      )}
      {sales.isLoading ? (
        <Skeleton variant='rounded' height={240} aria-hidden />
      ) : (
        <EntityList
          label={t('history.title')}
          rows={list.map(s => ({
            id: s.id,
            primary: `${fmtDate(s.saleDate)} · ${s.buyerName ?? t('sale.walkIn')}`,
            secondary: t('history.rowQty', {
              quantity: s.totalQuantity,
              unit: ti(`units.${s.quantityUnit ?? 'NUT'}`, {
                defaultValue: s.quantityUnit ?? '',
              }),
              amount: money(
                s.actualAmountReceived ?? s.calculatedAmount,
                s.currency || tenant?.currency || 'LKR'
              ),
            }),
            badge: s.deletedAt ? t('history.removed') : undefined,
          }))}
          onSelect={id => void router.push(`/sales/${id}`)}
          empty={
            <EmptyState
              size='page'
              icon={<ReceiptLongOutlined fontSize='large' />}
              message={t('history.empty')}
            />
          }
        />
      )}
      {sales.hasNextPage && (
        <Button
          onClick={() => void sales.fetchNextPage()}
          disabled={sales.isFetchingNextPage}
          sx={{ mt: 1 }}
        >
          {t('history.loadMore')}
        </Button>
      )}
    </AppPage>
  );
}
