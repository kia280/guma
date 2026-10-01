'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import AuctionDetailContent from '@/components/AuctionDetailContent';
import DetailRouteModal from '@/components/DetailRouteModal';

export default function AuctionModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('auctionItemPage');

  return (
    <DetailRouteModal label={t('dialogLabel')} className="max-w-4xl">
      {(close) => <AuctionDetailContent id={id} onClose={close} />}
    </DetailRouteModal>
  );
}
