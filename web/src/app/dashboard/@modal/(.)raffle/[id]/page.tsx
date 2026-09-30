'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import DetailRouteModal from '@/components/DetailRouteModal';
import RaffleDetailContent from '@/components/RaffleDetailContent';

export default function RaffleModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('raffleDetail');

  return (
    <DetailRouteModal label={t('dialogLabel')} className="max-w-7xl">
      {(close) => <RaffleDetailContent id={id} onClose={close} />}
    </DetailRouteModal>
  );
}
