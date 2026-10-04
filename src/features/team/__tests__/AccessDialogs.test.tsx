import { fireEvent, render, screen } from '@testing-library/react';
import type { TeamProfile, TeamRole } from '@/lib/api';
import {
  InviteDialog,
  ProfileDialog,
  RoleDialog,
} from '../components/AccessDialogs';
import { JoinInvites } from '../components/JoinInvites';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const roles: TeamRole[] = [
  {
    id: 'field',
    name: 'Field capture',
    entitlements: ['round.record', 'harvest.record'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
  {
    id: 'read',
    name: 'Read only',
    entitlements: ['farm.view'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
];
const profiles: TeamProfile[] = [
  {
    id: 'sys-profile-farm-helper',
    name: 'Farm helper',
    roleIds: ['field', 'read'],
    isSystem: true,
    status: 'ACTIVE',
    version: 0,
  },
];
const save = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

describe('InviteDialog (#37)', () => {
  it('defaults to Farm helper, previews what they can do, validates the email', () => {
    const onSave = jest.fn();
    render(
      <InviteDialog
        open
        profiles={profiles}
        roles={roles}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('entitlement.round.record')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/invite.email/), {
      target: { value: 'nope' },
    });
    save('invite.save');
    expect(screen.getByText('invite.invalidEmail')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/invite.email/), {
      target: { value: 'helper@farm.lk' },
    });
    save('invite.save');
    expect(onSave).toHaveBeenCalledWith(
      'helper@farm.lk',
      'sys-profile-farm-helper'
    );
  });
});

describe('RoleDialog (#121)', () => {
  it('only offers entitlements the user holds; saves the checklist', () => {
    const onSave = jest.fn();
    render(
      <RoleDialog
        open
        mine={new Set(['farm.view', 'round.record'])}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/roleDialog.name/), {
      target: { value: 'Harvest only' },
    });
    expect(
      screen.getByRole('checkbox', { name: /entitlement.member.manage/ })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /entitlement.round.record/ })
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: /entitlement.farm.view/ })
    );
    save('roleDialog.save');
    expect(onSave).toHaveBeenCalledWith({
      name: 'Harvest only',
      entitlements: ['farm.view', 'round.record'],
      status: 'ACTIVE',
    });
  });
});

describe('ProfileDialog (#121)', () => {
  it('previews the combined permissions of the chosen roles', () => {
    const onSave = jest.fn();
    render(
      <ProfileDialog
        open
        roles={roles}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('profileDialog.nothing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Field capture' }));
    expect(screen.getByText('entitlement.harvest.record')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/profileDialog.name/), {
      target: { value: 'Pluck helper' },
    });
    save('profileDialog.save');
    expect(onSave).toHaveBeenCalledWith({
      name: 'Pluck helper',
      roleIds: ['field'],
      status: 'ACTIVE',
    });
  });

  it('the Owner profile cannot be archived', () => {
    render(
      <ProfileDialog
        open
        profile={{
          id: 'sys-profile-owner',
          name: 'Owner',
          roleIds: [],
          isSystem: true,
          status: 'ACTIVE',
          version: 0,
        }}
        roles={roles}
        saving={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(
      screen.getByText('profileDialog.ownerProtected')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'profileDialog.archive' })
    ).not.toBeInTheDocument();
  });
});

describe('JoinInvites (#37)', () => {
  it('lists invites with a Join button', () => {
    const onJoin = jest.fn();
    render(
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
        onJoin={onJoin}
      />
    );
    save('join.join');
    expect(onJoin).toHaveBeenCalledWith('t1');
  });
});
