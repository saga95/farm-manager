import { type FormEvent, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthCard } from '@/components/ui/AuthCard/AuthCard';
import { useAuth } from '@/contexts/AuthContext';
import { codeSchema } from '@/features/tenant/authSchemas';

/** Email verification after sign-up. */
export default function ConfirmPage() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { confirmRegistration } = useAuth();
  const email =
    typeof router.query['email'] === 'string' ? router.query['email'] : '';
  const [emailValue, setEmailValue] = useState(email);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const username = email || emailValue;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = codeSchema({ code: t('validation.code') }).safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? t('validation.code'));
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    try {
      await confirmRegistration({ username, confirmationCode: parsed.data });
      await router.push({ pathname: '/auth/login', query: { verified: '1' } });
    } catch {
      setError(t('confirm.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title={t('confirm.title')}
      subtitle={t('confirm.subtitle', { email: username || '…' })}
      error={error}
      footer={
        <Link component={NextLink} href='/auth/login'>
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      <Stack component='form' spacing={2} onSubmit={onSubmit} noValidate>
        {!email && (
          <TextField
            label={t('fields.email')}
            type='email'
            autoComplete='email'
            value={emailValue}
            onChange={e => setEmailValue(e.target.value)}
            required
          />
        )}
        <TextField
          label={t('fields.code')}
          value={code}
          onChange={e => setCode(e.target.value)}
          inputMode='numeric'
          autoComplete='one-time-code'
          inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
          error={Boolean(codeError)}
          helperText={codeError}
          required
        />
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={submitting || !username}
        >
          {submitting ? t('confirm.submitting') : t('confirm.submit')}
        </Button>
      </Stack>
    </AuthCard>
  );
}
