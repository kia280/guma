'use client';

import { Description, Label, ListBox, Select, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { apiErrorCode, GrpcCode } from '@/lib/guma/errors';
import {
  ASSIGNABLE_ROLES,
  isAssignableRole,
  isGuildRole,
  roleChangeBlock,
  roleChangeNeedsConfirmation,
  useGuildPermissions,
  type AssignableRole,
  type GuildRole,
} from '@/lib/permissions';
import { useUserStore } from '@/lib/store';
import type { MockUser } from '@/types/user';
import { ConfirmDialog } from './ConfirmDialog';

type RoleConfirmation = { from: GuildRole; to: AssignableRole };

type MemberRoleFieldProps = {
  member: MockUser;
  onChanged: (member: MockUser) => void;
  onStale: () => void;
};

export function MemberRoleField({ member, onChanged, onStale }: MemberRoleFieldProps) {
  const t = useTranslations('memberRole');
  const roleLabels = useTranslations('adminPage.roles');
  const userName = useUserName();
  const notify = useToast();
  const guildId = useCurrentGuildId();
  const { role: actorRole } = useGuildPermissions();
  const currentUserId = useUserStore(state => state.user?.id);

  const [savingRole, setSavingRole] = React.useState<AssignableRole | null>(null);
  const [confirmation, setConfirmation] = React.useState<RoleConfirmation | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [shownFor, setShownFor] = React.useState(member.id);

  if (shownFor !== member.id) {
    setShownFor(member.id);
    setIsConfirming(false);
    setFailure(null);
  }

  const currentRole: GuildRole | null = isGuildRole(member.role) ? member.role : null;
  const block = roleChangeBlock(actorRole, member.role, member.id === currentUserId);
  if (block === 'notAllowed' || !currentRole) return null;

  const name = userName(member.username);
  const options: readonly GuildRole[] = block ? [currentRole] : ASSIGNABLE_ROLES;
  const isSaving = savingRole !== null;

  const failureMessage = (err: unknown) => {
    const code = apiErrorCode(err);
    if (code === GrpcCode.PermissionDenied) return t('denied');
    if (code === GrpcCode.NotFound) return t('memberGone');
    return t('failed');
  };

  const apply = async (role: AssignableRole) => {
    setFailure(null);
    setSavingRole(role);
    try {
      const updated = await apiClient.updateMemberRole(guildId, member.id, role);
      onChanged({ ...member, role: updated.role ?? role });
      notify.success(t('changed', { name, role: roleLabels(role) }));
    } catch (err) {
      setFailure(failureMessage(err));
      const code = apiErrorCode(err);
      if (code === GrpcCode.PermissionDenied || code === GrpcCode.NotFound) onStale();
      throw err;
    } finally {
      setSavingRole(null);
    }
  };

  const select = (key: React.Key | null) => {
    const next = String(key ?? '');
    if (!isAssignableRole(next) || next === currentRole || isSaving) return;
    if (roleChangeNeedsConfirmation(currentRole, next)) {
      setFailure(null);
      setConfirmation({ from: currentRole, to: next });
      setIsConfirming(true);
      return;
    }
    apply(next).catch(() => {});
  };

  const isPromotion = confirmation?.to === 'admin';

  return (
    <>
      <Select
        value={savingRole ?? currentRole}
        onChange={select}
        isDisabled={Boolean(block) || isSaving}
        variant="secondary"
        className="w-full sm:max-w-xs"
      >
        <Label className="flex items-center gap-2">
          {t('label')}
          {isSaving && <Spinner size="sm" aria-label={t('saving')} />}
        </Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map(role => (
              <ListBox.Item key={role} id={role} textValue={roleLabels(role)}>
                {roleLabels(role)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <Description>{block ? t(`blocked.${block}`) : t('hint')}</Description>
      </Select>
      {failure && !isConfirming && (
        <p role="alert" className="type-caption text-danger">
          {failure}
        </p>
      )}
      <ConfirmDialog
        heading={t(isPromotion ? 'confirmPromoteTitle' : 'confirmDemoteTitle')}
        body={
          confirmation
            ? t(isPromotion ? 'confirmPromoteBody' : 'confirmDemoteBody', {
                name,
                from: roleLabels(confirmation.from),
                to: roleLabels(confirmation.to),
              })
            : ''
        }
        confirmLabel={t('confirm')}
        failedMessage={failure ?? t('failed')}
        status="warning"
        isOpen={isConfirming}
        onOpenChange={open => {
          if (!open) {
            setIsConfirming(false);
            setFailure(null);
          }
        }}
        onConfirm={() => (confirmation ? apply(confirmation.to) : undefined)}
      />
    </>
  );
}
