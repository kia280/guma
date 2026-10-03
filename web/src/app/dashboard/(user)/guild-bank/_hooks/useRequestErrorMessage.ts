'use client';

import { useTranslations } from 'next-intl';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';

export function useRequestErrorMessage() {
  const t = useTranslations('guildBankPage');
  return (err: unknown) => {
    switch (apiErrorCode(err)) {
      case GrpcCode.FailedPrecondition:
        return t('errorExceedsBalance');
      case GrpcCode.AlreadyExists:
        return t('errorDuplicateItemRequest');
      case GrpcCode.NotFound:
        return t('errorItemUnavailable');
      case GrpcCode.PermissionDenied:
        return t('errorNotMember');
      default:
        return t('errorGeneric');
    }
  };
}
