/**
 * SaleForm (SCR-021, #86): record or edit a coconut sale.
 *
 * - Lines: size (optional) × nuts × price each; amounts and the calculated
 *   total update live (CALC-011/012).
 * - Take from stock: nuts per batch and state; "Fill from oldest" suggests a
 *   FIFO allocation. Sold and allocated must match and never exceed what is
 *   available (§13.5); the server enforces the same rules.
 * - Actual amount received is optional and separate; a difference is shown
 *   with an optional reason (CALC-013, DQ-009).
 *
 * Mobile first: each line is a small card with large inputs; the save button
 * sits at the end of the form within thumb reach.
 */

import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import { autoAllocate, lineAmount, saleTotals } from '@/domain/sales';
import { SIZE_CLASSES } from '@/domain/samples';
import type {
  Buyer,
  ProduceBatch,
  ProduceState,
  Sale,
  SaleInput,
} from '@/lib/api';

interface LineDraft {
  key: number;
  sizeClass: string;
  quantity: string;
  unitPrice: string;
}

export interface SaleFormValues extends SaleInput {
  saleDate: string;
  reason: string | null;
}

export interface SaleFormProps {
  /** Present when editing */
  sale?: Sale | null | undefined;
  buyers: readonly Buyer[];
  batches: readonly ProduceBatch[];
  currency: string;
  today: string;
  initialBuyerId?: string | null | undefined;
  saving: boolean;
  error?: string | null | undefined;
  onSubmit: (values: SaleFormValues) => void;
  onCancel: () => void;
}

const STATES: readonly ProduceState[] = ['HUSKED', 'DEHUSKED'];
const allocKey = (batchId: string, state: string) => `${batchId}#${state}`;
const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
const dec = (v: string) =>
  v.trim() === '' || !/^\d*\.?\d*$/.test(v) ? NaN : Number(v);

