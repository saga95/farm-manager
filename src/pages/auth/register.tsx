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
import { registerSchema } from '@/features/tenant/authSchemas';

type Field =
  | 'givenName'
  | 'familyName'
  | 'email'
  | 'password'
  | 'confirmPassword';

/** Account creation; the farm itself is created next in /setup (SCR-002). */
export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { register } = useAuth();
  const [values, setValues] = useState<Record<Field, string>>({
    givenName: '',
    familyName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<Field, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (f: Field) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [f]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema({
      email: t('validation.email'),
      password: t('validation.passwordRules'),
      match: t('validation.passwordMatch'),
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
      const { email, password, givenName, familyName } = parsed.data;
      await register({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(givenName ? { given_name: givenName } : {}),
            ...(familyName ? { family_name: familyName } : {}),
          },
        },
      });
      await router.push({ pathname: '/auth/confirm', query: { email } });
    } catch (err) {
      setError(
        (err as { name?: string }).name === 'UsernameExistsException'
          ? t('register.exists')
          : t('register.failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    f: Field,
    label: string,
    props: Record<string, unknown> = {}
  ) => (
    <TextField
      label={label}
      value={values[f]}
      onChange={set(f)}
      error={Boolean(fieldErrors[f])}
      helperText={fieldErrors[f]}
      {...props}
    />
  );

  return (
    <AuthCard
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      error={error}
      footer={
        <>
          {t('register.haveAccount')}{' '}
          <Link component={NextLink} href='/auth/login'>
            {t('register.login')}
          </Link>
        </>
      }
    >
      <Stack component='form' spacing={2} onSubmit={onSubmit} noValidate>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {field('givenName', t('fields.givenName'), {
            autoComplete: 'given-name',
          })}
          {field('familyName', t('fields.familyName'), {
            autoComplete: 'family-name',
          })}
        </Stack>
        {field('email', t('fields.email'), {
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          required: true,
        })}
        {field('password', t('fields.password'), {
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          ...(fieldErrors.password
            ? {}
            : { helperText: t('validation.passwordRules') }),
        })}
        {field('confirmPassword', t('fields.confirmPassword'), {
          type: 'password',
          autoComplete: 'new-password',
          required: true,
        })}
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={submitting}
        >
          {submitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </Stack>
    </AuthCard>
  );
}
