'use client';

import { use } from 'react';
import RollCallDetailContent from '@/components/RollCallDetailContent';

export default function RollCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <RollCallDetailContent id={id} />
    </div>
  );
}
