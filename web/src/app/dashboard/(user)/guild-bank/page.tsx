'use client';

import React from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  useDisclosure,
  Avatar,
  Progress,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { ItemCategory, ItemRarity } from '@/types/auction';

interface GuildContribution {
  id: string;
  type: 'contribute' | 'request' | 'item_donate' | 'item_distribute';
  amount?: number;
  itemName?: string;
  member: string;
  memberAvatar?: string;
  date: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  note?: string;
}

interface GuildBankItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  donatedBy: string;
  donatedAt: string;
  quantity: number;
}

const mockContributions: GuildContribution[] = [
  {
    id: '1',
    type: 'contribute',
    amount: 500,
    member: 'DragonHunter',
    date: '2024-01-15',
    status: 'completed',
    note: 'Weekly contribution',
  },
  {
    id: '2',
    type: 'request',
    amount: 200,
    member: 'Healer',
    date: '2024-01-14',
    status: 'approved',
    note: 'Potion supplies for raid',
  },
  {
    id: '3',
    type: 'item_donate',
    itemName: 'Dragon Scale',
    member: 'Warrior123',
    date: '2024-01-13',
    status: 'completed',
  },
  {
    id: '4',
    type: 'contribute',
    amount: 1000,
    member: 'GuildMaster',
    date: '2024-01-12',
    status: 'completed',
    note: 'Initial guild fund',
  },
  {
    id: '5',
    type: 'request',
    amount: 350,
    member: 'Enchanter',
    date: '2024-01-16',
    status: 'pending',
    note: 'Enchanting materials',
  },
  {
    id: '6',
    type: 'item_distribute',
    itemName: 'Ancient Sword',
    member: 'Blacksmith',
    date: '2024-01-11',
    status: 'completed',
    note: 'Distributed by admin',
  },
];

const mockGuildItems: GuildBankItem[] = [
  {
    id: 'gi1',
    name: 'Dragon Scale',
    description: 'A durable scale from a defeated dragon. Used for crafting high-tier armor.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.RARE,
    donatedBy: 'Warrior123',
    donatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 5,
  },
  {
    id: 'gi2',
    name: 'Elixir of Strength',
    description: 'Grants a powerful temporary boost to physical abilities.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    donatedBy: 'GuildMaster',
    donatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 12,
  },
  {
    id: 'gi3',
    name: 'Tome of Arcane Secrets',
    description: 'An ancient spellbook containing forgotten knowledge of arcane arts.',
    category: ItemCategory.SKILL_SCROLL,
    rarity: ItemRarity.EPIC,
    donatedBy: 'Enchanter',
    donatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 1,
  },
  {
    id: 'gi4',
    name: 'Iron Ore Bundle',
    description: 'A bulk bundle of iron ore for crafting basic equipment.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    donatedBy: 'Blacksmith',
    donatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 50,
  },
];

const topContributors = [
  { name: 'GuildMaster', amount: 3500, rank: 1 },
  { name: 'DragonHunter', amount: 2100, rank: 2 },
  { name: 'Warrior123', amount: 1800, rank: 3 },
  { name: 'Enchanter', amount: 950, rank: 4 },
  { name: 'Healer', amount: 600, rank: 5 },
];

const getCategoryIcon = (category: ItemCategory) => {
  const icons: Record<ItemCategory, string> = {
    [ItemCategory.WEAPON]: 'solar:wrench-linear',
    [ItemCategory.ARMOR]: 'solar:shield-check-linear',
    [ItemCategory.SKILL_SCROLL]: 'solar:book-open-linear',
    [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
    [ItemCategory.ACCESSORY]: 'solar:stars-linear',
    [ItemCategory.MATERIAL]: 'solar:box-linear',
    [ItemCategory.MISC]: 'solar:box-linear',
  };
  return icons[category] ?? 'solar:box-linear';
};

const getRarityColor = (rarity: ItemRarity) => {
  switch (rarity) {
    case ItemRarity.COMMON:
      return 'default';
    case ItemRarity.UNCOMMON:
      return 'primary';
    case ItemRarity.RARE:
      return 'secondary';
    case ItemRarity.EPIC:
      return 'warning';
    case ItemRarity.LEGENDARY:
      return 'danger';
    case ItemRarity.MYTHIC:
      return 'success';
    default:
      return 'default';
  }
};

const getContributionIcon = (type: GuildContribution['type']) => {
  switch (type) {
    case 'contribute':
      return 'solar:arrow-down-linear';
    case 'request':
      return 'solar:arrow-up-linear';
    case 'item_donate':
      return 'solar:backpack-linear';
    case 'item_distribute':
      return 'solar:arrow-right-linear';
  }
};

const getStatusColor = (status: GuildContribution['status']) => {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'danger';
    default:
      return 'default';
  }
};

