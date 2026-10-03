import { type FormEvent, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthCard } from '@/components/ui/AuthCard/AuthCard';
import { AuthStepError, useAuth } from '@/contexts/AuthContext';
import { loginSchema } from '@/features/tenant/authSchemas';
import { safeRedirect } from '@/features/tenant';

/** SCR-001 Sign in. */
export default function LoginPage() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const redirect = safeRedirect(router.query['redirect']);
  const notice =
    router.query['verified'] === '1'
      ? t('confirm.success')
      : router.query['reset'] === '1'
        ? t('forgot.success')
        : null;

  // Already signed in → continue
  useEffect(() => {
    if (!isLoading && isAuthenticated) void router.replace(redirect);
  }, [isLoading, isAuthenticated, redirect, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema({
      email: t('validation.email'),
      password: t('validation.required'),
    }).safeParse({
      email,
      password,
    });
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
      await login(parsed.data.email, parsed.data.password);
      await router.replace(redirect);
    } catch (err) {
      if (err instanceof AuthStepError && err.step === 'CONFIRM_SIGN_UP') {
        await router.push({
          pathname: '/auth/confirm',
          query: { email: parsed.data.email },
        });
        return;
      }
      setError(t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      error={error}
      notice={notice}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link component={NextLink} href='/auth/register'>
            {t('login.register')}
          </Link>
        </>
      }
    >
      <Stack component='form' spacing={2} onSubmit={onSubmit} noValidate>
        <TextField
          label={t('fields.email')}
          type='email'
          autoComplete='email'
          inputMode='email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={Boolean(fieldErrors['email'])}
          helperText={fieldErrors['email']}
          required
        />
        <TextField
          label={t('fields.password')}
          type='password'
          autoComplete='current-password'
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={Boolean(fieldErrors['password'])}
          helperText={fieldErrors['password']}
          required
        />
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={submitting}
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </Button>
        <Link
          component={NextLink}
          href='/auth/forgot-password'
          sx={{ alignSelf: 'center' }}
        >
          {t('login.forgot')}
        </Link>
      </Stack>
    </AuthCard>
  );
}
