'use client';

import { isAxiosError } from 'axios';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { LogoImageError, prepareLogo } from '@/lib/logo-image';
import { useCurrentGuild, useCurrentGuildStore } from '@/lib/store';

export function useGuildProfile() {
  const t = useTranslations('adminPage');
  const notify = useToast();
  const { guild } = useCurrentGuild();
  const setGuild = useCurrentGuildStore(s => s.setGuild);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);

  React.useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const startEditingName = () => {
    setNameDraft(guild?.name ?? '');
    setIsEditingName(true);
  };

  const cancelEditingName = () => setIsEditingName(false);

  const logoErrorMessage = (err: unknown) => {
    if (err instanceof LogoImageError) {
      if (err.code === 'invalid-type') return t('logoInvalidType');
      if (err.code === 'too-large') return t('logoTooLarge');
      return t('logoInvalid');
    }
    const status = isAxiosError(err) ? err.response?.status : undefined;
    if (status === 403) return t('logoPermissionDenied');
    if (status === 400) return t('logoInvalid');
    return t('logoUploadFailed');
  };

  const uploadLogo = async (file: File) => {
    if (!guild) return;
    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      const image = await prepareLogo(file);
      setLogoPreview(URL.createObjectURL(image));
      setGuild(await apiClient.uploadGuildLogo(guild.id, image));
    } catch (err) {
      setLogoError(logoErrorMessage(err));
    } finally {
      setIsUploadingLogo(false);
      setLogoPreview(null);
    }
  };

  const removeLogo = async () => {
    if (!guild) return;
    setLogoError(null);
    setIsRemovingLogo(true);
    try {
      setGuild(await apiClient.deleteGuildLogo(guild.id));
    } catch (err) {
      setLogoError(logoErrorMessage(err));
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!guild || !name) return;
    setIsSavingName(true);
    try {
      setGuild(await apiClient.updateGuild(guild.id, { name }));
      setIsEditingName(false);
      notify.success(t('guildNameSaved'));
    } catch {
      notify.error(t('guildNameFailed'));
    } finally {
      setIsSavingName(false);
    }
  };

  return {
    guild,
    isEditingName,
    nameDraft,
    setNameDraft,
    isSavingName,
    startEditingName,
    cancelEditingName,
    saveName,
    logoPreview,
    isUploadingLogo,
    isRemovingLogo,
    logoError,
    uploadLogo,
    removeLogo,
  };
}

export type GuildProfile = ReturnType<typeof useGuildProfile>;
