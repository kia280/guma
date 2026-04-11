'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Modal,
  Button,
  Input,
  TextArea,
  Select,
  Card,
  Separator,
  Chip,
  TextField,
  Label,
  InputGroup,
  ListBox,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { ItemCategory, ItemRarity, CreateAuctionRequest } from '@/types/auction';

interface CreateAuctionModalProps {
  state: UseOverlayStateReturn;
  onCreateAuction: (auctionData: CreateAuctionRequest) => void;
  isLoading?: boolean;
  guildId: string;
}

const CreateAuctionModal = ({
  state,
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
      state.close();
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
    state.close();
    resetForm();
  };

  return (
    <Modal state={state}>
    <Modal.Backdrop>
      <Modal.Container size="lg">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header className="text-center items-center">
            <Modal.Heading>
              <div className="flex items-center gap-2">
                <Icon icon="solar:add-circle-linear" width={20} />
                {t('createNewAuction')}
              </div>
            </Modal.Heading>
            <p className="text-small text-foreground/50 font-normal">{t('subtitle')}</p>
          </Modal.Header>

          <Modal.Body className="p-1">
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="border border-divider shadow-none bg-surface">
                <Card.Content className="space-y-4">
                  <h4 className="text-medium font-semibold">{t('itemInformation')}</h4>

                  <TextField isRequired>
                    <Label>{t('itemName')}</Label>
                    <Input
                      placeholder={t('itemNamePlaceholder')}
                      value={formData.name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </TextField>

                  <TextField isRequired>
                    <Label>{t('description')}</Label>
                    <TextArea
                      placeholder={t('descriptionPlaceholder')}
                      value={formData.description || ''}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, description: e.target.value }))
                      }
                      rows={3}
                    />
                  </TextField>

                  <div className="flex gap-4">
                    <Select
                      isRequired
                      className="flex-1"
                      value={formData.category || ''}
                      onChange={value => {
                        setFormData(prev => ({ ...prev, category: value as ItemCategory }));
                      }}
                    >
                      <Label>{t('category')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {categoryOptions.map(option => (
                            <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    <Select
                      isRequired
                      className="flex-1"
                      value={formData.rarity || ''}
                      onChange={value => {
                        setFormData(prev => ({ ...prev, rarity: value as ItemRarity }));
                      }}
                    >
                      <Label>{t('rarity')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {rarityOptions.map(option => (
                            <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </Card.Content>
              </Card>

              {/* Auction Settings */}
              <Card className="border border-divider shadow-none bg-surface">
                <Card.Content className="space-y-4">
                  <h4 className="text-medium font-semibold">{t('auctionSettings')}</h4>

                  <div className="flex gap-4">
                    <TextField isRequired className="flex-1">
                      <Label>{t('startingBid')}</Label>
                      <InputGroup>
                        <InputGroup.Prefix>
                          <Icon
                            icon="solar:dollar-minimalistic-linear"
                            width={16}
                            className="text-foreground/40"
                          />
                        </InputGroup.Prefix>
                        <InputGroup.Input
                          type="number"
                          placeholder="100"
                          value={formData.startingBid?.toString() || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              startingBid: Number(e.target.value),
                            }))
                          }
                        />
                      </InputGroup>
                    </TextField>

                    <TextField isRequired className="flex-1">
                      <Label>{t('minBidIncrement')}</Label>
                      <InputGroup>
                        <InputGroup.Prefix>
                          <Icon
                            icon="solar:dollar-minimalistic-linear"
                            width={16}
                            className="text-foreground/40"
                          />
                        </InputGroup.Prefix>
                        <InputGroup.Input
                          type="number"
                          placeholder="25"
                          value={formData.minBidIncrement?.toString() || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              minBidIncrement: Number(e.target.value),
                            }))
                          }
                        />
                      </InputGroup>
                    </TextField>
                  </div>

                  <Select
                    isRequired
                    value={formData.duration?.toString() || ''}
                    onChange={value => {
                      setFormData(prev => ({ ...prev, duration: Number(value) }));
                    }}
                  >
                    <Label>{t('auctionDuration')}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {durationOptions.map(option => (
                          <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Card.Content>
              </Card>

              {/* Preview */}
              {formData.name && (
                <Card className="border border-divider shadow-none bg-surface">
                  <Card.Content>
                    <h4 className="text-medium font-semibold mb-3">{t('preview')}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formData.name}</span>
                        {formData.rarity && (
                          <Chip size="sm" color="accent" variant="secondary">
                            {formData.rarity.toUpperCase()}
                          </Chip>
                        )}
                      </div>
                      {formData.description && (
                        <p className="text-small text-foreground/50">{formData.description}</p>
                      )}
                      <Separator className="my-2" />
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
                  </Card.Content>
                </Card>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" slot="close">
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              isDisabled={!isFormValid() || isLoading}
              isPending={isLoading}
            >
              {t('createAuction')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
};

export default CreateAuctionModal;
