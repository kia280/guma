'use client';

import { Modal, Spinner, type UseOverlayStateReturn } from '@heroui/react';
import React from 'react';
import { ActionSuccess } from '@/components/ActionSuccess';
import type { WalletActionHandle } from '../_hooks/useWalletAction';

type WalletActionModalProps = {
  state: UseOverlayStateReturn;
  action: WalletActionHandle;
  successTitle: string;
  children: React.ReactNode;
};

export function WalletActionModal({ state, action, successTitle, children }: WalletActionModalProps) {
  const { isPending, completed } = action;
  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable={!isPending} isKeyboardDismissDisabled={isPending}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={isPending} />
            {completed ? <ActionSuccess title={successTitle} detail={completed.detail} /> : children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function PendingLabel({ isPending, children }: { isPending: boolean; children: React.ReactNode }) {
  return (
    <>
      {isPending && <Spinner color="current" size="sm" />}
      {children}
    </>
  );
}
