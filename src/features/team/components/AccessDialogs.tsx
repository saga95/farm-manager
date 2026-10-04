/**
 * Team access dialogs (#121, #37): invite someone, edit a role (entitlement
 * checklist grouped by area), edit a profile (roles + live "what can they do"
 * preview). The UI disables what the user can't grant; the server enforces
 * every guardrail regardless (escalation, lock-out, Owner protected).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import {
  ENTITLEMENT_GROUPS,
  type EntitlementGroup,
  SYSTEM_PROFILE_IDS,
} from '@/domain/rbac';
import type { TeamProfile, TeamRole } from '@/lib/api';

const GROUPS = Object.keys(ENTITLEMENT_GROUPS) as EntitlementGroup[];
/** Entitlements of one area, widened for array helpers. */
const inGroup = (g: EntitlementGroup): readonly string[] =>
  ENTITLEMENT_GROUPS[g];

/** Entitlements a profile grants, through its active roles. */
export function profileEntitlements(
  profile: Pick<TeamProfile, 'roleIds'>,
  roles: readonly TeamRole[]
): Set<string> {
  const out = new Set<string>();
  for (const id of profile.roleIds) {
    const role = roles.find(r => r.id === id);
    if (role && role.status === 'ACTIVE')
      role.entitlements.forEach(e => out.add(e));
  }
  return out;
}

/** "Preview what this profile can do": grouped, plain language. */
export function EntitlementPreview({
  entitlements,
  empty,
}: {
  entitlements: ReadonlySet<string>;
  empty: string;
}) {
  const { t } = useTranslation('team');
  if (entitlements.size === 0)
    return <Typography color='text.secondary'>{empty}</Typography>;
  return (
    <Stack spacing={1}>
      {GROUPS.filter(g => inGroup(g).some(e => entitlements.has(e))).map(g => (
        <Box key={g}>
          <Typography variant='subtitle2'>{t(`groups.${g}`)}</Typography>
          <List dense disablePadding>
            {inGroup(g)
              .filter(e => entitlements.has(e))
              .map(e => (
                <ListItem key={e} disableGutters sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleOutline
                      fontSize='small'
                      color='success'
                      aria-hidden
                    />
                  </ListItemIcon>
                  <ListItemText primary={t(`entitlement.${e}`)} />
                </ListItem>
              ))}
          </List>
        </Box>
      ))}
    </Stack>
  );
}

// ─── Invite ─────────────────────────────────────────────────────────────────

export interface InviteDialogProps {
  open: boolean;
  profiles: readonly TeamProfile[];
  roles: readonly TeamRole[];
  saving: boolean;
  error?: string | null | undefined;
  onSave: (email: string, profileId: string) => void;
  onClose: () => void;
}

