import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AuthCard } from '@/components/ui/AuthCard/AuthCard';
import { useAuth } from '@/contexts/AuthContext';
import { GateLoading, useTenant } from '@/features/tenant';
import {
  AREA_UNITS,
  CURRENCIES,
  LOCALES,
  SETUP_DEFAULTS,
  setupSchema,
  timeZones,
} from '@/features/tenant/setupSchema';
import { ApiError, createTenant } from '@/lib/api';

type Values = {
  name: string;
  farmName: string;
  farmArea: string;
  farmAreaUnit: string;
  farmLocationLabel: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLocale: string;
};

/** SCR-002 Tenant / farm initial setup (US-001, US-002). */
export default function SetupPage() {
  const { t } = useTranslation(['setup', 'shell']);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { selectTenant, refresh } = useTenant();
  // Generated once per visit: a retried submit replays instead of duplicating (ADR-0004)
  const [ids] = useState(() => ({ tenantId: ulid(), farmId: ulid() }));
  const zones = useMemo(() => timeZones(), []);
  const [values, setValues] = useState<Values>({
    name: '',
    farmName: '',
    farmArea: '',
    farmAreaUnit: SETUP_DEFAULTS.farmAreaUnit,
    farmLocationLabel: '',
    defaultTimezone: SETUP_DEFAULTS.defaultTimezone,
    defaultCurrency: SETUP_DEFAULTS.defaultCurrency,
    defaultLocale: SETUP_DEFAULTS.defaultLocale,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof Values, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      void router.replace('/auth/login?redirect=%2Fsetup');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Head>
          <title>{`${t('title')} · ${t('shell:appName')}`}</title>
          <meta name='robots' content='noindex, nofollow' />
        </Head>
        <GateLoading />
      </>
    );
  }

  const set = (f: keyof Values) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [f]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = setupSchema({
      required: t('validation.required'),
      tooLong: max => t('validation.tooLong', { max }),
      area: t('validation.area'),
    }).safeParse(values);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map(i => [String(i.path[0]), i.message])
        )
      );
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const d = parsed.data;
      await createTenant({
        ...ids,
        name: d.name,
        farmName: d.farmName,
        farmArea: d.farmArea,
        farmAreaUnit: d.farmArea === null ? null : d.farmAreaUnit,
        farmLocationLabel: d.farmLocationLabel,
        defaultTimezone: d.defaultTimezone,
        defaultCurrency: d.defaultCurrency,
        defaultLocale: d.defaultLocale,
      });
      selectTenant(ids.tenantId);
      await refresh();
      await router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'VALIDATION'
          ? err.message
          : t('failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const err = (f: keyof Values) => fieldErrors[f];
  const section = (label: string) => (
    <Typography variant='overline' component='h2' color='text.secondary'>
      {label}
    </Typography>
  );

  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')} error={error} wide>
      <Stack component='form' spacing={2.5} onSubmit={onSubmit} noValidate>
        {section(t('sections.account'))}
        <TextField
          label={t('fields.tenantName')}
          value={values.name}
          onChange={set('name')}
          error={Boolean(err('name'))}
          helperText={err('name') ?? t('fields.tenantNameHelp')}
          autoComplete='organization'
          required
        />

        <Divider />
        {section(t('sections.farm'))}
        <TextField
          label={t('fields.farmName')}
          value={values.farmName}
          onChange={set('farmName')}
          error={Boolean(err('farmName'))}
          helperText={err('farmName')}
          required
        />
        <Stack direction='row' spacing={2}>
          <TextField
            label={t('fields.farmArea')}
            value={values.farmArea}
            onChange={set('farmArea')}
            inputMode='decimal'
            error={Boolean(err('farmArea'))}
            helperText={err('farmArea')}
          />
          <TextField
            select
            label={t('fields.farmAreaUnit')}
            value={values.farmAreaUnit}
            onChange={set('farmAreaUnit')}
          >
            {AREA_UNITS.map(u => (
              <MenuItem key={u} value={u}>
                {t(`units.${u}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField
          label={t('fields.farmLocation')}
          value={values.farmLocationLabel}
          onChange={set('farmLocationLabel')}
          error={Boolean(err('farmLocationLabel'))}
          helperText={err('farmLocationLabel') ?? t('fields.farmLocationHelp')}
        />

        <Divider />
        {section(t('sections.regional'))}
        <Autocomplete
          options={zones}
          value={values.defaultTimezone}
          onChange={(_, v) =>
            v && setValues(s => ({ ...s, defaultTimezone: v }))
          }
          disableClearable
          renderInput={params => (
            <TextField
              {...(params as TextFieldProps)}
              label={t('fields.timezone')}
              {...(err('defaultTimezone')
                ? { error: true, helperText: err('defaultTimezone') }
                : {})}
            />
          )}
        />
        <Stack direction='row' spacing={2}>
          <TextField
            select
            label={t('fields.currency')}
            value={values.defaultCurrency}
            onChange={set('defaultCurrency')}
          >
            {CURRENCIES.map(c => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('fields.locale')}
            value={values.defaultLocale}
            onChange={set('defaultLocale')}
          >
            {LOCALES.map(l => (
              <MenuItem key={l} value={l}>
                {t(`languages.${l}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={submitting}
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </Stack>
    </AuthCard>
  );
}
