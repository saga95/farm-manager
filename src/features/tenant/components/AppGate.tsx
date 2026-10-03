/**
 * AppGate: protects authenticated app pages.
 * Signed out → sign-in (with return path); no tenant yet → /setup (SCR-002).
 * While deciding, renders an accessible loading state (never private content).
 */

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '../TenantProvider';
import { decideGate } from '../selection';

const center = {
  minHeight: '60dvh',
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  px: 2,
} as const;

export function GateLoading() {
  const { t } = useTranslation('auth');
  return (
    <Box role='status' aria-live='polite' sx={center}>
      <Box>
        <CircularProgress aria-hidden />
        <Typography sx={{ mt: 2 }} color='text.secondary'>
          {t('redirecting')}
        </Typography>
      </Box>
    </Box>
  );
}

function GateError({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation(['common', 'auth']);
  return (
    <Box role='alert' sx={center}>
      <Stack spacing={2} alignItems='center'>
        <Typography>{t('common:error')}</Typography>
        <Stack direction='row' spacing={1}>
          <Button variant='contained' onClick={onRetry}>
            {t('common:retry')}
          </Button>
          <Button onClick={onSignOut}>{t('auth:signOut')}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export function AppGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { loading, tenant, me, error, refresh } = useTenant();

  const decision = decideGate({
    authLoading: isLoading,
    isAuthenticated,
    meLoading: loading || (isAuthenticated && !me),
    meFailed: Boolean(error) && !me,
    hasTenant: Boolean(tenant),
    path: router.asPath,
  });
  const redirectTo = decision.kind === 'redirect' ? decision.to : null;

  useEffect(() => {
    if (redirectTo) void router.replace(redirectTo);
    // router identity changes every navigation; the target is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo]);

  // eslint-disable-next-line react/jsx-no-useless-fragment -- required for JSX return type
  if (decision.kind === 'render') return <>{children}</>;
  if (decision.kind === 'error') {
    return (
      <GateError
        onRetry={() => void refresh()}
        onSignOut={() => void logout()}
      />
    );
  }
  return <GateLoading />;
}

export default AppGate;
