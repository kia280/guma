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
  useDisclosure,
  Autocomplete,
  AutocompleteItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import BackpackItemCard from '@/components/BackpackItemCard';
import { BackpackItem } from '@/types/backpack';
import { ItemCategory, ItemRarity } from '@/types/auction';

interface Transaction {
  id: string;
  type: 'transfer' | 'withdraw' | 'deposit';
  amount: number;
  recipient?: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
}

// Mock users for recipient search
const mockUsers = [
  { id: 'u1', username: 'DragonHunter', email: 'dragon@example.com' },
  { id: 'u2', username: 'Warrior123', email: 'warrior@example.com' },
  { id: 'u3', username: 'Healer', email: 'healer@example.com' },
  { id: 'u4', username: 'Blacksmith', email: 'blacksmith@example.com' },
  { id: 'u5', username: 'GuildMaster', email: 'master@example.com' },
  { id: 'u6', username: 'Enchanter', email: 'enchanter@example.com' },
  { id: 'u7', username: 'ScrollMaster', email: 'scroll@example.com' },
];

// Mock backpack items
const mockBackpackItems: BackpackItem[] = [
  {
    id: 'bp1',
    name: 'Ancient Sword',
    description: 'A blade passed down through generations, still sharp as ever.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.RARE,
    acquiredFrom: 'auction',
    acquiredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp2',
    name: 'Lucky Charm',
    description: 'A small trinket said to bring good fortune in battle.',
    category: ItemCategory.ACCESSORY,
    rarity: ItemRarity.UNCOMMON,
    acquiredFrom: 'lottery',
    acquiredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp3',
    name: 'Iron Shield',
    description: 'Standard issue protective gear for guild members.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.COMMON,
    acquiredFrom: 'admin',
    acquiredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp4',
    name: 'Health Potion',
    description: 'Restores 50% maximum health when consumed.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    acquiredFrom: 'transfer',
    acquiredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
];

export default function WalletPage() {
  const t = useTranslations('walletPage');
  const {
    isOpen: isTransferOpen,
    onOpen: onTransferOpen,
    onOpenChange: onTransferOpenChange,
  } = useDisclosure();
  const {
    isOpen: isWithdrawOpen,
    onOpen: onWithdrawOpen,
    onOpenChange: onWithdrawOpenChange,
  } = useDisclosure();
  const {
    isOpen: isItemWithdrawOpen,
    onOpen: onItemWithdrawOpen,
    onOpenChange: onItemWithdrawOpenChange,
  } = useDisclosure();
  const {
    isOpen: isDepositOpen,
    onOpen: onDepositOpen,
    onOpenChange: onDepositOpenChange,
  } = useDisclosure();

  const [transferAmount, setTransferAmount] = React.useState('');
  const [transferRecipient, setTransferRecipient] = React.useState('');
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [depositAmount, setDepositAmount] = React.useState('');
  const [recipientSearch, setRecipientSearch] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<BackpackItem | null>(null);
  const [backpackItems, setBackpackItems] = React.useState<BackpackItem[]>(mockBackpackItems);
  const [balance, setBalance] = React.useState(1250.75);
  const [transactions, setTransactions] = React.useState<Transaction[]>([
    {
      id: '1',
      type: 'transfer',
      amount: -100.0,
      recipient: 'DragonHunter',
      date: '2024-01-15',
      status: 'completed',
      description: 'Transfer to DragonHunter',
    },
    {
      id: '2',
      type: 'deposit',
      amount: 500.0,
      date: '2024-01-14',
      status: 'completed',
      description: 'Account deposit',
    },
    {
      id: '3',
      type: 'withdraw',
      amount: -250.0,
      date: '2024-01-13',
      status: 'completed',
      description: 'Withdrawal to bank account',
    },
    {
      id: '4',
      type: 'transfer',
      amount: -75.5,
      recipient: 'Healer',
      date: '2024-01-12',
      status: 'pending',
      description: 'Transfer to Healer',
    },
    {
      id: '5',
      type: 'withdraw',
      amount: -500.0,
      date: '2024-01-16',
      status: 'pending',
      description: 'Withdrawal Request',
    },
  ]);

  const handleTransfer = () => {
    console.log('Transfer:', { amount: transferAmount, recipient: transferRecipient });
    setTransferAmount('');
    setTransferRecipient('');
    setRecipientSearch('');
    onTransferOpenChange();
  };

  const handleWithdraw = () => {
    console.log('Withdraw:', withdrawAmount);
    setWithdrawAmount('');
    onWithdrawOpenChange();
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setBalance(prev => prev + amount);
    setTransactions(prev => [
      {
        id: Date.now().toString(),
        type: 'deposit',
        amount,
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        description: 'Account deposit',
      },
      ...prev,
    ]);
    setDepositAmount('');
    onDepositOpenChange();
  };

  const handleItemWithdraw = () => {
    console.log('Withdraw item:', selectedItem?.name);
    setSelectedItem(null);
    onItemWithdrawOpenChange();
  };

  const openItemWithdraw = (item: BackpackItem) => {
    setSelectedItem(item);
    onItemWithdrawOpen();
  };

  const handleNoteChange = (item: BackpackItem, note: string) => {
    setBackpackItems(prev => prev.map(i => (i.id === item.id ? { ...i, note } : i)));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return 'solar:arrow-right-linear';
      case 'withdraw':
        return 'solar:arrow-up-linear';
      case 'deposit':
        return 'solar:arrow-down-linear';
      default:
        return 'solar:wallet-linear';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'default';
    }
  };

  const filteredUsers = mockUsers.filter(
    u =>
      recipientSearch.length >= 2 &&
      (u.username.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Balance + Backpack Section */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="text-primary" icon="solar:wallet-money-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('balanceAndBackpack')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-6">
          {/* Balance Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-foreground">${balance.toFixed(2)}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                color="success"
                variant="flat"
                startContent={<Icon icon="solar:arrow-down-linear" width={16} />}
                onPress={onDepositOpen}
                className="w-full sm:w-auto"
              >
                {t('deposit')}
              </Button>
              <Button
                color="primary"
                startContent={<Icon icon="solar:arrow-right-linear" width={16} />}
                onPress={onTransferOpen}
                className="w-full sm:w-auto"
              >
                {t('transfer')}
              </Button>
              <Button
                variant="bordered"
                startContent={<Icon icon="solar:arrow-up-linear" width={16} />}
                onPress={onWithdrawOpen}
                className="w-full sm:w-auto"
              >
                {t('withdraw')}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-divider" />

          {/* Backpack Items */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Icon icon="solar:backpack-linear" width={16} className="text-default-500" />
                <p className="text-sm font-medium text-foreground">{t('yourItems')}</p>
              </div>
              <Chip size="sm" variant="flat">
                {mockBackpackItems.length} {t('items')}
              </Chip>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {backpackItems.map(item => (
                <BackpackItemCard
                  key={item.id}
                  item={item}
                  onPutToAuction={i => console.log('Put to auction:', i.name)}
                  onPutToLottery={i => console.log('Put to lottery:', i.name)}
                  onTransfer={i => console.log('Transfer:', i.name)}
                  onWithdraw={openItemWithdraw}
                  onNoteChange={handleNoteChange}
                />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Transaction History */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('transactionHistory')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table
              aria-label="Transaction history table"
              classNames={{
                wrapper: 'shadow-none p-0',
                th: 'bg-content2 text-default-500 text-xs font-medium',
              }}
            >
              <TableHeader>
                <TableColumn>{t('transaction')}</TableColumn>
                <TableColumn>{t('amount')}</TableColumn>
                <TableColumn>{t('date')}</TableColumn>
                <TableColumn>{t('status')}</TableColumn>
              </TableHeader>
              <TableBody>
                {transactions.map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100">
                          <Icon
                            className="text-default-500"
                            icon={getTransactionIcon(transaction.type)}
                            width={16}
                          />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-foreground">
                            {transaction.description}
                          </p>
                          {transaction.recipient && (
                            <p className="text-xs text-default-400">
                              {t('to')} {transaction.recipient}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm font-medium ${transaction.amount > 0 ? 'text-success' : 'text-foreground'}`}
                      >
                        {transaction.amount > 0 ? '+' : ''}$
                        {Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-default-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Chip
                        className="capitalize"
                        color={getStatusColor(transaction.status) as any}
                        size="sm"
                        variant="flat"
                      >
                        {t(transaction.status)}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-divider">
            {transactions.map(transaction => (
              <div key={transaction.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 shrink-0">
                      <Icon
                        className="text-default-500"
                        icon={getTransactionIcon(transaction.type)}
                        width={16}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-default-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                        <Chip
                          className="capitalize"
                          color={getStatusColor(transaction.status) as any}
                          size="sm"
                          variant="flat"
                        >
                          {t(transaction.status)}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span
                      className={`text-sm font-medium ${transaction.amount > 0 ? 'text-success' : 'text-foreground'}`}
                    >
                      {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Transfer Modal */}
      <Modal
        isOpen={isTransferOpen}
        onOpenChange={onTransferOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('transferMoney')}</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  endContent={undefined}
                  label={t('amountLabel')}
                  placeholder="0.00"
                  type="number"
                  value={transferAmount}
                  variant="bordered"
                  onValueChange={setTransferAmount}
                />
                <Autocomplete
                  label={t('recipient')}
                  placeholder={t('searchRecipient')}
                  variant="bordered"
                  inputValue={recipientSearch}
                  onInputChange={setRecipientSearch}
                  onSelectionChange={key => setTransferRecipient(key as string)}
                  defaultItems={filteredUsers}
                >
                  {user => (
                    <AutocompleteItem key={user.id} textValue={user.username}>
                      <div className="flex flex-col">
                        <span className="text-sm">{user.username}</span>
                        <span className="text-xs text-default-400">{user.email}</span>
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <p className="text-xs text-default-400 px-1">
                  {t('available')} ${balance.toFixed(2)}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button color="primary" onPress={handleTransfer}>
                  {t('transfer')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Deposit Modal */}
      <Modal
        isOpen={isDepositOpen}
        onOpenChange={onDepositOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('depositMoney')}</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  endContent={undefined}
                  label={t('amountLabel')}
                  placeholder="0.00"
                  type="number"
                  value={depositAmount}
                  variant="bordered"
                  onValueChange={setDepositAmount}
                />
                <p className="text-xs text-default-400 px-1">
                  {t('currentBalanceLabel')} ${balance.toFixed(2)}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="success"
                  onPress={handleDeposit}
                  isDisabled={!depositAmount || parseFloat(depositAmount) <= 0}
                >
                  {t('deposit')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Withdraw Money Modal */}
      <Modal
        isOpen={isWithdrawOpen}
        onOpenChange={onWithdrawOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('withdrawMoney')}</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  endContent={undefined}
                  label={t('amountLabel')}
                  placeholder="0.00"
                  type="number"
                  value={withdrawAmount}
                  variant="bordered"
                  onValueChange={setWithdrawAmount}
                />
                <p className="text-xs text-default-400 px-1">
                  {t('available')} ${balance.toFixed(2)}
                </p>
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-warning shrink-0 mt-0.5"
                      icon="solar:info-circle-bold"
                      width={14}
                    />
                    <p className="text-xs text-warning">{t('withdrawNote')}</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button color="primary" onPress={handleWithdraw}>
                  {t('withdraw')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Withdraw Item Modal */}
      <Modal
        isOpen={isItemWithdrawOpen}
        onOpenChange={onItemWithdrawOpenChange}
        placement="top-center"
        size="sm"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('withdrawItem')}</ModalHeader>
              <ModalBody>
                {selectedItem && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-content2">
                      <div className="p-2 rounded-lg bg-default-100">
                        <Icon
                          icon="solar:backpack-linear"
                          width={20}
                          className="text-default-500"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{selectedItem.name}</p>
                        <p className="text-xs text-default-400 capitalize">
                          {selectedItem.rarity} · {selectedItem.category}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-default-600">
                      {t('withdrawItemConfirm')}{' '}
                      <span className="font-medium text-foreground">{selectedItem.name}</span>{' '}
                      {t('withdrawItemConfirmSuffix')}
                    </p>
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Icon
                          className="text-warning shrink-0 mt-0.5"
                          icon="solar:info-circle-bold"
                          width={14}
                        />
                        <p className="text-xs text-warning">{t('withdrawItemNote')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button color="danger" onPress={handleItemWithdraw}>
                  {t('withdrawItem')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
