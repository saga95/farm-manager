import { type FormEvent, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppPage } from '@/components/AppPage';
import { tokens } from '@/design-system';
import {
  MAX_BULK_TREES,
  SYSTEM_CROPS,
  TREE_STATUSES,
  generateTreeCodes,
} from '@/domain/coconut';
import { useBulkCreateTrees } from '@/features/coconut/hooks';
import { useZones } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import type { BulkCreateTreesResult } from '@/lib/api';

/** SCR-006 Bulk tree registration (FR-CN-001, AC-CN-001/002, US-003/004). */
export default function BulkTreesPage() {
  const { t } = useTranslation('coconut');
  const { can } = useTenant();
  const zones = useZones();
  const bulk = useBulkCreateTrees();
  const [prefix, setPrefix] = useState(SYSTEM_CROPS.COCONUT.codePrefix ?? 'C');
  const [start, setStart] = useState('1');
  const [count, setCount] = useState('50');
  const [width, setWidth] = useState('3');
  const [status, setStatus] = useState('PRODUCING');
  const [zoneId, setZoneId] = useState('');
  const [result, setResult] = useState<BulkCreateTreesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      const codes = generateTreeCodes({
        prefix,
        start: Number(start),
        count: Number(count),
        width: Number(width),
      });
      return { codes, error: null };
    } catch {
      return { codes: [], error: t('bulk.invalid') };
    }
  }, [prefix, start, count, width, t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (preview.error || preview.codes.length === 0) return;
    setError(null);
    try {
      setResult(
        await bulk.mutateAsync({
          prefix,
          start: Number(start),
          count: Number(count),
          width: Number(width),
          status,
          zoneId: zoneId || null,
        })
      );
    } catch {
      setError(t('errors.failed'));
    }
  };

  if (!can('tree.manage')) {
    return (
      <AppPage title={t('bulk.title')}>
        <Alert severity='info'>{t('bulk.noPermission')}</Alert>
      </AppPage>
    );
  }

  if (result) {
    return (
      <AppPage title={t('bulk.doneTitle')}>
        <Stack spacing={2}>
          <Alert severity='success'>
            {t('bulk.created', { count: result.created.length })}
          </Alert>
          {result.skipped.length > 0 && (
            <Alert severity='info'>
              {t('bulk.skipped', { codes: result.skipped.join(', ') })}
            </Alert>
          )}
          <Stack direction='row' spacing={1}>
            <Button
              component={NextLink}
              href='/coconut/trees'
              variant='contained'
            >
              {t('bulk.viewTrees')}
            </Button>
            <Button onClick={() => setResult(null)}>{t('bulk.again')}</Button>
          </Stack>
        </Stack>
      </AppPage>
    );
  }

  const n = preview.codes.length;

  return (
    <AppPage title={t('bulk.title')}>
      <Typography color='text.secondary' sx={{ mb: 3 }}>
        {t('bulk.intro')}
      </Typography>
      <Stack
        component='form'
        spacing={2.5}
        onSubmit={submit}
        noValidate
        sx={{ maxWidth: 'sm' }}
      >
        {error && (
          <Alert severity='error' role='alert'>
            {error}
          </Alert>
        )}
        <Stack direction='row' spacing={2}>
          <TextField
            label={t('bulk.prefix')}
            value={prefix}
            onChange={e => setPrefix(e.target.value.toUpperCase())}
            helperText={t('bulk.prefixHelp')}
            inputProps={{ maxLength: 5, autoCapitalize: 'characters' }}
          />
          <TextField
            label={t('bulk.width')}
            select
            value={width}
            onChange={e => setWidth(e.target.value)}
            sx={{ maxWidth: tokens.spacing[32] }}
          >
            {['2', '3', '4'].map(w => (
              <MenuItem key={w} value={w}>
                {w}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction='row' spacing={2}>
          <TextField
            label={t('bulk.start')}
            value={start}
            onChange={e => setStart(e.target.value)}
            inputMode='numeric'
          />
          <TextField
            label={t('bulk.count')}
            value={count}
            onChange={e => setCount(e.target.value)}
            inputMode='numeric'
            helperText={`1–${MAX_BULK_TREES}`}
          />
        </Stack>
        <TextField
          select
          label={t('bulk.status')}
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {TREE_STATUSES.filter(
            s => !['REMOVED', 'DEAD', 'ARCHIVED'].includes(s)
          ).map(s => (
            <MenuItem key={s} value={s}>
              {t(`status.${s}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('bulk.zone')}
          value={zoneId}
          onChange={e => setZoneId(e.target.value)}
        >
          <MenuItem value=''>{t('bulk.noZone')}</MenuItem>
          {(zones.data ?? []).map(z => (
            <MenuItem key={z.id} value={z.id}>
              {z.name}
            </MenuItem>
          ))}
        </TextField>

        <Card variant='outlined' aria-live='polite'>
          <CardContent>
            <Typography
              variant='overline'
              component='h2'
              color='text.secondary'
            >
              {t('bulk.preview')}
            </Typography>
            {preview.error ? (
              <Typography color='error'>{preview.error}</Typography>
            ) : (
              <Typography variant='h3' component='p'>
                {t('bulk.previewRange', {
                  first: preview.codes[0],
                  last: preview.codes[n - 1],
                })}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={bulk.isLoading || Boolean(preview.error)}
        >
          {bulk.isLoading
            ? t('bulk.submitting')
            : t('bulk.submit', { count: n })}
        </Button>
      </Stack>
    </AppPage>
  );
}