export function InviteDialog({
  open,
  profiles,
  roles,
  saving,
  error,
  onSave,
  onClose,
}: InviteDialogProps) {
  const { t } = useTranslation('team');
  const active = profiles.filter(p => p.status === 'ACTIVE');
  const [email, setEmail] = useState('');
  const [profileId, setProfileId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setProfileId(
      active.find(p => p.id === SYSTEM_PROFILE_IDS.farmHelper)?.id ??
        active[0]?.id ??
        ''
    );
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [open]);

  const profile = active.find(p => p.id === profileId);
  const submit = () => {
    if (!/^[^\s@#]+@[^\s@#]+\.[^\s@#]+$/.test(email.trim()))
      return setProblem(t('invite.invalidEmail'));
    setProblem(null);
    return onSave(email.trim(), profileId);
  };

  return (
    <FormDialog
      open={open}
      title={t('invite.title')}
      submitLabel={t('invite.save')}
      submittingLabel={t('invite.saving')}
      cancelLabel={t('invite.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('invite.email')}
        type='email'
        value={email}
        onChange={e => setEmail(e.target.value)}
        helperText={t('invite.emailHelp')}
        inputMode='email'
        autoComplete='off'
        required
      />
      <TextField
        select
        label={t('invite.profile')}
        value={profileId}
        onChange={e => setProfileId(e.target.value)}
      >
        {active.map(p => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      {profile && (
        <Box>
          <Typography variant='subtitle2' sx={{ mb: 1 }}>
            {t('invite.preview')}
          </Typography>
          <EntitlementPreview
            entitlements={profileEntitlements(profile, roles)}
            empty={t('profileDialog.nothing')}
          />
        </Box>
      )}
    </FormDialog>
  );
}

// ─── Role ───────────────────────────────────────────────────────────────────

export interface RoleDialogProps {
  open: boolean;
  role?: TeamRole | null | undefined;
  /** What the signed-in user holds: only these can be newly granted */
  mine: ReadonlySet<string>;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (values: {
    name: string;
    entitlements: string[];
    status: string;
  }) => void;
  onClose: () => void;
}

export function RoleDialog({
  open,
  role,
  mine,
  saving,
  error,
  onSave,
  onClose,
}: RoleDialogProps) {
  const { t } = useTranslation('team');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setPicked(new Set(role?.entitlements ?? []));
    setArchived(role?.status === 'ARCHIVED');
    setProblem(null);
  }, [open, role]);

  const toggle = (e: string) =>
    setPicked(p => {
      const next = new Set(p);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });

  const submit = () => {
    if (name.trim() === '') return setProblem(t('roleDialog.needName'));
    setProblem(null);
    return onSave({
      name: name.trim(),
      entitlements: [...picked].sort(),
      status: archived ? 'ARCHIVED' : 'ACTIVE',
    });
  };

  return (
    <FormDialog
      open={open}
      title={
        role
          ? t('roleDialog.editTitle', { name: role.name })
          : t('roleDialog.addTitle')
      }
      submitLabel={t('roleDialog.save')}
      submittingLabel={t('roleDialog.saving')}
      cancelLabel={t('roleDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('roleDialog.name')}
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <Typography variant='subtitle2'>{t('roleDialog.what')}</Typography>
      {GROUPS.map(g => (
        <FormGroup key={g} aria-label={t(`groups.${g}`)}>
          <Typography variant='overline' color='text.secondary'>
            {t(`groups.${g}`)}
          </Typography>
          {inGroup(g).map(e => {
            // Can't newly grant what you don't hold (no escalation)
            const locked = !mine.has(e) && !role?.entitlements.includes(e);
            return (
              <FormControlLabel
                key={e}
                control={
                  <Checkbox
                    checked={picked.has(e)}
                    onChange={() => toggle(e)}
                    disabled={locked}
                  />
                }
                label={
                  <Box>
                    <Typography variant='body2'>
                      {t(`entitlement.${e}`)}
                    </Typography>
                    {locked && (
                      <Typography variant='caption' color='text.secondary'>
                        {t('roleDialog.notYours')}
                      </Typography>
                    )}
                  </Box>
                }
              />
            );
          })}
        </FormGroup>
      ))}
      {role && (
        <FormControlLabel
          control={
            <Switch
              checked={archived}
              onChange={e => setArchived(e.target.checked)}
            />
          }
          label={t('roleDialog.archive')}
        />
      )}
    </FormDialog>
  );
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface ProfileDialogProps {
  open: boolean;
  profile?: TeamProfile | null | undefined;
  roles: readonly TeamRole[];
  saving: boolean;
  error?: string | null | undefined;
  onSave: (values: { name: string; roleIds: string[]; status: string }) => void;
  onClose: () => void;
}

export function ProfileDialog({
  open,
  profile,
  roles,
  saving,
  error,
  onSave,
  onClose,
}: ProfileDialogProps) {
  const { t } = useTranslation('team');
  const [name, setName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const isOwner = profile?.id === SYSTEM_PROFILE_IDS.owner;

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? '');
    setRoleIds(profile?.roleIds ?? []);
    setArchived(profile?.status === 'ARCHIVED');
    setProblem(null);
  }, [open, profile]);

  const activeRoles = roles.filter(
    r => r.status === 'ACTIVE' || roleIds.includes(r.id)
  );
  const submit = () => {
    if (name.trim() === '') return setProblem(t('profileDialog.needName'));
    setProblem(null);
    return onSave({
      name: name.trim(),
      roleIds,
      status: archived ? 'ARCHIVED' : 'ACTIVE',
    });
  };

  return (
    <FormDialog
      open={open}
      title={
        profile
          ? t('profileDialog.editTitle', { name: profile.name })
          : t('profileDialog.addTitle')
      }
      submitLabel={t('profileDialog.save')}
      submittingLabel={t('profileDialog.saving')}
      cancelLabel={t('profileDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('profileDialog.name')}
        value={name}
        onChange={e => setName(e.target.value)}
        helperText={t('profileDialog.nameHelp')}
        required
      />
      <FormGroup aria-label={t('profileDialog.roles')}>
        <Typography variant='subtitle2'>{t('profileDialog.roles')}</Typography>
        {activeRoles.map(r => (
          <FormControlLabel
            key={r.id}
            control={
              <Checkbox
                checked={roleIds.includes(r.id)}
                onChange={() =>
                  setRoleIds(ids =>
                    ids.includes(r.id)
                      ? ids.filter(x => x !== r.id)
                      : [...ids, r.id]
                  )
                }
              />
            }
            label={`${r.name}${r.status === 'ARCHIVED' ? ` (${t('access.archived')})` : ''}`}
          />
        ))}
      </FormGroup>
      <Box>
        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          {t('profileDialog.preview')}
        </Typography>
        <EntitlementPreview
          entitlements={profileEntitlements({ roleIds }, roles)}
          empty={t('profileDialog.nothing')}
        />
      </Box>
      {profile &&
        (isOwner ? (
          <Typography variant='caption' color='text.secondary'>
            {t('profileDialog.ownerProtected')}
          </Typography>
        ) : (
          <FormControlLabel
            control={
              <Switch
                checked={archived}
                onChange={e => setArchived(e.target.checked)}
              />
            }
            label={t('profileDialog.archive')}
          />
        ))}
    </FormDialog>
  );
}
