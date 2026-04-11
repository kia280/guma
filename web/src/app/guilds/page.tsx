'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Card,
  Button,
  InputGroup,
  TextField,
  Label,
  Avatar,
  Chip,
  Spinner,
  Modal,
  useOverlayState,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { Guild, PaginatedResponse } from '@/types/api';
import { api } from '@/lib/api';

export default function GuildsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const createGuildState = useOverlayState();
  const t = useTranslations('guildsPage');

  const { data: currentGuild, isLoading: currentGuildLoading } = useQuery({
    queryKey: ['currentGuild'],
    queryFn: async () => {
      try {
        const response = await api.get<Guild>('/guilds/current');
        return response.data.data;
      } catch (error) {
        return null;
      }
    },
  });

  const {
    data: guildsData,
    isLoading: guildsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['guilds', searchQuery],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Guild>>('/guilds', {
        params: {
          search: searchQuery || undefined,
          limit: 20,
        },
      });
      return response.data.data;
    },
  });

  const isLoading = currentGuildLoading || guildsLoading;
  const guilds = guildsData?.data || [];
  const hasCurrentGuild = !!currentGuild;

  const handleJoinGuild = async (guildId: string) => {
    try {
      await api.post(`/guilds/${guildId}/join`);
      refetch();
    } catch (error) {
      console.error('Failed to join guild:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasCurrentGuild && !currentGuildLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="mb-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
              <Icon icon="solar:stars-linear" width={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-semibold mb-3 text-foreground">{t('welcomeTitle')}</h1>
            <p className="text-foreground/50 mb-1">{t('notJoined')}</p>
            <p className="text-foreground/40 text-sm">{t('createFirst')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 w-full">
            <Card className="border border-divider shadow-none bg-surface">
              <Card.Content className="text-center py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-3">
                  <Icon
                    icon="solar:users-group-rounded-linear"
                    width={20}
                    className="text-primary"
                  />
                </div>
                <h3 className="font-medium mb-1 text-sm">{t('buildCommunity')}</h3>
                <p className="text-xs text-foreground/50">{t('buildCommunityDesc')}</p>
              </Card.Content>
            </Card>

            <Card className="border border-divider shadow-none bg-surface">
              <Card.Content className="text-center py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 mx-auto mb-3">
                  <Icon icon="solar:settings-linear" width={20} className="text-success" />
                </div>
                <h3 className="font-medium mb-1 text-sm">{t('fullControl')}</h3>
                <p className="text-xs text-foreground/50">{t('fullControlDesc')}</p>
              </Card.Content>
            </Card>

            <Card className="border border-divider shadow-none bg-surface">
              <Card.Content className="text-center py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 mx-auto mb-3">
                  <Icon icon="solar:calendar-linear" width={20} className="text-secondary" />
                </div>
                <h3 className="font-medium mb-1 text-sm">{t('planEvents')}</h3>
                <p className="text-xs text-foreground/50">{t('planEventsDesc')}</p>
              </Card.Content>
            </Card>
          </div>

          <Button size="lg" variant="primary" onPress={createGuildState.open} className="mb-6">
            <Icon icon="solar:add-circle-linear" width={20} />
            {t('createFirstGuild')}
          </Button>

          <p className="text-foreground/40 text-sm">{t('exploreExisting')}</p>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-5 text-foreground">{t('exploreGuilds')}</h2>

          <div className="mb-5">
            <TextField className="max-w-md">
              <InputGroup>
                <InputGroup.Prefix>
                  <Icon icon="solar:magnifer-linear" width={16} className="text-foreground/40" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder={t('searchGuilds')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </TextField>
          </div>

          {guilds.length === 0 ? (
            <Card className="border border-divider shadow-none bg-surface">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:users-group-rounded-linear"
                  width={40}
                  className="text-foreground/30 mx-auto mb-3"
                />
                <h3 className="text-base font-medium mb-1">{t('noOtherGuilds')}</h3>
                <p className="text-sm text-foreground/50">
                  {searchQuery ? t('adjustSearch') : t('beFirst')}
                </p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guilds.map(guild => (
                <GuildCard key={guild.id} guild={guild} onJoin={() => handleJoinGuild(guild.id)} />
              ))}
            </div>
          )}
        </div>

        <CreateGuildModal
          state={createGuildState}
          onSuccess={() => {
            refetch();
            createGuildState.close();
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto border border-divider shadow-none">
          <Card.Content className="text-center py-8">
            <p className="text-danger mb-4">{t('failedToLoad')}</p>
            <Button onPress={() => refetch()} variant="secondary">
              {t('retry')}
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('guilds')}</h1>
          <p className="text-foreground/50 text-sm mt-1">{t('discoverGuilds')}</p>
        </div>

        <Button variant="primary" onPress={createGuildState.open}>
          <Icon icon="solar:add-circle-linear" width={16} />
          {t('createGuild')}
        </Button>
      </div>

      <div className="mb-5">
        <TextField className="max-w-md">
          <InputGroup>
            <InputGroup.Prefix>
              <Icon icon="solar:magnifer-linear" width={16} className="text-foreground/40" />
            </InputGroup.Prefix>
            <InputGroup.Input
              placeholder={t('searchGuilds')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </TextField>
      </div>

      {guilds.length === 0 ? (
        <Card className="max-w-md mx-auto border border-divider shadow-none">
          <Card.Content className="text-center py-12">
            <Icon
              icon="solar:users-group-rounded-linear"
              width={40}
              className="text-foreground/30 mx-auto mb-3"
            />
            <h3 className="text-base font-medium mb-1">{t('noGuildsFound')}</h3>
            <p className="text-sm text-foreground/50">
              {searchQuery ? t('adjustSearch') : t('beFirstCreate')}
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guilds.map(guild => (
            <GuildCard key={guild.id} guild={guild} onJoin={() => handleJoinGuild(guild.id)} />
          ))}
        </div>
      )}

      <CreateGuildModal
        state={createGuildState}
        onSuccess={() => {
          refetch();
          createGuildState.close();
        }}
      />
    </div>
  );
}

interface GuildCardProps {
  guild: Guild;
  onJoin: () => void;
  isUserMember?: boolean;
}

function GuildCard({ guild, onJoin, isUserMember = false }: GuildCardProps) {
  const t = useTranslations('guildsPage');

  return (
    <Card className="border border-divider shadow-none bg-surface hover:border-default-400 transition-colors">
      <Card.Header className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="flex-shrink-0" size="md">
            <Avatar.Image src={guild.icon} />
            <Avatar.Fallback>{guild.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate text-foreground">{guild.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-foreground/50 mt-0.5">
              <Icon icon="solar:users-group-rounded-linear" width={14} />
              <span>
                {guild.memberCount} {t('members')}
              </span>
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="pt-0">
        {guild.description && (
          <p className="text-foreground/50 text-sm mb-4 line-clamp-2">{guild.description}</p>
        )}

        <div className="flex flex-wrap gap-1 mb-4">
          {guild.settings.features.economy && (
            <Chip size="sm" variant="secondary">
              {t('economy')}
            </Chip>
          )}
          {guild.settings.features.events && (
            <Chip size="sm" variant="secondary">
              {t('events')}
            </Chip>
          )}
          {guild.settings.features.raids && (
            <Chip size="sm" variant="secondary">
              {t('raids')}
            </Chip>
          )}
        </div>

        <div className="flex gap-2">
          {isUserMember ? (
            <Button variant="secondary" className="flex-1">
              <Icon icon="solar:settings-linear" width={16} />
              {t('manage')}
            </Button>
          ) : (
            <Button variant="primary" className="flex-1" onPress={onJoin}>
              {t('joinGuild')}
            </Button>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

interface CreateGuildModalProps {
  state: UseOverlayStateReturn;
  onSuccess: () => void;
}

function CreateGuildModal({ state, onSuccess }: CreateGuildModalProps) {
  const t = useTranslations('guildsPage');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      setIsLoading(true);
      await api.post('/guilds', {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setName('');
      setDescription('');
      onSuccess();
    } catch (error) {
      console.error('Failed to create guild:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal state={state}>
    <Modal.Backdrop>
      <Modal.Container size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header className="text-center items-center">
            <Modal.Heading>{t('createNewGuild')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <TextField isRequired>
              <Label>{t('guildName')}</Label>
              <InputGroup>
                <InputGroup.Input
                  placeholder={t('guildNamePlaceholder')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </InputGroup>
            </TextField>
            <TextField>
              <Label>{t('descriptionLabel')}</Label>
              <InputGroup>
                <InputGroup.Input
                  placeholder={t('descriptionPlaceholder')}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </InputGroup>
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" slot="close">
              {t('cancel')}
            </Button>
            <Button variant="primary" onPress={handleSubmit} isPending={isLoading} isDisabled={!name.trim()}>
              {t('createGuild')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
}
