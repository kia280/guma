'use client';

import { Modal, useOverlayState } from '@heroui/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

interface DetailRouteModalProps {
  label: string;
  className?: string;
  children: (close: () => void) => ReactNode;
}

export default function DetailRouteModal({ label, className, children }: DetailRouteModalProps) {
  const router = useRouter();
  const close = () => router.back();

  const modalState = useOverlayState({
    defaultOpen: true,
    onOpenChange: (open) => { if (!open) close(); },
  });

  return (
    <Modal state={modalState}>
      <Modal.Backdrop>
        <Modal.Container className="sm:w-full">
          <Modal.Dialog aria-label={label} className={className}>
            <Modal.CloseTrigger />
            <Modal.Body>{children(close)}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
