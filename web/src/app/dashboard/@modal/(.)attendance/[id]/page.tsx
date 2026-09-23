'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, useOverlayState } from '@heroui/react';
import CheckinDetailContent from '@/components/CheckinDetailContent';

export default function CheckinModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const modalState = useOverlayState({
    defaultOpen: true,
    onOpenChange: (open) => { if (!open) router.back(); },
  });

  return (
    <Modal state={modalState}>
    <Modal.Backdrop>
      <Modal.Container size="cover" scroll="outside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Body>
            <CheckinDetailContent id={id} onClose={() => router.back()} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
}
