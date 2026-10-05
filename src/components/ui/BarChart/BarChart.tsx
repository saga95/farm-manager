/**
 * BarChart: one series of values over categories (e.g. coconuts per month).
 *
 * Follows the dataviz guidance: a single series uses ONE hue (primary), no
 * legend (the title names it); thin bars with 4 px rounded tops anchored to the
 * baseline and a 2 px gap; recessive grid lines; values in text colours, never
 * the series colour; a hover / focus tooltip on every bar; and a table view so
 * the numbers are never chart-only. Colours come from the MUI theme, so dark
 * mode gets its own validated steps.
 *
 * @accessibility The SVG is labelled and each bar is a focusable element with
 * its value in the accessible name; "Show as table" gives a real <table>.
 */

import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { tokens } from '@/design-system';

export interface BarDatum {
  key: string;
  /** Short axis label, e.g. "Mar" */
  label: string;
  value: number;
  /** Longer label for the tooltip / table, e.g. "March 2026" */
  fullLabel?: string;
}

export interface BarChartProps {
  title: string;
  data: readonly BarDatum[];
  format?: (n: number) => string;
  /** Column header for the value in table view */
  valueLabel: string;
  categoryLabel: string;
  showTableLabel: string;
  showChartLabel: string;
  height?: number;
}

const W = 600;
const PAD_L = 40;
const PAD_B = 22;
const PAD_T = 8;

/** A "nice" upper bound for the axis (1, 2, 5 × 10ⁿ steps). */
function niceMax(n: number): number {
  if (n <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(n));
  const f = n / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * exp;
}

export function BarChart({
  title,
  data,
  format = n => String(n),
  valueLabel,
  categoryLabel,
  showTableLabel,
  showChartLabel,
  height = 200,
}: BarChartProps) {
  const titleId = useId();
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const plotH = height - PAD_B - PAD_T;
  const slot = (W - PAD_L) / Math.max(1, data.length);
  const gap = 2;
  const barW = Math.max(2, Math.min(32, slot - gap * 2));
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  // Label every bar when few, otherwise every other one (no collisions)
  const labelEvery = data.length > 12 ? 2 : 1;
  const shown = active === null ? undefined : data[active];

  return (
    <Box component='figure' sx={{ m: 0 }} aria-labelledby={titleId}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography
          id={titleId}
          component='figcaption'
          variant='subtitle1'
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>
        <Button size='small' onClick={() => setTable(v => !v)}>
          {table ? showChartLabel : showTableLabel}
        </Button>
      </Box>
      {table ? (
        <Table size='small' aria-labelledby={titleId}>
          <TableHead>
            <TableRow>
              <TableCell>{categoryLabel}</TableCell>
              <TableCell align='right'>{valueLabel}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.key}>
                <TableCell>{d.fullLabel ?? d.label}</TableCell>
                <TableCell
                  align='right'
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {format(d.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Box
            component='svg'
            viewBox={`0 0 ${W} ${height}`}
            role='img'
            aria-labelledby={titleId}
            sx={{
              width: '100%',
              height: 'auto',
              display: 'block',
              overflow: 'visible',
              // Theme colours via sx so light / dark both use their own steps
              '& .bc-grid': { stroke: 'currentColor', color: 'divider' },
              '& .bc-axis': { stroke: 'currentColor', color: 'text.secondary' },
              '& .bc-label': { fill: 'currentColor', color: 'text.secondary' },
              '& .bc-bar': { fill: 'currentColor', color: 'primary.main' },
            }}
          >
            {ticks.map(t => (
              <g key={t}>
                <line
                  x1={PAD_L}
                  x2={W}
                  y1={y(t)}
                  y2={y(t)}
                  className='bc-grid'
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 6}
                  y={y(t)}
                  textAnchor='end'
                  dominantBaseline='middle'
                  style={{ fontSize: tokens.typography.fontSize.xs }}
                  className='bc-label'
                >
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = PAD_L + i * slot + (slot - barW) / 2;
              const top = y(d.value);
              const h = Math.max(0, PAD_T + plotH - top);
              const r = Math.min(4, barW / 2, h);
              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  role='graphics-symbol'
                  aria-label={`${d.fullLabel ?? d.label}: ${format(d.value)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  style={{ cursor: 'default', outline: 'none' }}
                >
                  {/* Hit target taller than the bar */}
                  <rect
                    x={PAD_L + i * slot}
                    y={PAD_T}
                    width={slot}
                    height={plotH}
                    fill='transparent'
                  />
                  {h > 0 && (
                    <path
                      d={`M${x},${PAD_T + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD_T + plotH} Z`}
                      className='bc-bar'
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      x={x + barW / 2}
                      y={height - 6}
                      textAnchor='middle'
                      style={{ fontSize: tokens.typography.fontSize.xs }}
                      className='bc-label'
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line
              x1={PAD_L}
              x2={W}
              y1={PAD_T + plotH}
              y2={PAD_T + plotH}
              className='bc-axis'
              strokeWidth={1}
            />
          </Box>
          {active !== null && shown && (
            <Paper
              role='status'
              elevation={3}
              sx={{
                position: 'absolute',
                top: 0,
                left: `${((PAD_L + active * slot + slot / 2) / W) * 100}%`,
                transform: 'translateX(-50%)',
                px: 1,
                py: 0.5,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <Typography
                variant='caption'
                color='text.secondary'
                component='div'
              >
                {shown.fullLabel ?? shown.label}
              </Typography>
              <Typography
                variant='body2'
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {format(shown.value)}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}

export default BarChart;
