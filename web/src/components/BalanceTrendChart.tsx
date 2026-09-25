'use client';

import { Alert, Button, EmptyState, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BalanceTrendStatus } from '@/hooks/useBalanceTrend';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useFormatGold, useFormatGoldAxisTick } from '@/lib/guma/useFormatGold';
import type { BalancePoint } from '@/types/user';

interface BalanceTrendChartProps {
  points: BalancePoint[];
  status: BalanceTrendStatus;
  onRetry: () => void;
  height?: number;
}

const parseIsoDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function BalanceTrendChart({ points, status, onRetry, height = 200 }: BalanceTrendChartProps) {
  const t = useTranslations('balanceTrendChart');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const formatGoldAxisTick = useFormatGoldAxisTick();
  const gradientId = `balance-fill-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const formatDay = React.useCallback(
    (date: string) => format.dateTime(parseIsoDate(date), { month: 'short', day: 'numeric' }),
    [format],
  );

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Spinner aria-label={t('loading')} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center" style={{ minHeight: height }}>
        <Alert status="danger" className="w-full">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('loadFailed')}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={onRetry}>
            {t('retry')}
          </Button>
        </Alert>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-2 text-center" style={{ height }}>
        <Icon className="size-6 text-disabled" icon="solar:chart-2-linear" />
        <span className="type-caption text-hint">{t('empty')}</span>
      </EmptyState>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          minTickGap={24}
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatGoldAxisTick}
        />
        <Tooltip
          labelFormatter={label => formatDay(String(label))}
          formatter={value => [formatGold(Number(value ?? 0)), t('balance')]}
          contentStyle={{
            background: 'var(--overlay)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--foreground)',
          }}
          labelStyle={{ color: 'var(--muted)' }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--accent)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
