'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import CheckinDetailContent from '@/components/CheckinDetailContent';
import DetailRouteModal from '@/components/DetailRouteModal';

export default function CheckinModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('checkinDetailPage');

  return (
    <DetailRouteModal label={t('dialogLabel')} className="max-w-4xl">
      {(close) => <CheckinDetailContent id={id} onClose={close} />}
    </DetailRouteModal>
  );
}
