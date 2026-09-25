'use client';

import { Modal, useOverlayState } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import LotteryDetailContent from '@/components/LotteryDetailContent';

export default function LotteryModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const modalState = useOverlayState({
    defaultOpen: true,
    onOpenChange: (open) => { if (!open) router.back(); },
  });

  return (
    <Modal state={modalState}>
    <Modal.Backdrop>
      <Modal.Container size="lg">
        <Modal.Dialog className="w-full max-w-7xl">
          <Modal.CloseTrigger />
          <Modal.Body>
            <LotteryDetailContent id={id} onClose={() => router.back()} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
}
