import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { BuyerDialog } from '@/features/buyers/components/BuyerDialog';
import { useBuyer, useBuyerActions } from '@/features/buyers/hooks';
import { useTenant } from '@/features/tenant';

/** SCR-020 Buyer: size preferences, needs, contact; jump to matching trees (#84). */
export default function BuyerPage() {
  const { t } = useTranslation('sales');
  const { t: ts } = useTranslation('samples');
  const router = useRouter();
  const buyerId =
    typeof router.query['buyerId'] === 'string'
      ? router.query['buyerId']
      : undefined;
  const buyer = useBuyer(buyerId);
  const { update } = useBuyerActions();
  const { can } = useTenant();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = buyer.data;
  const canManage = can('buyer.manage');
  const sizes = (list: readonly string[]) =>
    list.length ? (
      list.map(s => <Chip key={s} label={ts(`sizes.${s}`)} />)
    ) : (
      <Typography>{t('buyer.none')}</Typography>
    );
  // Trees to look at for this buyer: preferred sizes first, then acceptable ones
  const matchSizes = b ? [...b.preferredSizes, ...b.acceptableSizes] : [];

  return (
    <AppPage title={b?.name ?? t('buyers.title')} showQuickActions={false}>
      <Button
        component={NextLink}
        href='/sales/buyers'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('buyers.back')}
      </Button>
      {buyer.isLoading && (
        <Skeleton variant='rounded' height={240} aria-hidden />
      )}
      {buyer.isError && (
        <EmptyState size='page' message={t('buyer.notFound')} />
      )}
      {b && (
        <Stack spacing={2}>
          {b.status === 'ARCHIVED' && (
            <Alert severity='info'>{t('buyers.archived')}</Alert>
          )}
          <SummaryCard
            title={t('buyer.preferred')}
            icon={<StorefrontOutlined fontSize='small' />}
          >
            <Stack spacing={1.5}>
              <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                {sizes(b.preferredSizes)}
              </Stack>
              <Typography variant='subtitle2'>
                {t('buyer.acceptable')}
              </Typography>
              <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                {sizes(b.acceptableSizes)}
              </Stack>
              {b.requirementNote && (
                <>
                  <Typography variant='subtitle2'>
                    {t('buyer.requirement')}
                  </Typography>
                  <Typography>{b.requirementNote}</Typography>
                </>
              )}
            </Stack>
          </SummaryCard>

          {matchSizes.length > 0 && (
            <SummaryCard
              title={t('buyer.treesTitle')}
              icon={<ParkOutlined fontSize='small' />}
              tone='secondary'
            >
              <Stack spacing={1.5}>
                <Typography variant='body2' color='text.secondary'>
                  {t('buyer.matchingHelp')}
                </Typography>
                <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                  {matchSizes.map(s => (
                    <Button
                      key={s}
                      component={NextLink}
                      href={`/coconut/trees?size=${s}`}
                      variant='outlined'
                    >
                      {t('buyer.matchingTrees', { size: ts(`sizes.${s}`) })}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </SummaryCard>
          )}

          {(b.contactName || b.phone || b.notes) && (
            <SummaryCard title={t('buyer.contact')}>
              <Stack spacing={0.5}>
                {b.contactName && <Typography>{b.contactName}</Typography>}
                {b.phone && (
                  <Typography
                    component='a'
                    href={`tel:${b.phone}`}
                    sx={{ color: 'primary.main' }}
                  >
                    {b.phone}
                  </Typography>
                )}
                {b.notes && (
                  <Typography color='text.secondary' sx={{ pt: 1 }}>
                    {b.notes}
                  </Typography>
                )}
              </Stack>
            </SummaryCard>
          )}

          {can('sale.record') && b.status !== 'ARCHIVED' && (
            <Button
              component={NextLink}
              href={`/sales/new?buyer=${b.id}`}
              variant='contained'
              size='large'
            >
              {t('buyer.recordSale')}
            </Button>
          )}

          {canManage && (
            <Stack direction='row' spacing={1}>
              {b.status !== 'ARCHIVED' && (
                <Button
                  variant='outlined'
                  onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  {t('buyer.edit')}
                </Button>
              )}
              <Button
                color={b.status === 'ARCHIVED' ? 'primary' : 'error'}
                disabled={update.isLoading}
                onClick={() =>
                  void update.mutateAsync({
                    buyer: b,
                    changes: {
                      status: b.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
                    },
                  })
                }
              >
                {b.status === 'ARCHIVED'
                  ? t('buyer.restore')
                  : t('buyer.archive')}
              </Button>
            </Stack>
          )}
        </Stack>
      )}
      {b && (
        <BuyerDialog
          open={editing}
          buyer={b}
          saving={update.isLoading}
          error={error}
          onClose={() => setEditing(false)}
          onSave={fields =>
            void update
              .mutateAsync({ buyer: b, changes: fields })
              .then(() => setEditing(false))
              .catch(() => setError(t('buyerDialog.failed')))
          }
        />
      )}
    </AppPage>
  );
}
