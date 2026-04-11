'use client';

import React from 'react';
import {
  Card,
  Button,
  Chip,
  Table,
  Modal,
  useOverlayState,
  Input,
  Avatar,
  TextArea,
  TextField,
  Label,
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
      return 'accent';
    case ItemRarity.RARE:
      return 'success';
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


export default function GuildBankPage() {
  const t = useTranslations('guildBankPage');

  const requestItemModalState = useOverlayState();

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
  };

  const handleRequest = () => {
    console.log('Request funds:', { amount: requestAmount, reason: requestReason });
    setRequestAmount('');
    setRequestReason('');
  };

  const handleRequestItem = () => {
    console.log('Request item:', { item: selectedItem?.name, reason: requestItemReason });
    setSelectedItem(null);
    setRequestItemReason('');
    requestItemModalState.close();
  };

  const openItemRequest = (item: GuildBankItem) => {
    setSelectedItem(item);
    requestItemModalState.open();
  };

  return (
    <div className="space-y-5">
      {/* Guild Treasury */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
            <Icon className="text-warning" icon="solar:safe-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('treasury')}</p>
            <p className="text-xs text-foreground/40">{t('treasuryDesc')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-6">
          {/* Balance Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-foreground">${guildBalance.toFixed(2)}</p>
              <p className="text-xs text-foreground/40 mt-0.5">{t('guildGold')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Modal>
                <Button
                  variant="tertiary"
                  className="w-full sm:w-auto"
                >
                  <Icon icon="solar:arrow-down-linear" width={16} />
                  {t('contribute')}
                </Button>
                <Modal.Backdrop>
                  <Modal.Container size="sm">
                    <Modal.Dialog>
                      <Modal.CloseTrigger />
                      <Modal.Header className="text-center items-center">
                        <Modal.Heading>{t('contributeTitle')}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="p-1 flex flex-col gap-3">
                        <TextField>
                          <Label>{t('amountLabel')}</Label>
                          <Input
                            autoFocus
                            placeholder="0.00"
                            type="number"
                            value={contributeAmount}
                            variant="secondary"
                            onChange={e => setContributeAmount(e.target.value)}
                          />
                        </TextField>
                        <TextField>
                          <Label>{t('noteOptional')}</Label>
                          <TextArea
                            placeholder={t('notePlaceholder')}
                            value={contributeNote}
                            variant="secondary"
                            rows={2}
                            onChange={e => setContributeNote(e.target.value)}
                          />
                        </TextField>
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
                      </Modal.Body>
                      <Modal.Footer>
                        <Button slot="close" variant="secondary">
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="tertiary"
                          onPress={handleContribute}
                          isDisabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
                        >
                          {t('contribute')}
                        </Button>
                      </Modal.Footer>
                    </Modal.Dialog>
                  </Modal.Container>
                </Modal.Backdrop>
              </Modal>
              <Modal>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  <Icon icon="solar:arrow-up-linear" width={16} />
                  {t('requestFunds')}
                </Button>
                <Modal.Backdrop>
                  <Modal.Container size="sm">
                    <Modal.Dialog>
                      <Modal.CloseTrigger />
                      <Modal.Header className="text-center items-center">
                        <Modal.Heading>{t('requestFundsTitle')}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="p-1 flex flex-col gap-3">
                        <TextField>
                          <Label>{t('amountLabel')}</Label>
                          <Input
                            autoFocus
                            placeholder="0.00"
                            type="number"
                            value={requestAmount}
                            variant="secondary"
                            onChange={e => setRequestAmount(e.target.value)}
                          />
                        </TextField>
                        <TextField>
                          <Label>{t('reason')}</Label>
                          <TextArea
                            placeholder={t('reasonPlaceholder')}
                            value={requestReason}
                            variant="secondary"
                            rows={3}
                            onChange={e => setRequestReason(e.target.value)}
                          />
                        </TextField>
                        <div className="bg-default-100 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Icon
                              className="text-foreground/50 shrink-0 mt-0.5"
                              icon="solar:info-circle-bold"
                              width={14}
                            />
                            <p className="text-xs text-foreground/50">{t('fundRequestNote')}</p>
                          </div>
                        </div>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button slot="close" variant="secondary">
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="primary"
                          onPress={handleRequest}
                          isDisabled={!requestAmount || !requestReason.trim()}
                        >
                          {t('submitRequest')}
                        </Button>
                      </Modal.Footer>
                    </Modal.Dialog>
                  </Modal.Container>
                </Modal.Backdrop>
              </Modal>
            </div>
          </div>

          {/* Fund Goal Progress */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-foreground/50">{t('monthlyGoal')}</p>
              <p className="text-xs text-foreground/50">
                ${guildBalance.toFixed(0)} / ${guildFundGoal.toLocaleString()}
              </p>
            </div>
            <div className="w-full bg-default-200 rounded-full overflow-hidden h-2">
              <div
                className="h-full bg-warning transition-all"
                style={{ width: `${Math.min(100, (guildBalance / guildFundGoal) * 100)}%` }}
              />
            </div>
          </div>

        </Card.Content>
      </Card>

      {/* Guild Item Storage */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 shrink-0">
            <Icon className="text-secondary" icon="solar:chest-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{t('storage')}</p>
              <Chip size="sm" variant="tertiary">
                {mockGuildItems.length} {t('items')}
              </Chip>
            </div>
            <p className="text-xs text-foreground/40">{t('storageDesc')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockGuildItems.map(item => (
              <Card
                key={item.id}
                className="border border-divider shadow-none bg-surface-secondary hover:border-default-400 transition-colors"
              >
                <Card.Header className="pb-2">
                  <div className="flex items-start gap-3 w-full">
                    <div className="p-2 rounded-lg bg-default-100 shrink-0">
                      <Icon
                        icon={getCategoryIcon(item.category)}
                        width={20}
                        className="text-foreground/50"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Chip
                          size="sm"
                          color={getRarityColor(item.rarity)}
                          variant="tertiary"
                        >
                          {item.rarity.toUpperCase()}
                        </Chip>
                        {item.quantity > 1 && (
                          <Chip size="sm" variant="tertiary">
                            x{item.quantity}
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>
                </Card.Header>
                <Card.Content className="pt-0 flex flex-col gap-3">
                  <p className="text-xs text-foreground/50 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-1.5 border-t border-divider pt-2">
                    <Avatar size="sm" className="w-4 h-4">
                      <Avatar.Image src={`https://i.pravatar.cc/150?u=${item.donatedBy}`} />
                      <Avatar.Fallback>{item.donatedBy.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                    </Avatar>
                    <p className="text-xs text-foreground/40 truncate flex-1">
                      {t('by')} {item.donatedBy} · {new Date(item.donatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onPress={() => openItemRequest(item)}
                  >
                    <Icon icon="solar:hand-shake-linear" width={14} />
                    {t('requestItem')}
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Contribution History */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-foreground/50" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('activityHistory')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Guild bank activity table" className="min-w-[700px]">
                  <Table.Header>
                    <Table.Column>{t('activity')}</Table.Column>
                    <Table.Column>{t('member')}</Table.Column>
                    <Table.Column>{t('amountItem')}</Table.Column>
                    <Table.Column>{t('date')}</Table.Column>
                    <Table.Column>{t('status')}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {mockContributions.map(entry => (
                      <Table.Row key={entry.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100">
                              <Icon
                                className="text-foreground/50"
                                icon={getContributionIcon(entry.type)}
                                width={16}
                              />
                            </div>
                            <div className="flex flex-col">
                              <p className="text-sm font-medium text-foreground">
                                {getContributionLabel(entry.type)}
                              </p>
                              {entry.note && (
                                <p className="text-xs text-foreground/40 truncate max-w-[180px]">
                                  {entry.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm" className="w-6 h-6">
                              <Avatar.Image src={`https://i.pravatar.cc/150?u=${entry.member}`} />
                              <Avatar.Fallback>
                                {entry.member.slice(0, 2).toUpperCase()}
                              </Avatar.Fallback>
                            </Avatar>
                            <p className="text-sm text-foreground">{entry.member}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {entry.amount !== undefined ? (
                            <span
                              className={`text-sm font-medium ${entry.type === 'contribute' ? 'text-success' : 'text-foreground'}`}
                            >
                              {entry.type === 'contribute' ? '+' : '-'}${entry.amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-foreground/50">{entry.itemName}</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <p className="text-sm text-foreground/50">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={getStatusColor(entry.status)}
                            size="sm"
                            variant="tertiary"
                          >
                            {t(entry.status)}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
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
                        className="text-foreground/50"
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
                        <p className="text-xs text-foreground/40">{entry.member}</p>
                        <p className="text-xs text-foreground/40">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                        <Chip size="sm" variant="secondary">
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
                      <span className="text-xs text-foreground/50">{entry.itemName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Request Item Modal */}
      <Modal state={requestItemModalState}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="text-center items-center">
              <Modal.Heading>{t('requestItemTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1 flex flex-col gap-3">
              {selectedItem && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                    <div className="p-2 rounded-lg bg-default-100">
                      <Icon
                        icon={getCategoryIcon(selectedItem.category)}
                        width={20}
                        className="text-foreground/50"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedItem.name}</p>
                      <p className="text-xs text-foreground/40 capitalize">
                        {selectedItem.rarity} · {selectedItem.category} · x{selectedItem.quantity}{' '}
                        {t('available')}
                      </p>
                    </div>
                  </div>
                  <TextField>
                    <Label>{t('reason')}</Label>
                    <TextArea
                      autoFocus
                      placeholder={t('itemReasonPlaceholder')}
                      value={requestItemReason}
                      variant="secondary"
                      rows={3}
                      onChange={e => setRequestItemReason(e.target.value)}
                    />
                  </TextField>
                  <div className="bg-default-100 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        className="text-foreground/50 shrink-0 mt-0.5"
                        icon="solar:info-circle-bold"
                        width={14}
                      />
                      <p className="text-xs text-foreground/50">{t('itemRequestNote')}</p>
                    </div>
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleRequestItem}
                isDisabled={!requestItemReason.trim()}
              >
                {t('submitRequest')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
