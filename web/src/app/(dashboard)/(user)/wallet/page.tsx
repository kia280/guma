"use client";

import React from "react";
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
  Divider,
  Avatar
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

interface Transaction {
  id: string;
  type: "transfer" | "withdraw" | "deposit";
  amount: number;
  recipient?: string;
  date: string;
  status: "completed" | "pending" | "failed";
  description?: string;
}

export default function WalletPage() {
  const t = useTranslations('walletPage');
  const { isOpen: isTransferOpen, onOpen: onTransferOpen, onOpenChange: onTransferOpenChange } = useDisclosure();
  const { isOpen: isWithdrawOpen, onOpen: onWithdrawOpen, onOpenChange: onWithdrawOpenChange } = useDisclosure();
  
  const [transferAmount, setTransferAmount] = React.useState("");
  const [transferRecipient, setTransferRecipient] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  
  // Mock data - replace with real data from your API
  const userBalance = 1250.75;
  const transactions: Transaction[] = [
    {
      id: "1",
      type: "transfer",
      amount: -100.00,
      recipient: "john.doe@example.com",
      date: "2024-01-15",
      status: "completed",
      description: "Transfer to John Doe"
    },
    {
      id: "2",
      type: "deposit",
      amount: 500.00,
      date: "2024-01-14",
      status: "completed",
      description: "Account deposit"
    },
    {
      id: "3",
      type: "withdraw",
      amount: -250.00,
      date: "2024-01-13",
      status: "completed",
      description: "Withdrawal to bank account"
    },
    {
      id: "4",
      type: "transfer",
      amount: -75.50,
      recipient: "jane.smith@example.com",
      date: "2024-01-12",
      status: "pending",
      description: "Transfer to Jane Smith"
    }
  ];

  const handleTransfer = () => {
    // Handle transfer logic here
    console.log("Transfer:", { amount: transferAmount, recipient: transferRecipient });
    setTransferAmount("");
    setTransferRecipient("");
    onTransferOpenChange();
  };

  const handleWithdraw = () => {
    // Handle withdraw logic here
    console.log("Withdraw:", withdrawAmount);
    setWithdrawAmount("");
    onWithdrawOpenChange();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "transfer":
        return "solar:arrow-right-linear";
      case "withdraw":
        return "solar:arrow-up-linear";
      case "deposit":
        return "solar:arrow-down-linear";
      default:
        return "solar:wallet-linear";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full p-0 sm:p-0">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Wallet</h1>
        <p className="text-default-500 text-sm sm:text-base">Manage your balance and transactions</p>
      </div>

      {/* Balance Card */}
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon
              className="text-primary"
              icon="solar:wallet-money-bold-duotone"
              width={24}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-md font-semibold">Current Balance</p>
            <p className="text-small text-default-500 hidden sm:block">Available funds in your account</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-3xl sm:text-4xl font-bold text-primary">${userBalance.toFixed(2)}</p>
              <p className="text-small text-default-500 mt-1">USD</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                color="primary"
                startContent={<Icon icon="solar:arrow-right-linear" width={20} />}
                onPress={onTransferOpen}
                className="w-full sm:w-auto"
                size="md"
              >
                <span className="hidden sm:inline">Transfer</span>
                <span className="sm:hidden">Send Money</span>
              </Button>
              <Button
                color="secondary"
                variant="bordered"
                startContent={<Icon icon="solar:arrow-up-linear" width={20} />}
                onPress={onWithdrawOpen}
                className="w-full sm:w-auto"
                size="md"
              >
                Withdraw
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Transaction History */}
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
            <Icon
              className="text-default-500"
              icon="solar:history-line-duotone"
              width={24}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-md font-semibold">Transaction History</p>
            <p className="text-small text-default-500 hidden sm:block">Your recent transactions</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            <Table aria-label="Transaction history table">
              <TableHeader>
                <TableColumn>TRANSACTION</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>DATE</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-default-100">
                          <Icon
                            className="text-default-500"
                            icon={getTransactionIcon(transaction.type)}
                            width={20}
                          />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-small font-medium">{transaction.description}</p>
                          {transaction.recipient && (
                            <p className="text-tiny text-default-400">To: {transaction.recipient}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={transaction.amount > 0 ? "text-success" : "text-danger"}>
                        {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-small">{new Date(transaction.date).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell>
                      <Chip
                        className="capitalize"
                        color={getStatusColor(transaction.status) as any}
                        size="sm"
                        variant="flat"
                      >
                        {transaction.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {transactions.map((transaction) => (
              <Card key={transaction.id} className="shadow-none border border-divider">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-default-100 flex-shrink-0">
                        <Icon
                          className="text-default-500"
                          icon={getTransactionIcon(transaction.type)}
                          width={20}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-small font-medium truncate">{transaction.description}</p>
                        {transaction.recipient && (
                          <p className="text-tiny text-default-400 truncate">To: {transaction.recipient}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-tiny text-default-500">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                          <Chip
                            className="capitalize"
                            color={getStatusColor(transaction.status) as any}
                            size="sm"
                            variant="flat"
                          >
                            {transaction.status}
                          </Chip>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-semibold ${transaction.amount > 0 ? "text-success" : "text-danger"}`}>
                        {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
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
        classNames={{
          base: "mx-2 my-2 sm:mx-0 sm:my-0",
          body: "py-4",
          footer: "pt-2 pb-4"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-center sm:text-left">
                Transfer Money
              </ModalHeader>
              <ModalBody className="px-4 sm:px-6">
                <Input
                  autoFocus
                  endContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">USD</span>
                    </div>
                  }
                  label="Amount"
                  placeholder="0.00"
                  type="number"
                  value={transferAmount}
                  variant="bordered"
                  onValueChange={setTransferAmount}
                  size="lg"
                />
                <Input
                  label="Recipient"
                  placeholder="Enter email or username"
                  type="email"
                  value={transferRecipient}
                  variant="bordered"
                  onValueChange={setTransferRecipient}
                  size="lg"
                />
                <div className="flex py-2 px-1 justify-between">
                  <p className="text-small text-default-500">Available: ${userBalance.toFixed(2)}</p>
                </div>
              </ModalBody>
              <ModalFooter className="flex flex-col sm:flex-row gap-2 px-4 sm:px-6">
                <Button 
                  color="danger" 
                  variant="flat" 
                  onPress={onClose}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleTransfer}
                  className="w-full sm:w-auto"
                >
                  Transfer
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Withdraw Modal */}
      <Modal 
        isOpen={isWithdrawOpen} 
        onOpenChange={onWithdrawOpenChange} 
        placement="top-center"
        size="sm"
        classNames={{
          base: "mx-2 my-2 sm:mx-0 sm:my-0",
          body: "py-4",
          footer: "pt-2 pb-4"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-center sm:text-left">
                Withdraw Money
              </ModalHeader>
              <ModalBody className="px-4 sm:px-6">
                <Input
                  autoFocus
                  endContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">USD</span>
                    </div>
                  }
                  label="Amount"
                  placeholder="0.00"
                  type="number"
                  value={withdrawAmount}
                  variant="bordered"
                  onValueChange={setWithdrawAmount}
                  size="lg"
                />
                <div className="flex py-2 px-1 justify-between">
                  <p className="text-small text-default-500">Available: ${userBalance.toFixed(2)}</p>
                </div>
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon className="text-warning-600 flex-shrink-0 mt-0.5" icon="solar:info-circle-bold" width={16} />
                    <p className="text-small text-warning-700">
                      Withdrawals may take 1-3 business days to process.
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex flex-col sm:flex-row gap-2 px-4 sm:px-6">
                <Button 
                  color="danger" 
                  variant="flat" 
                  onPress={onClose}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  color="secondary" 
                  onPress={handleWithdraw}
                  className="w-full sm:w-auto"
                >
                  Withdraw
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
