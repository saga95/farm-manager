import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import {
  CoconutReport,
  CropsReport,
  SalesStockReport,
} from '@/features/analytics/components/Reports';
import {
  type PeriodKey,
  periodFor,
  useAnalytics,
} from '@/features/analytics/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { todayIso } from '@/features/plucking/hooks';
import { useTenant } from '@/features/tenant';

const PERIODS: readonly PeriodKey[] = ['3m', '12m', 'year', 'all'];

/** SCR-014 Coconut analytics + SCR-027 sales, stock and crop analytics (#99, #100). */
export default function AnalyticsPage() {
  const { t, i18n } = useTranslation('analytics');
  const { can, tenant } = useTenant();
  const { farm } = useCurrentFarm();
  const [periodKey, setPeriodKey] = useState<PeriodKey>('12m');
  const [tab, setTab] = useState<'coconut' | 'sales' | 'crops'>('coconut');
  const [allTrees, setAllTrees] = useState(false);
  const today = todayIso(farm?.timezone);
  const period = useMemo(() => periodFor(periodKey, today), [periodKey, today]);
  const report = useAnalytics(period, allTrees);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );

  if (!can('analytics.view'))
    return (
      <AppPage title={t('title')}>
        <EmptyState size='page' message={t('noAccess')} />
      </AppPage>
    );

  return (
    <AppPage title={t('title')}>
      <Stack spacing={2}>
        <Stack
          direction='row'
          spacing={1}
          useFlexGap
          flexWrap='wrap'
          role='group'
          aria-label={t('period.label')}
        >
          {PERIODS.map(p => (
            <Chip
              key={p}
              label={t(`period.${p}`)}
              color={periodKey === p ? 'primary' : 'default'}
              variant={periodKey === p ? 'filled' : 'outlined'}
              onClick={() => setPeriodKey(p)}
              aria-pressed={periodKey === p}
            />
          ))}
        </Stack>
        {report.data && periodKey !== 'all' && (
          <Typography variant='body2' color='text.secondary'>
            {t('scope', {
              from: fmt(report.data.period.from),
              to: fmt(report.data.period.to),
            })}
          </Typography>
        )}
        <Tabs
          value={tab}
          onChange={(_, v: typeof tab) => setTab(v)}
          variant='fullWidth'
        >
          <Tab value='coconut' label={t('tabs.coconut')} />
          <Tab value='sales' label={t('tabs.sales')} />
          <Tab value='crops' label={t('tabs.crops')} />
        </Tabs>
        {tab === 'coconut' && (
          <FormControlLabel
            control={
              <Switch
                checked={allTrees}
                onChange={e => setAllTrees(e.target.checked)}
              />
            }
            label={t('includeNonProducing')}
          />
        )}
        {report.isLoading && (
          <Skeleton variant='rounded' height={360} aria-hidden />
        )}
        {report.isError && <EmptyState size='page' message={t('failed')} />}
        {report.data && tab === 'coconut' && (
          <CoconutReport report={report.data} />
        )}
        {report.data && tab === 'sales' && (
          <SalesStockReport
            report={report.data}
            currency={tenant?.currency ?? 'LKR'}
          />
        )}
        {report.data && tab === 'crops' && <CropsReport report={report.data} />}
      </Stack>
    </AppPage>
  );
}
