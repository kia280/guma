'use client';

import { use } from 'react';
import LotteryDetailContent from '@/components/LotteryDetailContent';

export default function LotteryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="max-w-7xl mx-auto">
      <LotteryDetailContent id={id} />
    </div>
  );
}
