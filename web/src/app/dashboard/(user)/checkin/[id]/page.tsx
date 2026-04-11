'use client';

import { use } from 'react';
import CheckinDetailContent from '@/components/CheckinDetailContent';

export default function CheckinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <CheckinDetailContent id={id} />
    </div>
  );
}
