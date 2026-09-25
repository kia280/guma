'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import DetailRouteModal from '@/components/DetailRouteModal';
import LotteryDetailContent from '@/components/LotteryDetailContent';

export default function LotteryModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('lotteryDetail');

  return (
    <DetailRouteModal label={t('dialogLabel')} className="max-w-7xl">
      {(close) => <LotteryDetailContent id={id} onClose={close} />}
    </DetailRouteModal>
  );
}
