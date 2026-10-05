import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { AppPage } from '@/components/AppPage';
import { clearPersistentState } from '@/hooks/usePersistentState';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useBuyers } from '@/features/buyers/hooks';
import { useTrees } from '@/features/coconut/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useProduceBatches } from '@/features/inventory/hooks';
import {
  BackfillRoundForm,
  type BackfillRoundValues,
} from '@/features/plucking/components/BackfillRoundForm';
import { todayIso } from '@/features/plucking/hooks';
import {
  SaleForm,
  type SaleFormValues,
} from '@/features/sales/components/SaleForm';
import { useTenant } from '@/features/tenant';
import {
  ApiError,
  type BackfillSource,
  backfillRound,
  backfillSale,
} from '@/lib/api';

/** Enter old records from WhatsApp or notes (#101, SRS §18, §41.13, US-021). */
export default function BackfillPage() {
  const { t, i18n } = useTranslation('backfill');
  const router = useRouter();
  const qc = useQueryClient();
  const { can, tenant } = useTenant();
  const { tenantId, farm } = useCurrentFarm();
  const trees = useTrees(true);
  const buyers = useBuyers(true);
  const batches = useProduceBatches(false);
  const [tab, setTab] = useState<'round' | 'sale'>('round');
  // New ids per saved record; kept stable across a retried save
  const [roundId, setRoundId] = useState(ulid);
  const [harvestIds] = useState(() => new Map<string, string>());
  const [saleId, setSaleId] = useState(ulid);
  const [formKey, setFormKey] = useState(0);
  const [saleSource, setSaleSource] =
    useState<BackfillSource>('WHATSAPP_BACKFILL');
  const [saved, setSaved] = useState<{ text: string; href: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const today = todayIso(farm?.timezone);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const explain = (e: unknown) =>
    e instanceof ApiError && e.code === 'VALIDATION'
      ? e.message.replace(/^\w+:\s*/, '')
      : t('round.failed');
  const refresh = () =>
    Promise.all(
      ['rounds', 'treeHistory', 'trees', 'dueTrees', 'sales', 'batches'].map(
        k => qc.invalidateQueries({ queryKey: [k, tenantId] })
      )
    );

  const round = useMutation({
    mutationFn: (v: BackfillRoundValues) =>
      backfillRound(tenantId, farm?.id as string, {
        roundId,
        roundDate: v.roundDate,
        source: v.source,
        entries: v.entries.map(e => {
          if (!harvestIds.has(e.treeId)) harvestIds.set(e.treeId, ulid());
          return { ...e, harvestId: harvestIds.get(e.treeId) as string };
        }),
        unattributedQuantity: v.unattributedQuantity,
        approximate: v.approximate,
        excludeFromPrediction: v.excludeFromPrediction,
        addToStock: v.addToStock,
        notes: v.notes,
      }),
    onSuccess: refresh,
  });
  const sale = useMutation({
    mutationFn: (v: SaleFormValues) =>
      backfillSale(tenantId, {
        farmId: farm?.id as string,
        saleId,
        saleDate: v.saleDate,
        source: saleSource,
        buyerId: v.buyerId,
        lines: v.lines,
        actualAmountReceived: v.actualAmountReceived,
        differenceReason: v.differenceReason,
        notes: v.notes,
      }),
    onSuccess: refresh,
  });

  const nextRecord = () => {
    setRoundId(ulid());
    harvestIds.clear();
    setSaleId(ulid());
    setFormKey(k => k + 1);
  };

  return (
    <AppPage title={t('title')} showQuickActions={false}>
      {!can('backfill.record') ? (
        <EmptyState size='page' message={t('round.failed')} />
      ) : (
        <>
          <Typography color='text.secondary' sx={{ mb: 2 }}>
            {t('intro')}
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, v: 'round' | 'sale') => setTab(v)}
            sx={{ mb: 2 }}
            variant='fullWidth'
          >
            <Tab value='round' label={t('tabs.round')} />
            <Tab value='sale' label={t('tabs.sale')} />
          </Tabs>
          {saved && (
            <Alert
              severity='success'
              sx={{ mb: 2 }}
              onClose={() => setSaved(null)}
              action={
                <Button
                  component={NextLink}
                  href={saved.href}
                  color='inherit'
                  size='small'
                >
                  {t('round.view')}
                </Button>
              }
            >
              {saved.text}
            </Alert>
          )}
          {tab === 'round' &&
            (trees.isLoading ? (
              <Skeleton variant='rounded' height={300} aria-hidden />
            ) : (
              <BackfillRoundForm
                key={`r${formKey}`}
                draftKey={farm ? `backfill.round.${farm.id}` : null}
                trees={trees.data ?? []}
                today={today}
                saving={round.isLoading}
                error={error}
                onSubmit={v => {
                  setError(null);
                  void round
                    .mutateAsync(v)
                    .then(r => {
                      if (farm)
                        clearPersistentState(`backfill.round.${farm.id}`);
                      setSaved({
                        text: t('round.saved', { date: fmt(r.roundDate) }),
                        href: `/coconut/rounds/${r.id}`,
                      });
                      nextRecord();
                      window.scrollTo({ top: 0 });
                    })
                    .catch(e => setError(explain(e)));
                }}
              />
            ))}
          {tab === 'sale' && (
            <>
              <Alert severity='info' variant='outlined' sx={{ mb: 2 }}>
                {t('sale.intro')}
              </Alert>
              <Tabs
                value={saleSource}
                onChange={(_, v: BackfillSource) => setSaleSource(v)}
                aria-label={t('source')}
                sx={{ mb: 2 }}
              >
                <Tab
                  value='WHATSAPP_BACKFILL'
                  label={t('sources.WHATSAPP_BACKFILL')}
                />
                <Tab
                  value='MANUAL_BACKFILL'
                  label={t('sources.MANUAL_BACKFILL')}
                />
              </Tabs>
              <SaleForm
                key={`s${formKey}`}
                backfill
                buyers={buyers.data ?? []}
                batches={batches.data ?? []}
                currency={tenant?.currency ?? 'LKR'}
                today={today}
                saving={sale.isLoading}
                error={error}
                onCancel={() => void router.push('/sales/history')}
                onSubmit={v => {
                  setError(null);
                  void sale
                    .mutateAsync(v)
                    .then(s => {
                      setSaved({
                        text: t('sale.saved', { date: fmt(s.saleDate) }),
                        href: `/sales/${s.id}`,
                      });
                      nextRecord();
                      window.scrollTo({ top: 0 });
                    })
                    .catch(e => setError(explain(e)));
                }}
              />
            </>
          )}
        </>
      )}
    </AppPage>
  );
}
