import { type FormEvent, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthCard } from '@/components/ui/AuthCard/AuthCard';
import { PASSWORD_PATTERN, codeSchema } from '@/features/tenant/authSchemas';

/** Password recovery: request a code, then set a new password. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError({ field: 'email', message: t('validation.email') });
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await resetPassword({ username: email.trim() });
      setStep('reset');
    } catch {
      setError(t('forgot.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedCode = codeSchema({ code: t('validation.code') }).safeParse(
      code
    );
    if (!parsedCode.success) {
      setFieldError({ field: 'code', message: t('validation.code') });
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setFieldError({
        field: 'password',
        message: t('validation.passwordRules'),
      });
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: parsedCode.data,
        newPassword: password,
      });
      await router.push({ pathname: '/auth/login', query: { reset: '1' } });
    } catch {
      setError(t('forgot.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const err = (f: string) =>
    fieldError?.field === f ? fieldError.message : undefined;

  return (
    <AuthCard
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      error={error}
      footer={
        <Link component={NextLink} href='/auth/login'>
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      {step === 'request' ? (
        <Stack component='form' spacing={2} onSubmit={request} noValidate>
          <TextField
            label={t('fields.email')}
            type='email'
            autoComplete='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={Boolean(err('email'))}
            helperText={err('email')}
            required
          />
          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={submitting}
          >
            {submitting ? t('forgot.sending') : t('forgot.sendCode')}
          </Button>
        </Stack>
      ) : (
        <Stack component='form' spacing={2} onSubmit={reset} noValidate>
          <TextField
            label={t('fields.code')}
            inputMode='numeric'
            autoComplete='one-time-code'
            value={code}
            onChange={e => setCode(e.target.value)}
            error={Boolean(err('code'))}
            helperText={err('code')}
            required
          />
          <TextField
            label={t('fields.newPassword')}
            type='password'
            autoComplete='new-password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={Boolean(err('password'))}
            helperText={err('password') ?? t('validation.passwordRules')}
            required
          />
          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={submitting}
          >
            {submitting ? t('forgot.resetting') : t('forgot.reset')}
          </Button>
        </Stack>
      )}
    </AuthCard>
  );
}
