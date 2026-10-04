/** Team access hooks (React Query). The server enforces every guardrail. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type TeamMember,
  acceptInvite,
  getTeam,
  inviteMember,
  myInvites,
  revokeInvite,
  saveProfile,
  saveRole,
  updateMember,
} from '@/lib/api';
import { useTenant } from '@/features/tenant';

const useTenantId = () => useTenant().tenant?.tenantId ?? '';

export function useTeam() {
  const tenantId = useTenantId();
  const { can } = useTenant();
  return useQuery({
    queryKey: ['team', tenantId],
    queryFn: () => getTeam(tenantId),
    enabled: Boolean(tenantId) && can('member.manage'),
  });
}

/** Invites waiting for the signed-in user's email (shown before setup). */
export function useMyInvites(enabled = true) {
  return useQuery({
    queryKey: ['myInvites'],
    queryFn: myInvites,
    enabled,
    staleTime: 30_000,
  });
}

export function useJoin() {
  const qc = useQueryClient();
  const { refresh, selectTenant } = useTenant();
  return useMutation({
    mutationFn: (tenantId: string) => acceptInvite(tenantId),
    onSuccess: async res => {
      await refresh();
      selectTenant(res.tenantId);
      await qc.invalidateQueries({ queryKey: ['myInvites'] });
    },
  });
}

export function useTeamActions() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const { refresh } = useTenant();
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['team', tenantId] });
    // My own entitlements may have changed (e.g. I edited a role I hold)
    await refresh();
  };
  return {
    invite: useMutation({
      mutationFn: (a: { email: string; profileId: string }) =>
        inviteMember(tenantId, a.email, a.profileId),
      onSuccess: done,
    }),
    revoke: useMutation({
      mutationFn: (email: string) => revokeInvite(tenantId, email),
      onSuccess: done,
    }),
    updateMember: useMutation({
      mutationFn: (a: {
        member: TeamMember;
        changes: { profileId?: string; status?: string };
      }) => updateMember(tenantId, a.member, a.changes),
      onSuccess: done,
    }),
    saveRole: useMutation({
      mutationFn: (
        a: Parameters<typeof saveRole>[1] & {
          values: Parameters<typeof saveRole>[2];
        }
      ) => saveRole(tenantId, a, a.values),
      onSuccess: done,
    }),
    saveProfile: useMutation({
      mutationFn: (
        a: Parameters<typeof saveProfile>[1] & {
          values: Parameters<typeof saveProfile>[2];
        }
      ) => saveProfile(tenantId, a, a.values),
      onSuccess: done,
    }),
  };
}
