/**
 * BackfillRoundForm: enter a past plucking round (#101, §18, §41.13).
 * Every tree is listed with an empty count field, so a WhatsApp message like
 * "C-001 20, C-004 18…" is typed straight in. Counts are only ever linked to
 * the tree the user picks (never guessed); nuts that can't be tied to a tree
 * go in a separate total. Approximate counts and "don't use for predictions"
 * are explicit (AC-BF-004/005).
 */

import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { normalizeTreeCode } from '@/domain/coconut';
import type { BackfillSource, Tree } from '@/lib/api';

export interface BackfillRoundValues {
  roundDate: string;
  source: BackfillSource;
  entries: { treeId: string; quantity: number; approximate: boolean }[];
  unattributedQuantity: number | null;
  approximate: boolean;
  excludeFromPrediction: boolean;
  addToStock: boolean;
  notes: string | null;
}

export interface BackfillRoundFormProps {
  trees: readonly Tree[];
  today: string;
  saving: boolean;
  error?: string | null | undefined;
  onSubmit: (values: BackfillRoundValues) => void;
}

export function BackfillRoundForm({
  trees,
  today,
  saving,
  error,
  onSubmit,
}: BackfillRoundFormProps) {
  const { t } = useTranslation('backfill');
  const [date, setDate] = useState('');
  const [source, setSource] = useState<BackfillSource>('WHATSAPP_BACKFILL');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [approx, setApprox] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [unattributed, setUnattributed] = useState('');
  const [allApprox, setAllApprox] = useState(false);
  const [exclude, setExclude] = useState(false);
  const [addToStock, setAddToStock] = useState(false);
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...trees].sort((a, b) => a.code.localeCompare(b.code)),
    [trees]
  );
  const q = normalizeTreeCode(search);
  const shown = q
    ? sorted.filter(tr =>
        tr.code.replace(/-/g, '').includes(q.replace(/-/g, ''))
      )
    : sorted;
  const entries = sorted
    .filter(tr => (counts[tr.id] ?? '') !== '')
    .map(tr => ({
      treeId: tr.id,
      quantity: Number(counts[tr.id]),
      approximate: Boolean(approx[tr.id]),
    }));
  const extra = unattributed === '' ? 0 : Number(unattributed);
  const total = entries.reduce((s, e) => s + e.quantity, 0) + extra;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || date > today) return setProblem(t('round.future'));
    if (entries.length === 0 && extra === 0)
      return setProblem(t('round.empty'));
    setProblem(null);
    return onSubmit({
      roundDate: date,
      source,
      entries,
      unattributedQuantity: extra || null,
      approximate: allApprox,
      excludeFromPrediction: exclude,
      addToStock,
      notes: notes.trim() || null,
    });
  };

  return (
    <Box component='form' onSubmit={submit} noValidate>
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label={t('round.date')}
                type='date'
                value={date}
                onChange={e => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: today }}
                required
              />
              <Stack spacing={1}>
                <Typography variant='subtitle2' id='bf-source'>
                  {t('source')}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={source}
                  onChange={(_, v: BackfillSource | null) => v && setSource(v)}
                  aria-labelledby='bf-source'
                >
                  <ToggleButton value='WHATSAPP_BACKFILL'>
                    {t('sources.WHATSAPP_BACKFILL')}
                  </ToggleButton>
                  <ToggleButton value='MANUAL_BACKFILL'>
                    {t('sources.MANUAL_BACKFILL')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card component='section' aria-labelledby='bf-trees'>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography id='bf-trees' variant='h3' component='h2'>
                {t('round.trees')}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {t('round.treesHelp')}
              </Typography>
              <TextField
                size='small'
                type='search'
                label={t('round.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <SearchOutlined aria-hidden />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ autoCapitalize: 'characters' }}
              />
              {shown.map(tr => (
                <Box
                  key={tr.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    size='small'
                    label={t('round.count', { code: tr.code })}
                    value={counts[tr.id] ?? ''}
                    onChange={e =>
                      setCounts(c => ({
                        ...c,
                        [tr.id]: e.target.value.replace(/\D/g, '').slice(0, 3),
                      }))
                    }
                    inputMode='numeric'
                    inputProps={{ pattern: '[0-9]*' }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(approx[tr.id])}
                        onChange={e =>
                          setApprox(a => ({ ...a, [tr.id]: e.target.checked }))
                        }
                        disabled={(counts[tr.id] ?? '') === ''}
                        inputProps={{
                          'aria-label': `${t('round.approx')} ${tr.code}`,
                        }}
                      />
                    }
                    label={t('round.approx')}
                  />
                </Box>
              ))}
              <TextField
                label={t('round.unattributed')}
                value={unattributed}
                onChange={e =>
                  setUnattributed(e.target.value.replace(/\D/g, ''))
                }
                helperText={t('round.unattributedHelp')}
                inputMode='numeric'
              />
              <Typography aria-live='polite' sx={{ fontWeight: 600 }}>
                {t('round.total', { count: total })}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={allApprox}
                    onChange={e => setAllApprox(e.target.checked)}
                  />
                }
                label={t('round.allApprox')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={exclude}
                    onChange={e => setExclude(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography>{t('round.exclude')}</Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {t('round.excludeHelp')}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={addToStock}
                    onChange={e => setAddToStock(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography>{t('round.addToStock')}</Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {t('round.addToStockHelp')}
                    </Typography>
                  </Box>
                }
              />
              <TextField
                label={t('round.notes')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                multiline
              />
            </Stack>
          </CardContent>
        </Card>

        {(error || problem) && (
          <Alert severity='error' role='alert'>
            {error ?? problem}
          </Alert>
        )}
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={saving}
          sx={{ alignSelf: 'flex-end' }}
        >
          {saving ? t('round.saving') : t('round.save')}
        </Button>
      </Stack>
    </Box>
  );
}

export default BackfillRoundForm;