export function SaleForm({
  sale,
  buyers,
  batches,
  currency,
  today,
  initialBuyerId,
  saving,
  error,
  onSubmit,
  onCancel,
}: SaleFormProps) {
  const { t, i18n } = useTranslation('sales');
  const { t: ts } = useTranslation('samples');
  const { t: ti } = useTranslation('inventory');
  const money = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    [i18n.language, currency]
  );
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const stateName = (s: ProduceState) =>
    ti(s === 'HUSKED' ? 'produce.husked' : 'produce.dehusked');

  const [saleDate, setSaleDate] = useState(sale?.saleDate ?? today);
  const [buyerId, setBuyerId] = useState<string>(
    sale?.buyerId ?? initialBuyerId ?? ''
  );
  const [lines, setLines] = useState<LineDraft[]>(() =>
    sale?.lines.length
      ? sale.lines.map((l, i) => ({
          key: i,
          sizeClass: l.sizeClass ?? '',
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
        }))
      : [{ key: 0, sizeClass: '', quantity: '', unitPrice: '' }]
  );
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (sale?.allocations ?? []).map(a => [
        allocKey(a.batchId, a.state),
        String(a.quantity),
      ])
    )
  );
  const [fillState, setFillState] = useState<ProduceState>('HUSKED');
  const [actual, setActual] = useState(
    sale?.actualAmountReceived != null ? String(sale.actualAmountReceived) : ''
  );
  const [differenceReason, setDifferenceReason] = useState(
    sale?.differenceReason ?? ''
  );
  const [notes, setNotes] = useState(sale?.notes ?? '');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // When editing, this sale's own nuts count as available again.
  const own = useMemo(
    () =>
      new Map(
        (sale?.allocations ?? []).map(a => [
          allocKey(a.batchId, a.state),
          a.quantity,
        ])
      ),
    [sale]
  );
  const stock = useMemo(
    () =>
      batches
        .map(b => ({
          batchId: b.id,
          batchDate: b.batchDate,
          available: {
            HUSKED:
              b.availableByState.HUSKED +
              (own.get(allocKey(b.id, 'HUSKED')) ?? 0),
            DEHUSKED:
              b.availableByState.DEHUSKED +
              (own.get(allocKey(b.id, 'DEHUSKED')) ?? 0),
          },
        }))
        .filter(b => b.available.HUSKED + b.available.DEHUSKED > 0)
        .sort((a, b) => a.batchDate.localeCompare(b.batchDate)),
    [batches, own]
  );

  const parsedLines = lines.map(l => ({
    sizeClass: l.sizeClass || null,
    quantity: int(l.quantity),
    unitPrice: dec(l.unitPrice),
  }));
  const validLines = parsedLines.filter(
    l => l.quantity > 0 && l.unitPrice >= 0
  );
  const actualNum = actual.trim() === '' ? null : dec(actual);
  const totals = saleTotals(
    validLines,
    Number.isFinite(actualNum) ? actualNum : null
  );
  const allocated = Object.values(alloc).reduce((s, v) => s + (int(v) || 0), 0);
  const buyer = buyers.find(b => b.id === buyerId);

  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const fill = () => {
    const { allocations, short } = autoAllocate(
      totals.totalQuantity,
      stock,
      fillState
    );
    setAlloc(
      Object.fromEntries(
        allocations.map(a => [allocKey(a.batchId, a.state), String(a.quantity)])
      )
    );
    setProblem(
      short > 0
        ? t('form.short', {
            state: stateName(fillState).toLowerCase(),
            count: short,
          })
        : null
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bad = parsedLines.findIndex(
      l => !(l.quantity > 0) || !(l.unitPrice >= 0)
    );
    if (validLines.length === 0) return setProblem(t('form.errors.noLines'));
    if (bad !== -1) return setProblem(t('form.errors.badLine', { n: bad + 1 }));
    for (const b of stock) {
      for (const s of STATES) {
        const n = int(alloc[allocKey(b.batchId, s)] ?? '') || 0;
        if (n > b.available[s])
          return setProblem(
            t('form.errors.tooMuch', {
              date: fmtDate(b.batchDate),
              available: b.available[s],
              state: stateName(s).toLowerCase(),
            })
          );
      }
    }
    if (allocated !== totals.totalQuantity)
      return setProblem(
        t('form.errors.mismatch', { sold: totals.totalQuantity, allocated })
      );
    setProblem(null);
    const allocations = Object.entries(alloc)
      .map(([k, v]) => {
        const [batchId, state] = k.split('#') as [string, ProduceState];
        return { batchId, state, quantity: int(v) || 0 };
      })
      .filter(a => a.quantity > 0);
    return onSubmit({
      saleDate,
      buyerId: buyerId || null,
      lines: validLines,
      allocations,
      actualAmountReceived: Number.isFinite(actualNum) ? actualNum : null,
      differenceReason: differenceReason.trim() || null,
      notes: notes.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Box component='form' onSubmit={submit} noValidate>
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label={t('form.date')}
                type='date'
                value={saleDate}
                onChange={e => setSaleDate(e.target.value)}
                disabled={Boolean(sale)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: today }}
              />
              <TextField
                select
                label={t('form.buyer')}
                value={buyerId}
                onChange={e => setBuyerId(e.target.value)}
                helperText={
                  buyer?.preferredSizes.length
                    ? t('form.buyerPrefers', {
                        sizes: buyer.preferredSizes
                          .map(s => ts(`sizes.${s}`))
                          .join(', '),
                      })
                    : undefined
                }
              >
                <MenuItem value=''>{t('form.noBuyer')}</MenuItem>
                {buyers.map(b => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>

        <Card component='section' aria-labelledby='sale-lines'>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography id='sale-lines' variant='h3' component='h2'>
                {t('form.lines')}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {t('form.linesHelp')}
              </Typography>
              {lines.map((l, i) => {
                const p = parsedLines[i]!;
                const ok = p.quantity > 0 && p.unitPrice >= 0;
                return (
                  <Box
                    key={l.key}
                    role='group'
                    aria-label={`${t('form.lines')} ${i + 1}`}
                    sx={{
                      display: 'grid',
                      gap: 1,
                      gridTemplateColumns: {
                        xs: '1fr 1fr auto',
                        sm: '2fr 1fr 1fr auto',
                      },
                      alignItems: 'start',
                    }}
                  >
                    <TextField
                      select
                      label={t('form.size')}
                      value={l.sizeClass}
                      onChange={e =>
                        setLine(l.key, { sizeClass: e.target.value })
                      }
                      sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                    >
                      <MenuItem value=''>{t('form.anySize')}</MenuItem>
                      {SIZE_CLASSES.map(s => (
                        <MenuItem key={s} value={s}>
                          {ts(`sizes.${s}`)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={t('form.quantity')}
                      value={l.quantity}
                      onChange={e =>
                        setLine(l.key, {
                          quantity: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      inputMode='numeric'
                      inputProps={{ pattern: '[0-9]*' }}
                    />
                    <TextField
                      label={t('form.price')}
                      value={l.unitPrice}
                      onChange={e =>
                        setLine(l.key, {
                          unitPrice: e.target.value.replace(/[^\d.]/g, ''),
                        })
                      }
                      inputMode='decimal'
                      helperText={
                        ok
                          ? t('form.lineAmount', {
                              amount: money.format(lineAmount(p)),
                            })
                          : ' '
                      }
                    />
                    <IconButton
                      aria-label={t('form.removeLine', { n: i + 1 })}
                      onClick={() =>
                        setLines(ls => ls.filter(x => x.key !== l.key))
                      }
                      disabled={lines.length === 1}
                      sx={{ mt: 1 }}
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Box>
                );
              })}
              <Button
                startIcon={<AddOutlined aria-hidden />}
                onClick={() =>
                  setLines(ls => [
                    ...ls,
                    {
                      key: Math.max(...ls.map(x => x.key)) + 1,
                      sizeClass: '',
                      quantity: '',
                      unitPrice: '',
                    },
                  ])
                }
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('form.addLine')}
              </Button>
              <Divider />
              <Stack
                direction='row'
                justifyContent='space-between'
                aria-live='polite'
              >
                <Typography>
                  {t('form.totalNuts')}: <strong>{totals.totalQuantity}</strong>
                </Typography>
                <Typography>
                  {t('form.calculated')}:{' '}
                  <strong>{money.format(totals.calculatedAmount)}</strong>
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card component='section' aria-labelledby='sale-stock'>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography id='sale-stock' variant='h3' component='h2'>
                {t('form.stock')}
              </Typography>
              {stock.length === 0 ? (
                <Alert severity='warning'>{t('form.noStock')}</Alert>
              ) : (
                <>
                  <Typography variant='body2' color='text.secondary'>
                    {t('form.stockHelp')}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <ToggleButtonGroup
                      exclusive
                      size='small'
                      value={fillState}
                      onChange={(_, v: ProduceState | null) =>
                        v && setFillState(v)
                      }
                      aria-label={t('form.stock')}
                    >
                      {STATES.map(s => (
                        <ToggleButton key={s} value={s}>
                          {stateName(s)}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                    <Button
                      variant='outlined'
                      onClick={fill}
                      disabled={totals.totalQuantity === 0}
                    >
                      {t('form.fill', {
                        state: stateName(fillState).toLowerCase(),
                      })}
                    </Button>
                  </Stack>
                  {stock.map(b => (
                    <Box key={b.batchId}>
                      <Typography variant='subtitle2'>
                        {t('form.batchRow', { date: fmtDate(b.batchDate) })}
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: '1fr 1fr',
                          mt: 0.5,
                        }}
                      >
                        {STATES.filter(
                          s =>
                            b.available[s] > 0 || alloc[allocKey(b.batchId, s)]
                        ).map(s => (
                          <TextField
                            key={s}
                            size='small'
                            label={t('form.takeState', {
                              state: stateName(s),
                              available: b.available[s],
                            })}
                            value={alloc[allocKey(b.batchId, s)] ?? ''}
                            onChange={e =>
                              setAlloc(a => ({
                                ...a,
                                [allocKey(b.batchId, s)]:
                                  e.target.value.replace(/\D/g, ''),
                              }))
                            }
                            inputMode='numeric'
                            inputProps={{ pattern: '[0-9]*' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                  <Typography
                    aria-live='polite'
                    color={
                      allocated === totals.totalQuantity
                        ? 'text.primary'
                        : 'warning.main'
                    }
                  >
                    {t('form.allocated', {
                      done: allocated,
                      total: totals.totalQuantity,
                    })}
                  </Typography>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label={t('form.actual')}
                value={actual}
                onChange={e => setActual(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode='decimal'
                helperText={t('form.actualHelp')}
              />
              {totals.difference !== null && totals.difference !== 0 && (
                <>
                  <Typography aria-live='polite'>
                    {t('form.difference', {
                      amount: `${totals.difference > 0 ? '+' : '−'}${money.format(Math.abs(totals.difference))}`,
                    })}
                  </Typography>
                  <TextField
                    label={t('form.differenceReason')}
                    value={differenceReason}
                    onChange={e => setDifferenceReason(e.target.value)}
                  />
                </>
              )}
              <TextField
                label={t('form.notes')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                multiline
              />
              {sale && (
                <TextField
                  label={t('form.editReason')}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        {(error || problem) && (
          <Alert severity='error' role='alert'>
            {error ?? problem}
          </Alert>
        )}
        <Stack direction='row' spacing={1} justifyContent='flex-end'>
          <Button onClick={onCancel} disabled={saving} color='inherit'>
            {t('form.cancel')}
          </Button>
          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={saving}
          >
            {saving ? t('form.saving') : t('form.save')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default SaleForm;
