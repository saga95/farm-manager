import { useState } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { InviteDialog } from '@/features/team/components/AccessDialogs';
import { useTeam, useTeamActions } from '@/features/team/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError, type TeamMember } from '@/lib/api';

/** SCR-030 Team: members, their profiles, invites (#37, #121). */
export default function MembersPage() {
  const { t, i18n } = useTranslation('team');
  const { can } = useTenant();
  const team = useTeam();
  const actions = useTeamActions();
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const d = team.data;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso)
    );
  const activeProfiles = (d?.profiles ?? []).filter(p => p.status === 'ACTIVE');

  /** Server guardrails come back as plain explanations. */
  const explain = (e: unknown) => {
    if (e instanceof ApiError && /lockout/i.test(e.message))
      return t('roleDialog.lockout');
    if (
      e instanceof ApiError &&
      (e.code === 'FORBIDDEN' || e.code === 'VALIDATION')
    )
      return e.message;
    return t('members.failed');
  };
  const change = (
    member: TeamMember,
    changes: { profileId?: string; status?: string }
  ) => {
    setError(null);
    void actions.updateMember
      .mutateAsync({ member, changes })
      .then(() => setRemoving(null))
      .catch(e => setError(explain(e)));
  };

  if (!can('member.manage'))
    return (
      <AppPage title={t('members.title')}>
        <EmptyState size='page' message={t('members.failed')} />
      </AppPage>
    );

  return (
    <AppPage
      title={t('members.title')}
      actions={
        <Button
          variant='contained'
          startIcon={<GroupAddOutlined aria-hidden />}
          onClick={() => {
            setInviteError(null);
            setInviting(true);
          }}
        >
          {t('members.invite')}
        </Button>
      }
    >
      <Stack spacing={2}>
        <Typography color='text.secondary'>{t('members.intro')}</Typography>
        {notice && (
          <Alert severity='success' onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        {error && (
          <Alert severity='error' role='alert' onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {team.isLoading && (
          <Skeleton variant='rounded' height={240} aria-hidden />
        )}
        {d?.members.map(m => {
          const label = m.email ?? t('members.noEmail');
          return (
            <Card key={m.userId} component='section' aria-label={label}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    useFlexGap
                    flexWrap='wrap'
                  >
                    <Typography
                      sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                    >
                      {label}
                    </Typography>
                    {m.isMe && <Chip size='small' label={t('members.you')} />}
                    {m.status !== 'ACTIVE' && (
                      <Chip
                        size='small'
                        color='warning'
                        variant='outlined'
                        label={t(`members.status.${m.status}`)}
                      />
                    )}
                  </Stack>
                  <TextField
                    select
                    size='small'
                    label={t('members.changeProfile', { name: label })}
                    value={m.profileId}
                    onChange={e => change(m, { profileId: e.target.value })}
                    disabled={actions.updateMember.isLoading}
                  >
                    {activeProfiles.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {removing?.userId === m.userId ? (
                    <Alert
                      severity='warning'
                      action={
                        <Stack direction='row' spacing={1}>
                          <Button
                            color='inherit'
                            size='small'
                            onClick={() => setRemoving(null)}
                          >
                            {t('members.cancel')}
                          </Button>
                          <Button
                            color='error'
                            size='small'
                            variant='contained'
                            onClick={() => change(m, { status: 'REMOVED' })}
                          >
                            {t('members.removeYes')}
                          </Button>
                        </Stack>
                      }
                    >
                      {t('members.removeConfirm', { name: label })}
                    </Alert>
                  ) : (
                    <Stack direction='row' spacing={1}>
                      <Button
                        size='small'
                        onClick={() =>
                          change(m, {
                            status:
                              m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                          })
                        }
                        disabled={actions.updateMember.isLoading}
                      >
                        {m.status === 'ACTIVE'
                          ? t('members.suspend')
                          : t('members.reactivate')}
                      </Button>
                      <Button
                        size='small'
                        color='error'
                        onClick={() => setRemoving(m)}
                      >
                        {t('members.remove')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}

        {d && d.invites.length > 0 && (
          <Stack
            spacing={1}
            component='section'
            aria-labelledby='pending-title'
          >
            <Typography id='pending-title' variant='h3' component='h2'>
              {t('members.pending')}
            </Typography>
            {d.invites.map(i => (
              <Card key={i.email} variant='outlined'>
                <CardContent>
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    justifyContent='space-between'
                    useFlexGap
                    flexWrap='wrap'
                  >
                    <Stack>
                      <Typography sx={{ wordBreak: 'break-all' }}>
                        {i.email}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {[
                          i.profileName,
                          t('members.expires', { date: fmt(i.expiresAt) }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Stack>
                    <Button
                      size='small'
                      color='inherit'
                      onClick={() =>
                        void actions.revoke
                          .mutateAsync(i.email)
                          .catch(e => setError(explain(e)))
                      }
                    >
                      {t('members.revoke')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {(can('role.manage') || can('profile.manage')) && (
          <Button
            component={NextLink}
            href='/settings/access'
            variant='outlined'
            startIcon={<ShieldOutlined aria-hidden />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('members.manageAccess')}
          </Button>
        )}
      </Stack>

      {d && (
        <InviteDialog
          open={inviting}
          profiles={d.profiles}
          roles={d.roles}
          saving={actions.invite.isLoading}
          error={inviteError}
          onClose={() => setInviting(false)}
          onSave={(email, profileId) =>
            void actions.invite
              .mutateAsync({ email, profileId })
              .then(i => {
                setInviting(false);
                setNotice(t('invite.done', { email: i.email }));
              })
              .catch(e => setInviteError(explain(e)))
          }
        />
      )}
    </AppPage>
  );
}
