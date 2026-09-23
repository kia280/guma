'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, useOverlayState } from '@heroui/react';
import AuctionDetailContent from '@/components/AuctionDetailContent';

export default function AuctionModalPage({ params }: { params: Promise<{ id: string }> }) {
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
        <Modal.Dialog className="max-w-6xl">
          <Modal.CloseTrigger />
          <Modal.Body>
            <AuctionDetailContent id={id} onClose={() => router.back()} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
}
