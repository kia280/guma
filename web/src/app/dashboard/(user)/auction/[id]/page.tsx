'use client';

import { use } from 'react';
import AuctionDetailContent from '@/components/AuctionDetailContent';

export default function AuctionItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <AuctionDetailContent id={id} />
    </div>
  );
}
