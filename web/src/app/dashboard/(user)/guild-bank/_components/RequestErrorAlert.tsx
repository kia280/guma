import { Alert } from '@heroui/react';
import React from 'react';

export function RequestErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{error}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
