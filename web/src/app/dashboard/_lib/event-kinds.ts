import type { EventKind, FeedEvent } from '@/types/dashboard';

type ChipColor = 'danger' | 'warning' | 'success' | 'accent' | 'default';

export const KIND_META: Record<
  EventKind,
  {
    icon: string;
    labelKey: string;
    color: ChipColor;
    href: string;
  }
> = {
  auction: { icon: 'solar:sledgehammer-linear', labelKey: 'kindAuction', color: 'warning', href: '/dashboard/auction' },
  rollCall: { icon: 'solar:check-circle-linear', labelKey: 'kindRollCall', color: 'success', href: '/dashboard/roll-calls' },
  raffle: { icon: 'solar:ticket-linear', labelKey: 'kindRaffle', color: 'accent', href: '/dashboard/raffle' },
  calendar: { icon: 'solar:calendar-linear', labelKey: 'kindCalendar', color: 'accent', href: '/dashboard/calendar' },
};

export const URGENCY_DOT: Record<FeedEvent['urgency'], string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-muted',
};
