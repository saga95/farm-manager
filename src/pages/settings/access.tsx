import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import {
  ProfileDialog,
  RoleDialog,
  profileEntitlements,
} from '@/features/team/components/AccessDialogs';
import { useTeam, useTeamActions } from '@/features/team/hooks';
import { useTenant } from '@/features/tenant';
import { ApiError, type TeamProfile, type TeamRole } from '@/lib/api';

type Editing<T> = { item: T | null; id: string; version: number } | null;

/** Roles & profiles (#121): tenant-defined access, with preview. */
export default function AccessPage() {
  const { t } = useTranslation('team');
  const { can } = useTenant();
  const team = useTeam();
  const actions = useTeamActions();
  const [showArchived, setShowArchived] = useState(false);
  const [role, setRole] = useState<Editing<TeamRole>>(null);
  const [profile, setProfile] = useState<Editing<TeamProfile>>(null);
  const [error, setError] = useState<string | null>(null);
  const d = team.data;
  const mine = useMemo(() => new Set(d?.myEntitlements ?? []), [d]);
  const visible = <T extends { status: string }>(xs: readonly T[]) =>
    xs.filter(x => showArchived || x.status === 'ACTIVE');

  const explain = (e: unknown) => {
    if (e instanceof ApiError && /lockout/i.test(e.message))
      return t('roleDialog.lockout');
    if (
      e instanceof ApiError &&
      (e.code === 'FORBIDDEN' ||
        e.code === 'VALIDATION' ||
        e.code === 'CONFLICT')
    )
      return e.message;
    return t('roleDialog.failed');
  };
  const badge = (x: { isSystem: boolean; status: string }) =>
    x.status === 'ARCHIVED'
      ? t('access.archived')
      : x.isSystem
        ? t('access.system')
        : undefined;

  return (
    <AppPage title={t('access.title')} showQuickActions={false}>
      <Button
        component={NextLink}
        href='/settings/members'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 1 }}
      >
        {t('access.back')}
      </Button>
      {!can('member.manage') ? (
        <EmptyState size='page' message={t('members.failed')} />
      ) : (
        <Stack spacing={2}>
          <Typography color='text.secondary'>{t('access.intro')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showArchived}
                onChange={e => setShowArchived(e.target.checked)}
              />
            }
            label={t('access.showArchived')}
          />
          {team.isLoading && (
            <Skeleton variant='rounded' height={240} aria-hidden />
          )}
          {d && (
            <>
              <Stack
                direction='row'
                justifyContent='space-between'
                alignItems='center'
              >
                <Typography variant='h3' component='h2'>
                  {t('access.profiles')}
                </Typography>
                {can('profile.manage') && (
                  <Button
                    startIcon={<AddOutlined aria-hidden />}
                    onClick={() => {
                      setError(null);
                      setProfile({ item: null, id: ulid(), version: 0 });
                    }}
                  >
                    {t('access.newProfile')}
                  </Button>
                )}
              </Stack>
              <EntityList
                label={t('access.profiles')}
                rows={visible(d.profiles).map(p => ({
                  id: p.id,
                  primary: p.name,
                  secondary: t('access.can', {
                    count: profileEntitlements(p, d.roles).size,
                  }),
                  badge: badge(p),
                }))}
                {...(can('profile.manage')
                  ? {
                      onSelect: (id: string) => {
                        const p = d.profiles.find(x => x.id === id)!;
                        setError(null);
                        setProfile({ item: p, id: p.id, version: p.version });
                      },
                    }
                  : {})}
              />

              <Stack
                direction='row'
                justifyContent='space-between'
                alignItems='center'
              >
                <Typography variant='h3' component='h2'>
                  {t('access.roles')}
                </Typography>
                {can('role.manage') && (
                  <Button
                    startIcon={<AddOutlined aria-hidden />}
                    onClick={() => {
                      setError(null);
                      setRole({ item: null, id: ulid(), version: 0 });
                    }}
                  >
                    {t('access.newRole')}
                  </Button>
                )}
              </Stack>
              <EntityList
                label={t('access.roles')}
                rows={visible(d.roles).map(r => ({
                  id: r.id,
                  primary: r.name,
                  secondary: t('access.can', { count: r.entitlements.length }),
                  badge: badge(r),
                }))}
                {...(can('role.manage')
                  ? {
                      onSelect: (id: string) => {
                        const r = d.roles.find(x => x.id === id)!;
                        setError(null);
                        setRole({ item: r, id: r.id, version: r.version });
                      },
                    }
                  : {})}
              />
              {error && !role && !profile && (
                <Alert severity='error'>{error}</Alert>
              )}
            </>
          )}
        </Stack>
      )}
      {d && (
        <RoleDialog
          open={role !== null}
          role={role?.item}
          mine={mine}
          saving={actions.saveRole.isLoading}
          error={error}
          onClose={() => setRole(null)}
          onSave={values =>
            role &&
            void actions.saveRole
              .mutateAsync({ id: role.id, version: role.version, values })
              .then(() => setRole(null))
              .catch(e => setError(explain(e)))
          }
        />
      )}
      {d && (
        <ProfileDialog
          open={profile !== null}
          profile={profile?.item}
          roles={d.roles}
          saving={actions.saveProfile.isLoading}
          error={error}
          onClose={() => setProfile(null)}
          onSave={values =>
            profile &&
            void actions.saveProfile
              .mutateAsync({ id: profile.id, version: profile.version, values })
              .then(() => setProfile(null))
              .catch(e => setError(explain(e)))
          }
        />
      )}
    </AppPage>
  );
}
