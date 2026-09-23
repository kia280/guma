'use client';

import { Avatar, Button, Chip, Input, Label, SearchField, Spinner, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDevUser,
  devLoginAs,
  devLogout,
  getDevSession,
  listDevUsers,
  type DevUser,
} from '@/lib/dev-auth';

const AFTER_LOGIN_PATH = '/dashboard';

function initials(user: DevUser): string {
  const source = user.displayName || user.username || user.email;
  return source.slice(0, 2).toUpperCase();
}

export function DevAuthPanel() {
  const t = useTranslations('devTools');
  const [current, setCurrent] = useState<DevUser | null>(null);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [session, list] = await Promise.all([getDevSession(), listDevUsers()]);
      setCurrent(session);
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.displayName, u.username, u.email, u.id].some((v) => v.toLowerCase().includes(q)),
    );
  }, [users, query]);

  const run = async (key: string, action: () => Promise<void>) => {
    setPendingAction(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPendingAction(null);
    }
  };

  const loginAs = (user: DevUser) =>
    run(`login:${user.id}`, async () => {
      await devLoginAs(user.id);
      window.location.assign(AFTER_LOGIN_PATH);
    });

  const createAndLogin = () =>
    run('create', async () => {
      await createDevUser(newName, true);
      window.location.assign(AFTER_LOGIN_PATH);
    });

  const logout = () =>
    run('logout', async () => {
      await devLogout();
      window.location.assign('/login');
    });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-foreground">
      <section className="flex items-center justify-between gap-3 rounded-xl border border-divider bg-surface p-3">
        <div className="flex min-w-0 items-center gap-3">
          {current ? (
            <>
              <Avatar size="sm">
                {current.avatarUrl && <Avatar.Image alt={current.displayName} src={current.avatarUrl} />}
                <Avatar.Fallback>{initials(current)}</Avatar.Fallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs text-foreground/50">{t('currentUser')}</p>
                <p className="truncate text-sm font-medium">{current.displayName || current.username}</p>
                <p className="truncate text-xs text-foreground/40">{current.email}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-foreground/50">{t('noDevSession')}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="tertiary" isIconOnly aria-label={t('refresh')} onPress={() => void refresh()}>
            <Icon icon="solar:refresh-linear" width={16} />
          </Button>
          {current && (
            <Button size="sm" variant="danger" isPending={pendingAction === 'logout'} onPress={() => void logout()}>
              {t('logout')}
            </Button>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {t('error', { message: error })}
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-divider bg-surface p-3">
        <h3 className="text-sm font-medium text-foreground/60">{t('createUser')}</h3>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createAndLogin();
          }}
        >
          <TextField className="flex-1" value={newName} onChange={setNewName}>
            <Label>{t('displayName')}</Label>
            <Input placeholder={t('displayNamePlaceholder')} />
          </TextField>
          <Button type="submit" size="sm" isPending={pendingAction === 'create'}>
            {t('createAndLogin')}
          </Button>
        </form>
      </section>

      <section className="flex min-h-0 flex-col gap-2 rounded-xl border border-divider bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground/60">{t('loginAs')}</h3>
          <Chip size="sm">{t('userCount', { count: users.length })}</Chip>
        </div>
        <SearchField value={query} onChange={setQuery} aria-label={t('search')}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('search')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/30">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((user) => {
              const isCurrent = current?.id === user.id;
              return (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="sm">
                      {user.avatarUrl && <Avatar.Image alt={user.displayName} src={user.avatarUrl} />}
                      <Avatar.Fallback>{initials(user)}</Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.displayName || user.username}</p>
                      <p className="truncate text-xs text-foreground/40">{user.email}</p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <Chip size="sm" color="success">
                      {t('active')}
                    </Chip>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      isPending={pendingAction === `login:${user.id}`}
                      isDisabled={pendingAction !== null}
                      onPress={() => void loginAs(user)}
                    >
                      {t('login')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
