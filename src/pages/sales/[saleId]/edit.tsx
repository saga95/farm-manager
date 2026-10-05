import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Skeleton from '@mui/material/Skeleton';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useBuyers } from '@/features/buyers/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useProduceBatches } from '@/features/inventory/hooks';
import { todayIso } from '@/features/plucking/hooks';
import { SaleForm } from '@/features/sales/components/SaleForm';
import { useSale, useSaleActions } from '@/features/sales/hooks';
import { ApiError } from '@/lib/api';

/** Edit a completed sale; stock is reconciled by the difference (#88). */
export default function EditSalePage() {
  const { t } = useTranslation('sales');
  const router = useRouter();
  const saleId =
    typeof router.query['saleId'] === 'string'
      ? router.query['saleId']
      : undefined;
  const sale = useSale(saleId);
  const { farm } = useCurrentFarm();
  const buyers = useBuyers(true);
  // Include used-up batches: this sale may have emptied them
  const batches = useProduceBatches(false);
  const { update } = useSaleActions();
  const [error, setError] = useState<string | null>(null);

  const loading = sale.isLoading || buyers.isLoading || batches.isLoading;
  return (
    <AppPage title={t('form.editTitle')} showQuickActions={false}>
      {loading && <Skeleton variant='rounded' height={400} aria-hidden />}
      {sale.isError && <EmptyState size='page' message={t('sale.notFound')} />}
      {!loading && sale.data && (
        <SaleForm
          sale={sale.data}
          backfill={Boolean(sale.data.backfilled)}
          buyers={buyers.data ?? []}
          batches={batches.data ?? []}
          currency={sale.data.currency}
          today={todayIso(farm?.timezone)}
          saving={update.isLoading}
          error={error}
          onCancel={() => void router.push(`/sales/${sale.data!.id}`)}
          onSubmit={({ saleDate: _date, ...input }) => {
            setError(null);
            void update
              .mutateAsync({ sale: sale.data!, input })
              .then(s => router.push(`/sales/${s.id}`))
              .catch(e =>
                setError(
                  e instanceof ApiError && e.code === 'VALIDATION'
                    ? e.message.replace(/^\w+:\s*/, '')
                    : e instanceof ApiError && e.code === 'CONFLICT'
                      ? t('form.errors.conflict')
                      : t('form.errors.failed')
                )
              );
          }}
        />
      )}
    </AppPage>
  );
}
