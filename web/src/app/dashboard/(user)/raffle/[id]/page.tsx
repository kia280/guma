'use client';

import { use } from 'react';
import RaffleDetailContent from '@/components/RaffleDetailContent';

export default function RaffleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="max-w-7xl mx-auto">
      <RaffleDetailContent id={id} />
    </div>
  );
}
