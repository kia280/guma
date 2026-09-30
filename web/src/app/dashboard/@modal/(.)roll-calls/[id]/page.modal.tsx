'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import DetailRouteModal from '@/components/DetailRouteModal';
import RollCallDetailContent from '@/components/RollCallDetailContent';

export default function RollCallModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('rollCallDetailPage');

  return (
    <DetailRouteModal label={t('dialogLabel')} className="max-w-4xl">
      {(close) => <RollCallDetailContent id={id} onClose={close} />}
    </DetailRouteModal>
  );
}
