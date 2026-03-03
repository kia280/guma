'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Icon } from '@iconify/react';
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
  const t = useTranslations('createAuctionModal');
  const [formData, setFormData] = useState<Partial<CreateAuctionRequest>>({
    name: '',
    description: '',
    category: ItemCategory.MISC,
    rarity: ItemRarity.COMMON,
    startingBid: 100,
    minBidIncrement: 25,
    duration: 24,
    guildId,
  });

  const categoryOptions = Object.values(ItemCategory).map(category => ({
    key: category,
    label: category.replace('_', ' ').toUpperCase(),
  }));

  const rarityOptions = Object.values(ItemRarity).map(rarity => ({
    key: rarity,
    label: rarity.toUpperCase(),
  }));

  const durationOptions = [
    { key: '6', label: t('6hours') },
    { key: '12', label: t('12hours') },
    { key: '24', label: t('1day') },
    { key: '48', label: t('2days') },
    { key: '72', label: t('3days') },
    { key: '168', label: t('1week') },
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
      placement="top-center"
    >
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:add-circle-linear" width={20} />
                {t('createNewAuction')}
              </div>
              <p className="text-small text-default-500 font-normal">{t('subtitle')}</p>
            </ModalHeader>

            <ModalBody>
              <div className="space-y-6">
                {/* Basic Information */}
                <Card className="border border-divider shadow-none bg-content1">
                  <CardBody className="space-y-4">
                    <h4 className="text-medium font-semibold">{t('itemInformation')}</h4>

                    <Input
                      label={t('itemName')}
                      placeholder={t('itemNamePlaceholder')}
                      value={formData.name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      isRequired
                    />

                    <Textarea
                      label={t('description')}
                      placeholder={t('descriptionPlaceholder')}
                      value={formData.description || ''}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, description: e.target.value }))
                      }
                      minRows={3}
                      isRequired
                    />

                    <div className="flex gap-4">
                      <Select
                        label={t('category')}
                        selectedKeys={formData.category ? [formData.category] : []}
                        onSelectionChange={keys => {
                          const selected = Array.from(keys)[0] as ItemCategory;
                          setFormData(prev => ({ ...prev, category: selected }));
                        }}
                        isRequired
                        className="flex-1"
                      >
                        {categoryOptions.map(option => (
                          <SelectItem key={option.key}>{option.label}</SelectItem>
                        ))}
                      </Select>

                      <Select
                        label={t('rarity')}
                        selectedKeys={formData.rarity ? [formData.rarity] : []}
                        onSelectionChange={keys => {
                          const selected = Array.from(keys)[0] as ItemRarity;
                          setFormData(prev => ({ ...prev, rarity: selected }));
                        }}
                        isRequired
                        className="flex-1"
                      >
                        {rarityOptions.map(option => (
                          <SelectItem key={option.key}>{option.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  </CardBody>
                </Card>

                {/* Auction Settings */}
                <Card className="border border-divider shadow-none bg-content1">
                  <CardBody className="space-y-4">
                    <h4 className="text-medium font-semibold">{t('auctionSettings')}</h4>

                    <div className="flex gap-4">
                      <Input
                        type="number"
                        label={t('startingBid')}
                        placeholder="100"
                        value={formData.startingBid?.toString() || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            startingBid: Number(e.target.value),
                          }))
                        }
                        startContent={
                          <Icon
                            icon="solar:dollar-minimalistic-linear"
                            width={16}
                            className="text-default-400"
                          />
                        }
                        isRequired
                        className="flex-1"
                      />

                      <Input
                        type="number"
                        label={t('minBidIncrement')}
                        placeholder="25"
                        value={formData.minBidIncrement?.toString() || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            minBidIncrement: Number(e.target.value),
                          }))
                        }
                        startContent={
                          <Icon
                            icon="solar:dollar-minimalistic-linear"
                            width={16}
                            className="text-default-400"
                          />
                        }
                        isRequired
                        className="flex-1"
                      />
                    </div>

                    <Select
                      label={t('auctionDuration')}
                      selectedKeys={formData.duration ? [formData.duration.toString()] : []}
                      onSelectionChange={keys => {
                        const selected = Array.from(keys)[0] as string;
                        setFormData(prev => ({ ...prev, duration: Number(selected) }));
                      }}
                      startContent={
                        <Icon
                          icon="solar:clock-circle-linear"
                          width={16}
                          className="text-default-400"
                        />
                      }
                      isRequired
                    >
                      {durationOptions.map(option => (
                        <SelectItem key={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  </CardBody>
                </Card>

                {/* Preview */}
                {formData.name && (
                  <Card className="border border-divider shadow-none bg-content1">
                    <CardBody>
                      <h4 className="text-medium font-semibold mb-3">{t('preview')}</h4>
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
                          <p className="text-small text-default-500">{formData.description}</p>
                        )}
                        <Divider className="my-2" />
                        <div className="flex justify-between text-small">
                          <span>{t('startingBidLabel')}</span>
                          <span className="font-medium">
                            ${formData.startingBid?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-small">
                          <span>{t('durationLabel')}</span>
                          <span className="font-medium">
                            {
                              durationOptions.find(d => d.key === formData.duration?.toString())
                                ?.label
                            }
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={handleClose}>
                {t('cancel')}
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isDisabled={!isFormValid() || isLoading}
                isLoading={isLoading}
              >
                {t('createAuction')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default CreateAuctionModal;
