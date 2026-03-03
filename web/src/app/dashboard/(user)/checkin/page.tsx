'use client';

import React from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { CheckinCard } from './CheckinCard';
import { CheckinStatus, CheckinEntry, mockCheckins } from './data';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';

const DRAFT_KEY = 'checkin_draft';

interface CheckinDraft {
  title: string;
  description: string;
  datetime: string;
  expireTime: string;
  imageUrl: string;
  lootInput: string;
  lootList: string[];
}

const emptyDraft: CheckinDraft = {
  title: '',
  description: '',
  datetime: '',
  expireTime: '',
  imageUrl: '',
  lootInput: '',
  lootList: [],
};

export default function CheckinPage() {
  const t = useTranslations('checkIn');
  const router = useRouter();

  const { isOpen: isNewOpen, onOpen: onNewOpen, onOpenChange: onNewOpenChange } = useDisclosure();

  const [checkins, setCheckins] = React.useState<CheckinEntry[]>(mockCheckins);
  const [draft, setDraft] = React.useState<CheckinDraft>(emptyDraft);

  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft from localStorage when modal opens
  const handleNewOpen = () => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        setDraft({ ...emptyDraft, ...JSON.parse(saved) });
      } catch {
        setDraft(emptyDraft);
      }
    }
    onNewOpen();
  };

  const updateDraft = (updates: Partial<CheckinDraft>) => {
    const newDraft = { ...draft, ...updates };
    setDraft(newDraft);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
    }, 500);
  };

  const handleAddLoot = () => {
    const name = draft.lootInput.trim();
    if (!name) return;
    updateDraft({ lootInput: '', lootList: [...draft.lootList, name] });
  };

  const handleRemoveLoot = (idx: number) => {
    updateDraft({ lootList: draft.lootList.filter((_, i) => i !== idx) });
  };

  const handleNewSubmit = () => {
    if (!draft.title.trim()) return;
    const newEntry: CheckinEntry = {
      id: `ci-${Date.now()}`,
      status: CheckinStatus.OPEN,
      date: draft.datetime
        ? new Date(draft.datetime).toLocaleString()
        : new Date().toLocaleString(),
      description: draft.title,
      expireTime: draft.expireTime ? new Date(draft.expireTime).toISOString() : undefined,
      attendanceList: [],
      lootList: draft.lootList.map((name, i) => ({ id: `l-${Date.now()}-${i}`, name })),
      imageUrl: draft.imageUrl || undefined,
    };
    setCheckins(prev => [newEntry, ...prev]);
    setDraft(emptyDraft);
    localStorage.removeItem(DRAFT_KEY);
    onNewOpenChange();
  };

  const handleNewCancel = () => {
    setDraft(emptyDraft);
    localStorage.removeItem(DRAFT_KEY);
    onNewOpenChange();
  };

  const handleCardClick = (item: CheckinEntry) => {
    router.push(`/dashboard/checkin/${item.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          color="primary"
          startContent={<Icon icon="solar:add-circle-linear" width={16} />}
          onPress={handleNewOpen}
        >
          {t('addCheckIn')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checkins.map(item => (
          <CheckinCard
            key={item.id}
            status={item.status}
            date={item.date}
            description={item.description}
            expireTime={item.expireTime}
            attendanceCount={item.attendanceList.length}
            lootCount={item.lootList.length}
            isDisabled={item.isDisabled}
            onClick={() => !item.isDisabled && handleCardClick(item)}
          />
        ))}
      </div>

      {/* New CheckIn Modal */}
      <Modal
        isOpen={isNewOpen}
        onOpenChange={onNewOpenChange}
        placement="top-center"
        size="md"
        hideCloseButton
        scrollBehavior="inside"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <Icon icon="solar:add-circle-linear" width={18} />
                {t('addCheckIn')}
              </ModalHeader>
              <ModalBody>
                <Input
                  label={t('title')}
                  placeholder={t('titlePlaceholder')}
                  value={draft.title}
                  onValueChange={v => updateDraft({ title: v })}
                  variant="bordered"
                  autoFocus
                />
                <Textarea
                  label={t('description')}
                  placeholder={t('descriptionPlaceholder')}
                  value={draft.description}
                  onValueChange={v => updateDraft({ description: v })}
                  variant="bordered"
                  minRows={2}
                />
                <Input
                  label={t('eventDateTime')}
                  type="datetime-local"
                  value={draft.datetime}
                  onValueChange={v => updateDraft({ datetime: v })}
                  variant="bordered"
                />
                <Input
                  label={t('expireTime')}
                  type="datetime-local"
                  value={draft.expireTime}
                  onValueChange={v => updateDraft({ expireTime: v })}
                  variant="bordered"
                  description={t('expirePlaceholder')}
                />

                {/* Loot list */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">{t('lootList')}</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('itemNamePlaceholder')}
                      value={draft.lootInput}
                      onValueChange={v => updateDraft({ lootInput: v })}
                      variant="bordered"
                      size="sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLoot();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="flat"
                      isIconOnly
                      onPress={handleAddLoot}
                      isDisabled={!draft.lootInput.trim()}
                    >
                      <Icon icon="solar:add-circle-linear" width={16} />
                    </Button>
                  </div>
                  {draft.lootList.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {draft.lootList.map((name, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-content2 border border-divider"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:box-linear" width={14} className="text-default-400" />
                            <span className="text-sm text-foreground">{name}</span>
                          </div>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="light"
                            className="text-default-400 hover:text-danger"
                            onPress={() => handleRemoveLoot(idx)}
                          >
                            <Icon icon="solar:close-circle-linear" width={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Input
                  label={t('imageUrlPlaceholder')}
                  placeholder="https://..."
                  value={draft.imageUrl}
                  onValueChange={v => updateDraft({ imageUrl: v })}
                  variant="bordered"
                />
                <p className="text-xs text-default-400 px-1">{t('draftSaved')}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={handleNewCancel}>
                  {t('cancel')}
                </Button>
                <Button color="primary" onPress={handleNewSubmit} isDisabled={!draft.title.trim()}>
                  {t('create')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
