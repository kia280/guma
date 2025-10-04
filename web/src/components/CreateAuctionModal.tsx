'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Card,
  CardBody,
  Divider,
  Chip,
} from '@heroui/react';
import {
  PlusIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ItemCategory, ItemRarity, CreateAuctionRequest } from '@/types/auction';

interface CreateAuctionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAuction: (auctionData: CreateAuctionRequest) => void;
  isLoading?: boolean;
  guildId: string;
}

const CreateAuctionModal = ({
  isOpen,
  onOpenChange,
  onCreateAuction,
  isLoading = false,
  guildId,
}: CreateAuctionModalProps) => {
  const [formData, setFormData] = useState<Partial<CreateAuctionRequest>>({
    name: '',
    description: '',
    category: ItemCategory.MISC,
    rarity: ItemRarity.COMMON,
    startingBid: 100,
    minBidIncrement: 25,
    duration: 24, // 24 hours default
    guildId,
  });

  const categoryOptions = Object.values(ItemCategory).map(category => ({
    key: category,
    label: category.replace('_', ' ').toUpperCase()
  }));

  const rarityOptions = Object.values(ItemRarity).map(rarity => ({
    key: rarity,
    label: rarity.toUpperCase()
  }));

  const durationOptions = [
    { key: '6', label: '6 Hours' },
    { key: '12', label: '12 Hours' },
    { key: '24', label: '1 Day' },
    { key: '48', label: '2 Days' },
    { key: '72', label: '3 Days' },
    { key: '168', label: '1 Week' },
  ];

  const handleSubmit = () => {
    if (isFormValid()) {
      onCreateAuction(formData as CreateAuctionRequest);
      onOpenChange(false);
      resetForm();
    }
  };

  const isFormValid = () => {
    return (
      formData.name &&
      formData.description &&
      formData.category &&
      formData.rarity &&
      formData.startingBid &&
      formData.startingBid > 0 &&
      formData.minBidIncrement &&
      formData.minBidIncrement > 0 &&
      formData.duration &&
      formData.duration > 0
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: ItemCategory.MISC,
      rarity: ItemRarity.COMMON,
      startingBid: 100,
      minBidIncrement: 25,
      duration: 24,
      guildId,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <PlusIcon className="w-5 h-5" />
                Create New Auction
              </div>
              <p className="text-small text-default-500 font-normal">
                List an item for other guild members to bid on
              </p>
            </ModalHeader>

            <ModalBody>
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardBody className="space-y-4">
                    <h4 className="text-medium font-semibold">Item Information</h4>
                    
                    <Input
                      label="Item Name"
                      placeholder="Enter the name of your item"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      isRequired
                    />

                    <Textarea
                      label="Description"
                      placeholder="Describe your item's features and benefits"
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      minRows={3}
                      isRequired
                    />

                    <div className="flex gap-4">
                      <Select
                        label="Category"
                        selectedKeys={formData.category ? [formData.category] : []}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as ItemCategory;
                          setFormData(prev => ({ ...prev, category: selected }));
                        }}
                        isRequired
                        className="flex-1"
                      >
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </Select>

                      <Select
                        label="Rarity"
                        selectedKeys={formData.rarity ? [formData.rarity] : []}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as ItemRarity;
                          setFormData(prev => ({ ...prev, rarity: selected }));
                        }}
                        isRequired
                        className="flex-1"
                      >
                        {rarityOptions.map((option) => (
                          <SelectItem key={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                  </CardBody>
                </Card>

                {/* Auction Settings */}
                <Card>
                  <CardBody className="space-y-4">
                    <h4 className="text-medium font-semibold">Auction Settings</h4>
                    
                    <div className="flex gap-4">
                      <Input
                        type="number"
                        label="Starting Bid"
                        placeholder="100"
                        value={formData.startingBid?.toString() || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          startingBid: Number(e.target.value) 
                        }))}
                        startContent={<CurrencyDollarIcon className="w-4 h-4 text-default-400" />}
                        isRequired
                        className="flex-1"
                      />

                      <Input
                        type="number"
                        label="Min Bid Increment"
                        placeholder="25"
                        value={formData.minBidIncrement?.toString() || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          minBidIncrement: Number(e.target.value) 
                        }))}
                        startContent={<CurrencyDollarIcon className="w-4 h-4 text-default-400" />}
                        isRequired
                        className="flex-1"
                      />
                    </div>

                    <Select
                      label="Auction Duration"
                      selectedKeys={formData.duration ? [formData.duration.toString()] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        setFormData(prev => ({ ...prev, duration: Number(selected) }));
                      }}
                      startContent={<ClockIcon className="w-4 h-4 text-default-400" />}
                      isRequired
                    >
                      {durationOptions.map((option) => (
                        <SelectItem key={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </CardBody>
                </Card>

                {/* Preview */}
                {formData.name && (
                  <Card>
                    <CardBody>
                      <h4 className="text-medium font-semibold mb-3">Preview</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formData.name}</span>
                          {formData.rarity && (
                            <Chip size="sm" color="primary" variant="flat">
                              {formData.rarity.toUpperCase()}
                            </Chip>
                          )}
                        </div>
                        {formData.description && (
                          <p className="text-small text-default-600">{formData.description}</p>
                        )}
                        <Divider className="my-2" />
                        <div className="flex justify-between text-small">
                          <span>Starting Bid:</span>
                          <span className="font-medium">${formData.startingBid?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-small">
                          <span>Duration:</span>
                          <span className="font-medium">
                            {durationOptions.find(d => d.key === formData.duration?.toString())?.label}
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            </ModalBody>

            <ModalFooter>
              <Button color="danger" variant="light" onPress={handleClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                disabled={!isFormValid() || isLoading}
                isLoading={isLoading}
              >
                Create Auction
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default CreateAuctionModal;
