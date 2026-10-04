/**
 * JoinInvites: invites waiting for the signed-in user's verified email (#37).
 * Shown on setup (new users) and on Home (people who already have a farm).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { MyInvite } from '@/lib/api';
import { useJoin, useMyInvites } from '../hooks';

export interface JoinInvitesProps {
  invites: readonly MyInvite[];
  joining: string | null;
  error?: string | null | undefined;
  onJoin: (tenantId: string) => void;
  /** Extra line under the invites, e.g. "Or set up your own farm below." */
  footer?: string | undefined;
}

export function JoinInvites({
  invites,
  joining,
  error,
  onJoin,
  footer,
}: JoinInvitesProps) {
  const { t } = useTranslation('team');
  if (invites.length === 0) return null;
  return (
    <Card component='section' aria-labelledby='join-title' sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id='join-title' variant='h3' component='h2'>
            {t('join.title')}
          </Typography>
          {error && (
            <Alert severity='error' role='alert'>
              {error}
            </Alert>
          )}
          {invites.map(i => (
            <Stack key={i.tenantId} spacing={1}>
              <Typography>
                {i.invitedBy
                  ? t('join.body', {
                      invitedBy: i.invitedBy,
                      tenant: i.tenantName,
                    })
                  : t('join.bodyNoInviter', { tenant: i.tenantName })}
              </Typography>
              <Button
                variant='contained'
                size='large'
                disabled={joining !== null}
                onClick={() => onJoin(i.tenantId)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {joining === i.tenantId
                  ? t('join.joining')
                  : t('join.join', { tenant: i.tenantName })}
              </Button>
            </Stack>
          ))}
          {footer && (
            <Typography variant='body2' color='text.secondary'>
              {footer}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Wired version: loads invites and joins. */
export function PendingInvites({
  footer,
  onJoined,
}: {
  footer?: string;
  onJoined?: () => void;
}) {
  const { t } = useTranslation('team');
  const invites = useMyInvites();
  const join = useJoin();
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <JoinInvites
      invites={invites.data ?? []}
      joining={joining}
      error={error}
      footer={footer}
      onJoin={tenantId => {
        setJoining(tenantId);
        setError(null);
        void join
          .mutateAsync(tenantId)
          .then(() => onJoined?.())
          .catch(() => setError(t('join.failed')))
          .finally(() => setJoining(null));
      }}
    />
  );
}

export default JoinInvites;
