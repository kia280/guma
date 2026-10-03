'use client';

import React from 'react';

type TransferStep = 'form' | 'confirm';

type TransferFormState = {
  amount: string;
  recipient: string;
  showErrors: boolean;
  step: TransferStep;
  error: string | null;
};

type TransferFormEvent =
  | { type: 'opened' }
  | { type: 'amountChanged'; amount: string }
  | { type: 'recipientChanged'; recipient: string }
  | { type: 'invalidSubmitted' }
  | { type: 'reviewed' }
  | { type: 'backToForm' }
  | { type: 'submitted' }
  | { type: 'succeeded' }
  | { type: 'failed'; error: string };

const initialState: TransferFormState = {
  amount: '',
  recipient: '',
  showErrors: false,
  step: 'form',
  error: null,
};

function transferFormReducer(state: TransferFormState, event: TransferFormEvent): TransferFormState {
  switch (event.type) {
    case 'opened':
      return { ...state, showErrors: false, step: 'form', error: null };
    case 'amountChanged':
      return { ...state, amount: event.amount };
    case 'recipientChanged':
      return { ...state, recipient: event.recipient };
    case 'invalidSubmitted':
      return { ...state, showErrors: true };
    case 'reviewed':
      return { ...state, error: null, step: 'confirm' };
    case 'backToForm':
      return { ...state, step: 'form' };
    case 'submitted':
      return { ...state, error: null };
    case 'succeeded':
      return { ...state, amount: '', recipient: '', step: 'form' };
    case 'failed':
      return { ...state, error: event.error };
  }
}

export function useTransferForm() {
  return React.useReducer(transferFormReducer, initialState);
}
