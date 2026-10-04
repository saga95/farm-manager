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
import { roundQty } from '@/domain/inventory';
import { EntityList } from '@/features/farm/components/EntityList';
import { useProduceBatches } from '@/features/inventory/hooks';
import type { ProduceBatch } from '@/lib/api';

/**
 * SCR-015 Produce stock (#79, #95): coconuts by husked / dehusked, and other
 * produce (polytunnel harvests) by crop and unit, then stock per batch.
 */
export default function ProduceStockPage() {
  const { t, i18n } = useTranslation('inventory');
  const router = useRouter();
  const [showEmpty, setShowEmpty] = useState(false);
  const batches = useProduceBatches(!showEmpty);
  const list = useMemo(() => batches.data ?? [], [batches.data]);
  const coconut = list.filter(b => b.cropCode === 'COCONUT');
  const totals = coconut.reduce(
    (acc, b) => ({
      HUSKED: acc.HUSKED + (b.availableByState.HUSKED ?? 0),
      DEHUSKED: acc.DEHUSKED + (b.availableByState.DEHUSKED ?? 0),
    }),
    { HUSKED: 0, DEHUSKED: 0 }
  );
  // Other produce: one tile per crop + unit
  const others = useMemo(() => {
    const map = new Map<
      string,
      { crop: string; unit: string; quantity: number }
    >();
    for (const b of list.filter(x => x.cropCode !== 'COCONUT')) {
      const k = `${b.cropCode}#${b.unit}`;
      const prev = map.get(k);
      map.set(k, {
        crop: b.cropName ?? b.cropCode,
        unit: b.unit,
        quantity: roundQty((prev?.quantity ?? 0) + b.available),
      });
    }
    return [...map.values()].sort((a, b) => a.crop.localeCompare(b.crop));
  }, [list]);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const unit = (u: string) => t(`units.${u}`, { defaultValue: u });
  const label = (b: ProduceBatch) =>
    b.cropCode === 'COCONUT'
      ? t('produce.batchLabel', { date: fmt(b.batchDate) })
      : t('produce.cropBatchLabel', {
          crop: b.cropName ?? b.cropCode,
          date: fmt(b.batchDate),
        });
  const summary = (b: ProduceBatch) =>
    b.cropCode === 'COCONUT'
      ? t('produce.batchSummary', {
          husked: b.availableByState.HUSKED ?? 0,
          dehusked: b.availableByState.DEHUSKED ?? 0,
        })
      : t('produce.qtySummary', { quantity: b.available, unit: unit(b.unit) });

  return (
    <AppPage title={t('produce.title')}>
      <Stack spacing={2}>
        {(coconut.length > 0 || others.length === 0) && (
          <Stack
            spacing={1}
            component='section'
            aria-labelledby='stock-coconut'
          >
            <Typography id='stock-coconut' variant='h3' component='h2'>
              {t('produce.coconuts')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
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
          </Stack>
        )}
        {others.length > 0 && (
          <Stack spacing={1} component='section' aria-labelledby='stock-other'>
            <Typography id='stock-other' variant='h3' component='h2'>
              {t('produce.otherProduce')}
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
              {others.map(o => (
                <StatTile
                  key={`${o.crop}${o.unit}`}
                  label={o.crop}
                  value={o.quantity}
                  unit={unit(o.unit)}
                />
              ))}
            </Box>
          </Stack>
        )}
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
              primary: label(b),
              secondary: summary(b),
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
