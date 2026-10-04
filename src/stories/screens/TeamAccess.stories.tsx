import type { Meta, StoryObj } from '@storybook/react';
import {
  InviteDialog,
  ProfileDialog,
  RoleDialog,
} from '../../features/team/components/AccessDialogs';
import { JoinInvites } from '../../features/team/components/JoinInvites';
import type { TeamProfile, TeamRole } from '../../lib/api';

const roles: TeamRole[] = [
  {
    id: 'field',
    name: 'Field capture',
    entitlements: [
      'round.record',
      'harvest.record',
      'sample.record',
      'media.upload',
    ],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
  {
    id: 'stock',
    name: 'Stock keeping',
    entitlements: ['inventory.adjust', 'inventory.dehusk', 'input.manage'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
  {
    id: 'read',
    name: 'Read only',
    entitlements: ['farm.view', 'analytics.view'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
];
const profiles: TeamProfile[] = [
  {
    id: 'sys-profile-farm-helper',
    name: 'Farm helper',
    roleIds: ['field', 'stock', 'read'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
  {
    id: 'sys-profile-viewer',
    name: 'Viewer',
    roleIds: ['read'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
];

const meta = {
  title: 'Screens/SCR-030 Team access',
  component: InviteDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Invite helpers by email with a profile; they sign up with that email and tap Join. Profiles are made of roles; roles are sets of permissions. The preview shows exactly what someone will be able to do. You can only hand out permissions you hold yourself.',
      },
    },
  },
  args: {
    open: true,
    profiles,
    roles,
    saving: false,
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof InviteDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invite: Story = {};
export const DarkMode: Story = { globals: { theme: 'dark' } };
export const EditRole: Story = {
  render: () => (
    <RoleDialog
      open
      role={roles[0]}
      mine={
        new Set([
          'round.record',
          'harvest.record',
          'sample.record',
          'media.upload',
          'farm.view',
        ])
      }
      saving={false}
      onSave={() => undefined}
      onClose={() => undefined}
    />
  ),
};
export const EditProfile: Story = {
  render: () => (
    <ProfileDialog
      open
      profile={profiles[0]}
      roles={roles}
      saving={false}
      onSave={() => undefined}
      onClose={() => undefined}
    />
  ),
};
export const JoinPrompt: Story = {
  render: () => (
    <JoinInvites
      invites={[
        {
          tenantId: 't1',
          tenantName: 'Sagara Farm',
          invitedBy: 'owner@farm.lk',
          expiresAt: '2026-10-19',
        },
      ]}
      joining={null}
      onJoin={() => undefined}
      footer='Or set up your own farm below.'
    />
  ),
};
