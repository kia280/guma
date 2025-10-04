'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Avatar,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UsersIcon,
  CalendarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { Guild, PaginatedResponse } from '@/types/api';
import { api } from '@/lib/api';
// import { useAuth } from '@/lib/auth/auth-context';

export default function GuildsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, hasPermission } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const t = useTranslations();

  // Fetch guilds
  const {
    data: guildsData,
    isLoading,
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
    // enabled: !!user,
  });

  const guilds = guildsData?.data || [];

  // Handle join guild
  const handleJoinGuild = async (guildId: string) => {
    try {
      await api.post(`/guilds/${guildId}/join`);
      refetch();
    } catch (error) {
      console.error('Failed to join guild:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardBody className="text-center">
            <p className="text-danger">Failed to load guilds</p>
            <Button onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Guilds</h1>
          <p className="text-foreground-600 mt-1">
            Discover and join guilds in your community
          </p>
        </div>

        {hasPermission('guild.create') && (
          <Button
            color="primary"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={onOpen}
          >
            Create Guild
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search guilds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          startContent={<MagnifyingGlassIcon className="w-4 h-4 text-foreground-400" />}
          className="max-w-md"
        />
      </div>

      {/* Guilds Grid */}
      {guilds.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardBody className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-foreground-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No guilds found</h3>
            <p className="text-foreground-600">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Be the first to create a guild!'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guilds.map((guild) => (
            <GuildCard
              key={guild.id}
              guild={guild}
              onJoin={() => handleJoinGuild(guild.id)}
              // isUserMember={user?.guilds.some(g => g.id === guild.id)}
            />
          ))}
        </div>
      )}

      {/* Create Guild Modal */}
      <CreateGuildModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onSuccess={() => {
          refetch();
          onOpenChange();
        }}
      />
    </div>
  );
}

// Guild Card Component
interface GuildCardProps {
  guild: Guild;
  onJoin: () => void;
  isUserMember?: boolean;
}

function GuildCard({ guild, onJoin, isUserMember = false }: GuildCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={guild.icon}
            name={guild.name}
            size="lg"
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{guild.name}</h3>
            <div className="flex items-center gap-2 text-small text-foreground-600">
              <UsersIcon className="w-4 h-4" />
              <span>{guild.memberCount} members</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        {guild.description && (
          <p className="text-foreground-700 text-small mb-4 line-clamp-3">
            {guild.description}
          </p>
        )}

        {/* Features */}
        <div className="flex flex-wrap gap-1 mb-4">
          {guild.settings.features.economy && (
            <Chip size="sm" variant="flat" color="primary">
              Economy
            </Chip>
          )}
          {guild.settings.features.events && (
            <Chip size="sm" variant="flat" color="secondary">
              Events
            </Chip>
          )}
          {guild.settings.features.raids && (
            <Chip size="sm" variant="flat" color="success">
              Raids
            </Chip>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isUserMember ? (
            <Button
              variant="flat"
              color="success"
              className="flex-1"
              startContent={<CogIcon className="w-4 h-4" />}
            >
              Manage
            </Button>
          ) : (
            <Button
              color="primary"
              className="flex-1"
              onPress={onJoin}
            >
              Join Guild
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Create Guild Modal Component
interface CreateGuildModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onSuccess: () => void;
}

function CreateGuildModal({ isOpen, onOpenChange, onSuccess }: CreateGuildModalProps) {
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
      
      // Reset form
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Create New Guild
            </ModalHeader>
            <ModalBody>
              <Input
                label="Guild Name"
                placeholder="Enter guild name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                isRequired
              />
              <Input
                label="Description"
                placeholder="Enter guild description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isLoading}
                isDisabled={!name.trim()}
              >
                Create Guild
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}