const getRankColor = (rank: number) => {
  switch (rank) {
    case 1:
      return 'text-yellow-500';
    case 2:
      return 'text-slate-400';
    case 3:
      return 'text-amber-600';
    default:
      return 'text-default-400';
  }
};

export default function GuildBankPage() {
  const t = useTranslations('guildBankPage');

  const {
    isOpen: isContributeOpen,
    onOpen: onContributeOpen,
    onOpenChange: onContributeOpenChange,
  } = useDisclosure();
  const {
    isOpen: isRequestOpen,
    onOpen: onRequestOpen,
    onOpenChange: onRequestOpenChange,
  } = useDisclosure();
  const {
    isOpen: isRequestItemOpen,
    onOpen: onRequestItemOpen,
    onOpenChange: onRequestItemOpenChange,
  } = useDisclosure();

  const [contributeAmount, setContributeAmount] = React.useState('');
  const [contributeNote, setContributeNote] = React.useState('');
  const [requestAmount, setRequestAmount] = React.useState('');
  const [requestReason, setRequestReason] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<GuildBankItem | null>(null);
  const [requestItemReason, setRequestItemReason] = React.useState('');
  const [guildBalance, setGuildBalance] = React.useState(8750.0);

  const guildFundGoal = 10000;

  const getContributionLabel = (type: GuildContribution['type']) => {
    switch (type) {
      case 'contribute':
        return t('typeContribute');
      case 'request':
        return t('typeRequest');
      case 'item_donate':
        return t('typeItemDonate');
      case 'item_distribute':
        return t('typeItemDistribute');
    }
  };

  const handleContribute = () => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) return;
    setGuildBalance(prev => prev + amount);
    setContributeAmount('');
    setContributeNote('');
    onContributeOpenChange();
  };

  const handleRequest = () => {
    console.log('Request funds:', { amount: requestAmount, reason: requestReason });
    setRequestAmount('');
    setRequestReason('');
    onRequestOpenChange();
  };

  const handleRequestItem = () => {
    console.log('Request item:', { item: selectedItem?.name, reason: requestItemReason });
    setSelectedItem(null);
    setRequestItemReason('');
    onRequestItemOpenChange();
  };

  const openItemRequest = (item: GuildBankItem) => {
    setSelectedItem(item);
    onRequestItemOpen();
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Guild Treasury */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
            <Icon className="text-warning" icon="solar:safe-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('treasury')}</p>
            <p className="text-xs text-default-400">{t('treasuryDesc')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-6">
          {/* Balance Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-foreground">${guildBalance.toFixed(2)}</p>
              <p className="text-xs text-default-400 mt-0.5">{t('guildGold')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                color="warning"
                variant="flat"
                startContent={<Icon icon="solar:arrow-down-linear" width={16} />}
                onPress={onContributeOpen}
                className="w-full sm:w-auto"
              >
                {t('contribute')}
              </Button>
              <Button
                variant="bordered"
                startContent={<Icon icon="solar:arrow-up-linear" width={16} />}
                onPress={onRequestOpen}
                className="w-full sm:w-auto"
              >
                {t('requestFunds')}
              </Button>
            </div>
          </div>

          {/* Fund Goal Progress */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-default-500">{t('monthlyGoal')}</p>
              <p className="text-xs text-default-500">
                ${guildBalance.toFixed(0)} / ${guildFundGoal.toLocaleString()}
              </p>
            </div>
            <Progress
              value={(guildBalance / guildFundGoal) * 100}
              color="warning"
              size="sm"
              classNames={{ indicator: 'bg-warning' }}
            />
          </div>

          <div className="border-t border-divider" />

          {/* Top Contributors */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:cup-star-linear" width={16} className="text-default-500" />
              <p className="text-sm font-medium text-foreground">{t('topContributors')}</p>
            </div>
            <div className="flex flex-col gap-2">
              {topContributors.map(contributor => (
                <div key={contributor.rank} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-4 text-center ${getRankColor(contributor.rank)}`}>
                    {contributor.rank === 1 ? '🥇' : contributor.rank === 2 ? '🥈' : contributor.rank === 3 ? '🥉' : `#${contributor.rank}`}
                  </span>
                  <Avatar
                    size="sm"
                    src={`https://i.pravatar.cc/150?u=${contributor.name}`}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{contributor.name}</p>
                  </div>
                  <Chip size="sm" variant="flat" color="warning" className="shrink-0">
                    ${contributor.amount.toLocaleString()}
                  </Chip>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Guild Item Storage */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 shrink-0">
            <Icon className="text-secondary" icon="solar:chest-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{t('storage')}</p>
              <Chip size="sm" variant="flat">
                {mockGuildItems.length} {t('items')}
              </Chip>
            </div>
            <p className="text-xs text-default-400">{t('storageDesc')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockGuildItems.map(item => (
              <Card
                key={item.id}
                className="border border-divider shadow-none bg-content2 hover:border-default-400 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3 w-full">
                    <div className="p-2 rounded-lg bg-default-100 shrink-0">
                      <Icon
                        icon={getCategoryIcon(item.category)}
                        width={20}
                        className="text-default-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Chip size="sm" color={getRarityColor(item.rarity) as any} variant="flat">
                          {item.rarity.toUpperCase()}
                        </Chip>
                        {item.quantity > 1 && (
                          <Chip size="sm" variant="flat">
                            x{item.quantity}
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="pt-0 flex flex-col gap-3">
                  <p className="text-xs text-default-500 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-1.5 border-t border-divider pt-2">
                    <Avatar
                      size="sm"
                      src={`https://i.pravatar.cc/150?u=${item.donatedBy}`}
                      className="w-4 h-4"
                    />
                    <p className="text-xs text-default-400 truncate flex-1">
                      {t('by')} {item.donatedBy} · {new Date(item.donatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    className="w-full"
                    startContent={<Icon icon="solar:hand-shake-linear" width={14} />}
                    onPress={() => openItemRequest(item)}
                  >
                    {t('requestItem')}
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Contribution History */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('activityHistory')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table
              aria-label="Guild bank activity table"
              classNames={{
                wrapper: 'shadow-none p-0',
                th: 'bg-content2 text-default-500 text-xs font-medium',
              }}
            >
              <TableHeader>
                <TableColumn>{t('activity')}</TableColumn>
                <TableColumn>{t('member')}</TableColumn>
                <TableColumn>{t('amountItem')}</TableColumn>
                <TableColumn>{t('date')}</TableColumn>
                <TableColumn>{t('status')}</TableColumn>
              </TableHeader>
              <TableBody>
                {mockContributions.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100">
                          <Icon
                            className="text-default-500"
                            icon={getContributionIcon(entry.type)}
                            width={16}
                          />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-foreground">
                            {getContributionLabel(entry.type)}
                          </p>
                          {entry.note && (
                            <p className="text-xs text-default-400 truncate max-w-[180px]">
                              {entry.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          src={`https://i.pravatar.cc/150?u=${entry.member}`}
                          className="w-6 h-6"
                        />
                        <p className="text-sm text-foreground">{entry.member}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.amount !== undefined ? (
                        <span
                          className={`text-sm font-medium ${entry.type === 'contribute' ? 'text-success' : 'text-foreground'}`}
                        >
                          {entry.type === 'contribute' ? '+' : '-'}${entry.amount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-default-500">{entry.itemName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-default-500">
                        {new Date(entry.date).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getStatusColor(entry.status) as any}
                        size="sm"
                        variant="flat"
                      >
                        {t(entry.status)}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-divider">
            {mockContributions.map(entry => (
              <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 shrink-0">
                      <Icon
                        className="text-default-500"
                        icon={getContributionIcon(entry.type)}
                        width={16}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {getContributionLabel(entry.type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-default-400">{entry.member}</p>
                        <p className="text-xs text-default-400">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                        <Chip
                          color={getStatusColor(entry.status) as any}
                          size="sm"
                          variant="flat"
                        >
                          {t(entry.status)}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {entry.amount !== undefined ? (
                      <span
                        className={`text-sm font-medium ${entry.type === 'contribute' ? 'text-success' : 'text-foreground'}`}
                      >
                        {entry.type === 'contribute' ? '+' : '-'}${entry.amount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-default-500">{entry.itemName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Contribute Modal */}
      <Modal
        isOpen={isContributeOpen}
        onOpenChange={onContributeOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('contributeTitle')}</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  endContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">{t('gold')}</span>
                    </div>
                  }
                  label={t('amountLabel')}
                  placeholder="0.00"
                  type="number"
                  value={contributeAmount}
                  variant="bordered"
                  onValueChange={setContributeAmount}
                />
                <Textarea
                  label={t('noteOptional')}
                  placeholder={t('notePlaceholder')}
                  value={contributeNote}
                  variant="bordered"
                  minRows={2}
                  maxRows={4}
                  onValueChange={setContributeNote}
                />
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-warning shrink-0 mt-0.5"
                      icon="solar:info-circle-bold"
                      width={14}
                    />
                    <p className="text-xs text-warning">{t('contributeNote')}</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="warning"
                  onPress={handleContribute}
                  isDisabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
                >
                  {t('contribute')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Request Funds Modal */}
      <Modal
        isOpen={isRequestOpen}
        onOpenChange={onRequestOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('requestFundsTitle')}</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  endContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">{t('gold')}</span>
                    </div>
                  }
                  label={t('amountLabel')}
                  placeholder="0.00"
                  type="number"
                  value={requestAmount}
                  variant="bordered"
                  onValueChange={setRequestAmount}
                />
                <Textarea
                  label={t('reason')}
                  placeholder={t('reasonPlaceholder')}
                  value={requestReason}
                  variant="bordered"
                  minRows={3}
                  maxRows={5}
                  onValueChange={setRequestReason}
                  isRequired
                />
                <div className="bg-default-100 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-default-500 shrink-0 mt-0.5"
                      icon="solar:info-circle-bold"
                      width={14}
                    />
                    <p className="text-xs text-default-500">{t('fundRequestNote')}</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  onPress={handleRequest}
                  isDisabled={!requestAmount || !requestReason.trim()}
                >
                  {t('submitRequest')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Request Item Modal */}
      <Modal
        isOpen={isRequestItemOpen}
        onOpenChange={onRequestItemOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('requestItemTitle')}</ModalHeader>
              <ModalBody>
                {selectedItem && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-content2">
                      <div className="p-2 rounded-lg bg-default-100">
                        <Icon
                          icon={getCategoryIcon(selectedItem.category)}
                          width={20}
                          className="text-default-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{selectedItem.name}</p>
                        <p className="text-xs text-default-400 capitalize">
                          {selectedItem.rarity} · {selectedItem.category} · x{selectedItem.quantity}{' '}
                          {t('available')}
                        </p>
                      </div>
                    </div>
                    <Textarea
                      autoFocus
                      label={t('reason')}
                      placeholder={t('itemReasonPlaceholder')}
                      value={requestItemReason}
                      variant="bordered"
                      minRows={3}
                      maxRows={5}
                      onValueChange={setRequestItemReason}
                      isRequired
                    />
                    <div className="bg-default-100 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Icon
                          className="text-default-500 shrink-0 mt-0.5"
                          icon="solar:info-circle-bold"
                          width={14}
                        />
                        <p className="text-xs text-default-500">{t('itemRequestNote')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="secondary"
                  onPress={handleRequestItem}
                  isDisabled={!requestItemReason.trim()}
                >
                  {t('submitRequest')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
