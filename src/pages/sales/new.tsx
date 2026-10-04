import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Skeleton from '@mui/material/Skeleton';
import { AppPage } from '@/components/AppPage';
import { useBuyers } from '@/features/buyers/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useProduceBatches } from '@/features/inventory/hooks';
import { todayIso } from '@/features/plucking/hooks';
import { SaleForm } from '@/features/sales/components/SaleForm';
import { useSaleActions } from '@/features/sales/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError } from '@/lib/api';

/** SCR-021 Record sale (#86, #87). */
export default function NewSalePage() {
  const { t } = useTranslation('sales');
  const router = useRouter();
  const { tenant } = useTenant();
  const { farm } = useCurrentFarm();
  const buyers = useBuyers();
  const batches = useProduceBatches(true);
  const { record } = useSaleActions();
  const [saleId] = useState(ulid); // stable per visit: a retried save replays (AC-SL-006)
  const [error, setError] = useState<string | null>(null);
  const preset =
    typeof router.query['buyer'] === 'string' ? router.query['buyer'] : null;

  return (
    <AppPage title={t('form.newTitle')} showQuickActions={false}>
      {buyers.isLoading || batches.isLoading ? (
        <Skeleton variant='rounded' height={400} aria-hidden />
      ) : (
        <SaleForm
          buyers={buyers.data ?? []}
          batches={batches.data ?? []}
          currency={tenant?.currency ?? 'LKR'}
          today={todayIso(farm?.timezone)}
          initialBuyerId={preset}
          saving={record.isLoading}
          error={error}
          onCancel={() => void router.push('/sales')}
          onSubmit={({ reason: _reason, ...v }) => {
            setError(null);
            void record
              .mutateAsync({ saleId, ...v })
              .then(sale => router.push(`/sales/${sale.id}`))
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
