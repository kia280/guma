'use client';

import { Alert, AlertDialog, Button, Card, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';

export const templateErrorKey = (err: unknown) => {
  switch (apiErrorCode(err)) {
    case GrpcCode.AlreadyExists:
      return 'errorNameTaken';
    case GrpcCode.PermissionDenied:
      return 'errorForbidden';
    case GrpcCode.NotFound:
      return 'errorNotFound';
    case GrpcCode.InvalidArgument:
      return 'errorInvalid';
    default:
      return 'errorGeneric';
  }
};

export const sortByName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export function useTemplateList<T extends { id: string; name: string }>(load: () => Promise<T[]>) {
  const [items, setItems] = React.useState<T[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const latestLoad = React.useRef(0);

  const reload = React.useCallback(async () => {
    const loadId = ++latestLoad.current;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const list = await load();
      if (loadId === latestLoad.current) setItems(list);
    } catch {
      if (loadId === latestLoad.current) setLoadFailed(true);
    } finally {
      if (loadId === latestLoad.current) setIsLoading(false);
    }
  }, [load]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const upsert = (item: T) =>
    setItems(prev => sortByName(prev.some(i => i.id === item.id) ? prev.map(i => (i.id === item.id ? item : i)) : [...prev, item]));
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  return { items, isLoading, loadFailed, reload, upsert, remove };
}

interface TemplateListStateProps {
  isLoading: boolean;
  loadFailed: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
  children: React.ReactNode;
}

export function TemplateListState({
  isLoading,
  loadFailed,
  isEmpty,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyHint,
  children,
}: TemplateListStateProps) {
  const t = useTranslations('templates');
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t('loading')} />
      </div>
    );
  }
  if (loadFailed) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('loadFailed')}</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={onRetry}>
          {t('retry')}
        </Button>
      </Alert>
    );
  }
  if (isEmpty) {
    return (
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Content>
          <EmptyContent icon={emptyIcon} title={emptyTitle} description={emptyHint} />
        </Card.Content>
      </Card>
    );
  }
  return <>{children}</>;
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

interface DeleteTemplateDialogProps {
  target: { id: string; name: string } | null;
  description: string;
  onDelete: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

export function DeleteTemplateDialog({ target, description, onDelete, onDeleted, onClose }: DeleteTemplateDialogProps) {
  const t = useTranslations('templates');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!target) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(target.id);
      onDeleted(target.id);
      close();
    } catch (err) {
      if (apiErrorCode(err) === GrpcCode.NotFound) {
        onDeleted(target.id);
        close();
        return;
      }
      setError(t(apiErrorCode(err) === GrpcCode.PermissionDenied ? 'errorForbidden' : 'errorGeneric'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={target !== null}
      onOpenChange={isOpen => {
        if (!isOpen && !isDeleting) close();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('deleteTitle', { name: target?.name ?? '' })}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p className="type-body text-subtle">{description}</p>
            <ErrorAlert message={error} />
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isDeleting}>
              {t('cancel')}
            </Button>
            <Button variant="danger" isPending={isDeleting} onPress={handleDelete}>
              {t('delete')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
