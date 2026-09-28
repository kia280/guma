'use client';

import { Description, Label } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useUserName } from '@/hooks/useUserName';
import { isGuildRole } from '@/lib/permissions';
import type { MockUser } from '@/types/user';

export function MemberOptionLabel({ member }: { member: MockUser }) {
  const t = useTranslations('adminPage.roles');
  const userName = useUserName();
  return (
    <div className="flex min-w-0 flex-col">
      <Label className="truncate">{userName(member.username)}</Label>
      {isGuildRole(member.role) && <Description className="truncate">{t(member.role)}</Description>}
    </div>
  );
}
