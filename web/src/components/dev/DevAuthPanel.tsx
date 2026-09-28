'use client';

import {
  Button,
  Chip,
  Description,
  Input,
  Label,
  NumberField,
  SearchField,
  Spinner,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import {
  createDevUser,
  devLoginAs,
  devLogout,
  getDevSession,
  listDevUsers,
  seedDevMembers,
  type DevGuild,
  type DevUser,
} from '@/lib/dev-auth';
import {
  DEV_MOCK_ROLES,
  getDevMockRole,
  isDevMockEnabled,
  setDevMockEnabled,
  setDevMockRole,
  type DevMockRole,
} from '@/lib/dev-mock';
import { env } from '@/lib/env';
import { roleChipColor } from '@/lib/permissions';

const AFTER_LOGIN_PATH = '/dashboard';
const DEFAULT_SEED_COUNT = 20;
const MAX_SEED_COUNT = 200;
const ROLES = ['owner', 'admin', 'moderator', 'member'] as const;

function avatarName(user: DevUser): string {
  return user.displayName || user.username || user.email;
}

export function DevAuthPanel() {
  const t = useTranslations('devTools');
  const [current, setCurrent] = useState<DevUser | null>(null);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [guild, setGuild] = useState<DevGuild | null>(null);
  const [seedCount, setSeedCount] = useState(DEFAULT_SEED_COUNT);
  const [seedResult, setSeedResult] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMock] = useState(() => env.useMock || isDevMockEnabled());
  const [mockRole] = useState(getDevMockRole);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [session, list] = await Promise.all([getDevSession(), listDevUsers()]);
      setCurrent(session);
      setGuild(list.guild);
      setUsers(list.users);
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

  const seedMembers = async () => {
    setPendingAction('seed');
    setError(null);
    setSeedResult(null);
    try {
      const { users: seeded } = await seedDevMembers(seedCount);
      setSeedResult(seeded.length);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(null);
    }
  };

  const roleLabel = (role: string) =>
    (ROLES as readonly string[]).includes(role) ? t(`roles.${role as (typeof ROLES)[number]}`) : role;

  const toggleMock = (enabled: boolean) => {
    setDevMockEnabled(enabled);
    window.location.reload();
  };

  const changeMockRole = (keys: Set<Key>) => {
    const [role] = [...keys];
    if (role === undefined || role === mockRole) return;
    setDevMockRole(role as DevMockRole);
    window.location.reload();
  };

  const logout = () =>
    run('logout', async () => {
      await devLogout();
      window.location.assign('/login');
    });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-foreground">
      <section className="rounded-xl border border-divider bg-surface p-3">
        <Switch isSelected={isMock} isDisabled={env.useMock} onChange={toggleMock}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label className="type-body">{t('mockData')}</Label>
          </Switch.Content>
          <Description>{env.useMock ? t('mockDataForcedByEnv') : t('mockDataDescription')}</Description>
        </Switch>
        {isMock && (
          <div className="mt-3 flex flex-col gap-2 border-t border-divider pt-3">
            <div>
              <p id="dev-mock-role-label" className="type-body">{t('mockRole')}</p>
              <p className="type-caption text-hint">{t('mockRoleDescription')}</p>
            </div>
            <ToggleButtonGroup
              aria-labelledby="dev-mock-role-label"
              size="sm"
              fullWidth
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[mockRole]}
              onSelectionChange={changeMockRole}
            >
              {DEV_MOCK_ROLES.map((role, index) => (
                <ToggleButton key={role} id={role}>
                  {index > 0 && <ToggleButtonGroup.Separator />}
                  {roleLabel(role)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        )}
      </section>

      <section className="flex items-center justify-between gap-3 rounded-xl border border-divider bg-surface p-3">
        <div className="flex min-w-0 items-center gap-3">
          {current ? (
            <>
              <UserAvatar name={avatarName(current)} src={current.avatarUrl} />
              <div className="min-w-0">
                <p className="type-caption text-subtle">{t('currentUser')}</p>
                <p className="truncate type-body font-medium">{current.displayName || current.username}</p>
                <p className="truncate type-caption text-hint">{current.email}</p>
              </div>
            </>
          ) : (
            <p className="type-body text-subtle">{t('noDevSession')}</p>
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
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 type-body text-danger">
          {t('error', { message: error })}
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-divider bg-surface p-3">
        <h3 className="type-subheading text-soft">{t('createUser')}</h3>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createAndLogin();
          }}
        >
          <TextField className="min-w-0 flex-1" value={newName} onChange={setNewName}>
            <Label>{t('displayName')}</Label>
            <Input className="min-w-0" placeholder={t('displayNamePlaceholder')} />
          </TextField>
          <Button type="submit" size="sm" isPending={pendingAction === 'create'}>
            {t('createAndLogin')}
          </Button>
        </form>
      </section>

      {guild && (
        <section className="flex flex-col gap-2 rounded-xl border border-divider bg-surface p-3">
          <h3 className="type-subheading text-soft">{t('seedMembers')}</h3>
          <p className="type-caption text-hint">{t('seedDescription', { guild: guild.name })}</p>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void seedMembers();
            }}
          >
            <NumberField
              className="min-w-0 flex-1"
              minValue={1}
              maxValue={MAX_SEED_COUNT}
              value={seedCount}
              onChange={(value) => setSeedCount(Number.isFinite(value) ? value : 1)}
            >
              <Label>{t('seedCount')}</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input className="w-full min-w-0" />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              isPending={pendingAction === 'seed'}
              isDisabled={pendingAction !== null && pendingAction !== 'seed'}
            >
              <Icon icon="solar:users-group-rounded-linear" width={16} />
              {t('seed')}
            </Button>
          </form>
          {seedResult !== null && (
            <p role="status" className="type-caption text-success">
              {t('seeded', { count: seedResult })}
            </p>
          )}
        </section>
      )}

      <section className="flex shrink-0 flex-col gap-2 rounded-xl border border-divider bg-surface p-3">
        <div className="flex items-center justify-between gap-2 type-body">
          <div className="min-w-0">
            <h3 className="type-subheading text-soft">{t('loginAs')}</h3>
            <p className="truncate type-caption text-hint">
              {guild ? t('guildMembers', { guild: guild.name }) : t('allUsers')}
            </p>
          </div>
          <Chip size="sm">{t('userCount', { count: users.length })}</Chip>
        </div>
        <SearchField className="min-w-0" variant="secondary" value={query} onChange={setQuery} aria-label={t('search')}>
          <SearchField.Group className="min-w-0">
            <SearchField.SearchIcon />
            <SearchField.Input className="min-w-0" placeholder={t('search')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center type-body text-disabled">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((user) => {
              const isCurrent = current?.id === user.id;
              return (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary px-3 py-2 type-body"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={avatarName(user)} src={user.avatarUrl} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate font-medium">{user.displayName || user.username}</p>
                        {user.role && user.role !== 'member' && (
                          <Chip size="sm" variant="secondary" color={roleChipColor(user.role)} className="shrink-0">
                            {roleLabel(user.role)}
                          </Chip>
                        )}
                      </div>
                      <p className="truncate type-caption text-hint">{user.email}</p>
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
