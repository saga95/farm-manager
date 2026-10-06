/**
 * Analytics panels (SCR-014 coconut, SCR-027 sales / stock / crops; #99, #100).
 * Presentational: they render an AnalyticsReport. Wording follows §17.6:
 * recorded facts and derived statistics only; missing records are never read
 * as low yield. Numbers are always available as text or tables, never only in
 * a chart.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import { BarChart } from '@/components/ui/BarChart/BarChart';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import type { AnalyticsReport } from '@/lib/api';

const grid = (cols: { xs: number; sm: number }) => ({
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: `repeat(${cols.xs}, 1fr)`,
    sm: `repeat(${cols.sm}, 1fr)`,
  },
});

/**
 * Wide tables scroll inside their card, never the page. The region is
 * focusable so keyboard users can scroll it too (WCAG 2.1.1, #109).
 */
function Scroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      role='region'
      aria-label={label}
      tabIndex={0}
      sx={{
        overflowX: 'auto',
        mx: -2,
        px: 2,
        '&:focus-visible': {
          outline: 2,
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      {children}
    </Box>
  );
}

function useFormat() {
  const { i18n } = useTranslation();
  const month = (m: string, style: 'short' | 'long') =>
    new Intl.DateTimeFormat(i18n.language, {
      month: style,
      ...(style === 'long' ? { year: 'numeric' } : {}),
    }).format(new Date(`${m}-01T00:00:00`));
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const num = (n: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
      n
    );
  const money = (n: number, currency: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  return { month, date, num, money };
}

// ─── Coconut (SCR-014) ────────────────────────────────────────────────────────

export function CoconutReport({ report }: { report: AnalyticsReport }) {
  const { t } = useTranslation('analytics');
  const { t: ts } = useTranslation('samples');
  const f = useFormat();
  const c = report.coconut;
  const sizes = ['LARGE', 'MEDIUM', 'SMALL', 'UNCLASSIFIED'] as const;
  const none = t('coconut.none');
  return (
    <Stack spacing={2}>
      <Box sx={grid({ xs: 2, sm: 4 })}>
        <StatTile label={t('coconut.nuts')} value={f.num(c.totals.nuts)} />
        <StatTile
          label={t('coconut.records')}
          value={c.totals.harvestRecords}
        />
        <StatTile label={t('coconut.avg')} value={c.totals.avgPerHarvest} />
        <StatTile
          label={t('coconut.producing')}
          value={`${c.totals.producingTrees} / ${c.totals.trees}`}
        />
      </Box>

      <SummaryCard
        title={t('coconut.facts')}
        icon={<InsightsOutlined fontSize='small' />}
        tone='secondary'
      >
        {c.insights.length === 0 ? (
          <Typography color='text.secondary'>{t('coconut.noFacts')}</Typography>
        ) : (
          <List disablePadding dense>
            {c.insights.map((ins, i) => (
              <ListItem key={i} disableGutters>
                <ListItemText
                  primary={
                    ins.kind === 'NO_RECENT_RECORD' && ins.days === null
                      ? t('coconut.insight.NO_RECENT_RECORD_NEVER', {
                          code: ins.code,
                        })
                      : t(`coconut.insight.${ins.kind}`, ins)
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </SummaryCard>

      <BarChart
        title={t('coconut.byMonth')}
        data={c.byMonth.map(m => ({
          key: m.month,
          label: f.month(m.month, 'short'),
          fullLabel: f.month(m.month, 'long'),
          value: m.value,
        }))}
        format={f.num}
        valueLabel={t('coconut.coconuts')}
        categoryLabel={t('chart.month')}
        showTableLabel={t('chart.table')}
        showChartLabel={t('chart.chart')}
      />

      <SummaryCard title={t('coconut.rounds')}>
        <Box sx={grid({ xs: 2, sm: 4 })}>
          <StatTile label={t('coconut.roundCount')} value={c.rounds.rounds} />
          <StatTile
            label={t('coconut.treesPerRound')}
            value={c.rounds.avgTreesPerRound}
          />
          <StatTile
            label={t('coconut.nutsPerRound')}
            value={c.rounds.avgNutsPerRound}
          />
          <StatTile
            label={t('coconut.nutsPerTree')}
            value={c.rounds.avgNutsPerTree}
          />
        </Box>
      </SummaryCard>

      <SummaryCard title={t('coconut.samples')}>
        <Stack spacing={1}>
          {sizes
            .filter(s => c.samples.counts[s] > 0)
            .map(s => (
              <Stack key={s} direction='row' justifyContent='space-between'>
                <Typography>{ts(`sizes.${s}`)}</Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {c.samples.counts[s]} (
                  {Math.round((c.samples.counts[s] / c.samples.samples) * 100)}
                  %)
                </Typography>
              </Stack>
            ))}
          <Typography variant='caption' color='text.secondary'>
            {t('coconut.samplesNote', { count: c.samples.samples })}
          </Typography>
        </Stack>
      </SummaryCard>

      <SummaryCard title={t('coconut.trees')}>
        <Typography variant='caption' color='text.secondary'>
          {t('coconut.treesNote')}
        </Typography>
        <Scroll label={t('coconut.trees')}>
          <Table size='small' aria-label={t('coconut.trees')}>
            <TableHead>
              <TableRow>
                {(
                  [
                    'tree',
                    'period',
                    'average',
                    'best',
                    'last',
                    'median',
                    'next',
                    'sample',
                  ] as const
                ).map(k => (
                  <TableCell
                    key={k}
                    align={k === 'tree' || k === 'sample' ? 'left' : 'right'}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {t(`coconut.col.${k}`)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {c.trees.map(tr => (
                <TableRow key={tr.treeId}>
                  <TableCell sx={{ fontWeight: 600 }}>{tr.code}</TableCell>
                  <TableCell align='right'>
                    {tr.periodHarvests ? tr.periodNuts : none}
                  </TableCell>
                  <TableCell align='right'>{tr.average ?? none}</TableCell>
                  <TableCell align='right'>{tr.best ?? none}</TableCell>
                  <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                    {tr.lastPlucked ? f.date(tr.lastPlucked) : none}
                  </TableCell>
                  <TableCell align='right'>
                    {tr.medianInterval != null
                      ? t('coconut.days', { count: tr.medianInterval })
                      : none}
                  </TableCell>
                  <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                    {tr.nextEstimate ? f.date(tr.nextEstimate) : none}
                  </TableCell>
                  <TableCell>
                    {tr.latestSampleSize
                      ? ts(`sizes.${tr.latestSampleSize}`)
                      : none}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Scroll>
      </SummaryCard>
    </Stack>
  );
}

// ─── Sales & stock (SCR-027) ──────────────────────────────────────────────────

export function SalesStockReport({
  report,
  currency,
}: {
  report: AnalyticsReport;
  currency: string;
}) {
  const { t } = useTranslation('analytics');
  const { t: ts } = useTranslation('samples');
  const { t: ti } = useTranslation('inventory');
  const f = useFormat();
  const s = report.sales;
  const m = (n: number) => f.money(n, currency);
  const unit = (u: string) => ti(`units.${u}`, { defaultValue: u });
  const crop = (code: string, name?: string) =>
    code === 'COCONUT' ? ti('produce.coconuts') : (name ?? code);
  const stateName = (st: string) =>
    ti(
      st === 'HUSKED'
        ? 'produce.husked'
        : st === 'DEHUSKED'
          ? 'produce.dehusked'
          : 'produce.fresh'
    );
  return (
    <Stack spacing={2}>
      <Box sx={grid({ xs: 2, sm: 4 })}>
        <StatTile label={t('sales.count')} value={s.sales} />
        <StatTile label={t('sales.calculated')} value={m(s.calculated)} />
        <StatTile label={t('sales.actual')} value={m(s.actual)} />
        <StatTile
          label={t('sales.difference')}
          value={`${s.difference > 0 ? '+' : s.difference < 0 ? '−' : ''}${m(Math.abs(s.difference))}`}
          caption={t('sales.differenceNote', { count: s.salesWithActual })}
        />
      </Box>

      <SummaryCard title={t('sales.realized')}>
        {s.realizedPerCoconut ? (
          <Stack spacing={0.5}>
            <Typography variant='h3' component='p'>
              {m(s.realizedPerCoconut.value)}
            </Typography>
            {/* CALC-014: the scope is always stated */}
            <Typography variant='body2' color='text.secondary'>
              {t('sales.realizedScope', {
                sales: s.realizedPerCoconut.sales,
                nuts: s.realizedPerCoconut.nuts,
                from: f.date(report.period.from),
                to: f.date(report.period.to),
              })}
            </Typography>
          </Stack>
        ) : (
          <Typography color='text.secondary'>
            {t('sales.realizedNone')}
          </Typography>
        )}
      </SummaryCard>

      <BarChart
        title={t('sales.byMonth')}
        data={s.byMonth.map(x => ({
          key: x.month,
          label: f.month(x.month, 'short'),
          fullLabel: f.month(x.month, 'long'),
          value: x.calculated,
        }))}
        format={m}
        valueLabel={t('sales.value')}
        categoryLabel={t('chart.month')}
        showTableLabel={t('chart.table')}
        showChartLabel={t('chart.chart')}
      />

      <SummaryCard title={t('sales.byBuyer')}>
        <Scroll label={t('sales.byBuyer')}>
          <Table size='small' aria-label={t('sales.byBuyer')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('sales.col.buyer')}</TableCell>
                <TableCell align='right'>{t('sales.col.sales')}</TableCell>
                <TableCell align='right'>{t('sales.col.value')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s.byBuyer.map(b => (
                <TableRow key={b.buyer || 'none'}>
                  <TableCell>{b.buyer || t('sales.walkIn')}</TableCell>
                  <TableCell align='right'>{b.sales}</TableCell>
                  <TableCell align='right'>{m(b.calculated)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Scroll>
      </SummaryCard>

      {s.bySize.length > 0 && (
        <SummaryCard title={t('sales.bySize')}>
          <Table size='small' aria-label={t('sales.bySize')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('sales.col.size')}</TableCell>
                <TableCell align='right'>{t('sales.col.quantity')}</TableCell>
                <TableCell align='right'>{t('sales.col.value')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s.bySize.map(z => (
                <TableRow key={z.sizeClass}>
                  <TableCell>
                    {z.sizeClass === 'ANY'
                      ? t('sales.anySize')
                      : ts(`sizes.${z.sizeClass}`)}
                  </TableCell>
                  <TableCell align='right'>{f.num(z.quantity)}</TableCell>
                  <TableCell align='right'>{m(z.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SummaryCard>
      )}

      {s.byCrop.length > 1 && (
        <SummaryCard title={t('sales.byCrop')}>
          <Table size='small' aria-label={t('sales.byCrop')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('sales.col.crop')}</TableCell>
                <TableCell align='right'>{t('sales.col.quantity')}</TableCell>
                <TableCell align='right'>{t('sales.col.value')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s.byCrop.map(c => (
                <TableRow key={`${c.cropCode}${c.unit}`}>
                  <TableCell>{crop(c.cropCode)}</TableCell>
                  <TableCell align='right'>{`${f.num(c.quantity)} ${unit(c.unit)}`}</TableCell>
                  <TableCell align='right'>{m(c.calculated)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SummaryCard>
      )}

      <SummaryCard title={t('stock.title')}>
        <Stack spacing={1}>
          {report.stock.current.map(c => (
            <Stack
              key={`${c.cropCode}${c.unit}`}
              direction='row'
              justifyContent='space-between'
              useFlexGap
              flexWrap='wrap'
            >
              <Typography sx={{ fontWeight: 600 }}>
                {crop(c.cropCode, c.cropName)}
              </Typography>
              <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {Object.entries(c.byState)
                  .map(([st, v]) => `${stateName(st)} ${f.num(v ?? 0)}`)
                  .join(' · ')}{' '}
                {unit(c.unit)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </SummaryCard>

      <SummaryCard title={t('stock.adjustments')}>
        {report.stock.adjustments.length === 0 ? (
          <Typography color='text.secondary'>
            {t('stock.noAdjustments')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {report.stock.adjustments.map(a => (
              <ListItem
                key={`${a.transactionType}${a.cropCode}${a.unit}`}
                disableGutters
              >
                <ListItemText
                  primary={`${ti(`txn.${a.transactionType}`)} · ${crop(a.cropCode)}`}
                  secondary={`${f.num(a.quantity)} ${unit(a.unit)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </SummaryCard>

      <SummaryCard title={t('stock.lowStock')}>
        {report.stock.lowStock.length === 0 ? (
          <Typography color='text.secondary'>
            {t('stock.noLowStock')}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {report.stock.lowStock.map(i => (
              <Alert key={i.id} severity='warning' variant='outlined'>
                {t('stock.lowLine', {
                  name: i.name,
                  quantity: f.num(i.quantity),
                  unit: ti(`inputs.units.${i.unit}`, { defaultValue: i.unit }),
                  level: i.reorderLevel ?? '',
                })}
              </Alert>
            ))}
          </Stack>
        )}
      </SummaryCard>
    </Stack>
  );
}

// ─── Other crops (§17.5) ──────────────────────────────────────────────────────

export function CropsReport({ report }: { report: AnalyticsReport }) {
  const { t } = useTranslation('analytics');
  const { t: ti } = useTranslation('inventory');
  const f = useFormat();
  if (report.crops.length === 0)
    return <Typography color='text.secondary'>{t('crops.none')}</Typography>;
  return (
    <Stack spacing={3}>
      {report.crops.map(c => {
        const unit = ti(`units.${c.unit}`, { defaultValue: c.unit });
        return (
          <Stack key={`${c.cropCode}${c.unit}`} spacing={1}>
            <BarChart
              title={t('crops.harvested', { crop: c.cropName, unit })}
              data={Object.entries(c.byMonth).map(([month, value]) => ({
                key: month,
                label: f.month(month, 'short'),
                fullLabel: f.month(month, 'long'),
                value,
              }))}
              format={f.num}
              valueLabel={unit}
              categoryLabel={t('chart.month')}
              showTableLabel={t('chart.table')}
              showChartLabel={t('chart.chart')}
            />
            <Typography color='text.secondary'>
              {t('crops.total', { total: f.num(c.total), unit })}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
