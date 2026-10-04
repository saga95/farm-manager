import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { EntityList } from '@/features/farm/components/EntityList';
import { useProduceBatches } from '@/features/inventory/hooks';

/** SCR-015 Coconut stock: totals by state and stock per round (#79). */
export default function ProduceStockPage() {
  const { t, i18n } = useTranslation('inventory');
  const router = useRouter();
  const [showEmpty, setShowEmpty] = useState(false);
  const batches = useProduceBatches(!showEmpty);
  const list = useMemo(() => batches.data ?? [], [batches.data]);
  const totals = useMemo(
    () =>
      list.reduce(
        (acc, b) => ({
          HUSKED: acc.HUSKED + b.availableByState.HUSKED,
          DEHUSKED: acc.DEHUSKED + b.availableByState.DEHUSKED,
        }),
        { HUSKED: 0, DEHUSKED: 0 }
      ),
    [list]
  );
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );

  return (
    <AppPage title={t('produce.title')}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          <StatTile
            label={t('produce.total')}
            value={totals.HUSKED + totals.DEHUSKED}
            unit={t('produce.nuts')}
          />
          <StatTile label={t('produce.husked')} value={totals.HUSKED} />
          <StatTile label={t('produce.dehusked')} value={totals.DEHUSKED} />
        </Box>
        <Alert severity='info' variant='outlined'>
          {t('produce.sizeNote')}
        </Alert>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          useFlexGap
          flexWrap='wrap'
        >
          <Typography variant='h3' component='h2'>
            {t('produce.batches')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showEmpty}
                onChange={e => setShowEmpty(e.target.checked)}
              />
            }
            label={t('produce.showEmpty')}
          />
        </Stack>
        {batches.isLoading ? (
          <Skeleton variant='rounded' height={200} aria-hidden />
        ) : (
          <EntityList
            label={t('produce.batches')}
            rows={list.map(b => ({
              id: b.id,
              primary: t('produce.batchLabel', { date: fmt(b.batchDate) }),
              secondary: t('produce.batchSummary', {
                husked: b.availableByState.HUSKED,
                dehusked: b.availableByState.DEHUSKED,
              }),
              badge: t(`produce.status.${b.status}`, {
                defaultValue: b.status,
              }),
            }))}
            onSelect={id => void router.push(`/inventory/produce/${id}`)}
            empty={
              <EmptyState
                size='page'
                icon={<Inventory2Outlined fontSize='large' />}
                message={t('produce.empty')}
              />
            }
          />
        )}
      </Stack>
    </AppPage>
  );
}
