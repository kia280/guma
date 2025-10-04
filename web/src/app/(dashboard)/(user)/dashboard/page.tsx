'use client';

import {
  BanknotesIcon,
  TrophyIcon,
  SparklesIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';

export default function Index() {
  const t = useTranslations('dashboard');

  const stats = [
    {
      name: t('providentFund'),
      icon: BanknotesIcon,
      value: '0',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500'
    },
    {
      name: t('totalEarnings'),
      icon: TrophyIcon,
      value: '-',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500'
    },
    {
      name: t('totalSpent'),
      icon: SparklesIcon,
      value: '-',
      color: 'bg-gradient-to-br from-orange-500 to-yellow-500'
    },
  ];

  const announcements = [
    {
      id: 1,
      title: '有任何問題，請回報給抽貝比',
      date: '2024/07/24',
      datetime: '2024-07-24',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Section */}
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-6">{t('overview')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.name} className="border-none shadow-md">
              <CardBody className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`${stat.color} p-3 rounded-xl`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-default-500">{stat.name}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Announcements Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <MegaphoneIcon className="h-7 w-7 text-foreground" />
          <h2 className="text-3xl font-bold text-foreground">{t('news')}</h2>
        </div>

        <Card className="border-none shadow-md">
          <CardBody className="p-0">
            <div className="divide-y divide-divider">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="p-6 hover:bg-default-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-foreground">
                        {announcement.title}
                      </h3>
                    </div>
                    <Chip size="sm" variant="flat" color="default">
                      {announcement.date}
                    </Chip>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
