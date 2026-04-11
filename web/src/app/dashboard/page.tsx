'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { Card, Chip, Modal, Button, useOverlayState } from '@heroui/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ─── Mock data ────────────────────────────────────────────────────────────────

const GUILD_STATS = {
  members: 42,
  activeEvents: 5,
  balance: 128_450,
  checkinsThisWeek: 31,
  activeAuctions: 3,
  openLotteries: 2,
};

const PERSONAL_STATS = {
  balance: 5_000,
  checkinsThisMonth: 7,
  activeAuctions: 3,
  activityPoints: 340,
};

// Last 30 days wallet balance (sampled every 3 days)
const balanceTrend = [
  { day: 'Feb 1', balance: 3200 },
  { day: 'Feb 4', balance: 3800 },
  { day: 'Feb 7', balance: 3500 },
  { day: 'Feb 10', balance: 4100 },
  { day: 'Feb 13', balance: 3900 },
  { day: 'Feb 16', balance: 4400 },
  { day: 'Feb 19', balance: 4200 },
  { day: 'Feb 22', balance: 4750 },
  { day: 'Feb 25', balance: 5000 },
];

// Upcoming events feed (mixed sources)
type EventKind = 'checkin' | 'auction' | 'lottery' | 'calendar';

interface FeedEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  timeLabel: string;
  urgency: 'high' | 'medium' | 'low';
}

const INCOMING_EVENTS: FeedEvent[] = [
  {
    id: '1',
    kind: 'auction',
    title: 'Dragon Slayer Sword',
    subtitle: 'Auction ending soon',
    timeLabel: '6h remaining',
    urgency: 'high',
  },
  {
    id: '2',
    kind: 'checkin',
    title: 'Weekly Guild Check-in',
    subtitle: 'Open — awaiting your check-in',
    timeLabel: 'Open now',
    urgency: 'high',
  },
  {
    id: '3',
    kind: 'lottery',
    title: 'Spring Giveaway Draw',
    subtitle: '$2,500 prize pool',
    timeLabel: 'Draws in 2d 4h',
    urgency: 'medium',
  },
  {
    id: '4',
    kind: 'auction',
    title: 'Mystic Shield of Protection',
    subtitle: 'Active auction',
    timeLabel: '12h remaining',
    urgency: 'medium',
  },
  {
    id: '5',
    kind: 'calendar',
    title: 'Guild Strategy Meeting',
    subtitle: 'Recurring weekly event',
    timeLabel: 'Tomorrow 20:00',
    urgency: 'low',
  },
  {
    id: '6',
    kind: 'lottery',
    title: 'Monthly Mega Draw',
    subtitle: 'You have 3 tickets',
    timeLabel: 'Draws in 5d',
    urgency: 'low',
  },
];

interface Announcement {
  id: number;
  title: string;
  date: string;
  pinned: boolean;
  content: string;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: '有任何問題，請回報給抽貝比',
    date: '2024/07/24',
    pinned: true,
    content:
      '公會成員若遇到任何系統問題、功能錯誤或其他疑問，請直接私訊抽貝比。回報時請附上問題描述與截圖，以便快速處理。感謝大家的配合！',
  },
  {
    id: 2,
    title: 'Guild raid night every Friday at 21:00',
    date: '2024/07/20',
    pinned: false,
    content:
      'All guild members are welcome to join our weekly raid night every Friday starting at 21:00 server time. Please ensure your gear is up to date and bring consumables. Loot will be distributed via the in-guild auction system. See you there!',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ChipColor = 'danger' | 'warning' | 'success' | 'accent' | 'default';

const KIND_META: Record<
  EventKind,
  {
    icon: string;
    labelKey: string;
    color: ChipColor;
  }
> = {
  auction: { icon: 'solar:hammer-linear', labelKey: 'kindAuction', color: 'warning' },
  checkin: { icon: 'solar:check-circle-linear', labelKey: 'kindCheckin', color: 'success' },
  lottery: { icon: 'solar:ticket-linear', labelKey: 'kindLottery', color: 'accent' },
  calendar: { icon: 'solar:calendar-linear', labelKey: 'kindCalendar', color: 'accent' },
};

const URGENCY_DOT: Record<FeedEvent['urgency'], string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-default-300',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconClass,
  iconBg,
  label,
  value,
}: {
  icon: string;
  iconClass: string;
  iconBg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center flex-1 min-w-0 gap-3 p-3 rounded-xl border border-divider bg-surface-secondary">
      <div className={`${iconBg} p-2 sm:p-2.5 rounded-lg shrink-0`}>
        <Icon icon={icon} width={18} className={iconClass} />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="text-[10px] sm:text-xs text-foreground/40 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-semibold text-foreground leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Overview Carousel ────────────────────────────────────────────────────────

const SLIDES = ['personal', 'guild'] as const;
type Slide = (typeof SLIDES)[number];

function OverviewCarousel() {
  const t = useTranslations('dashboard');
  const [active, setActive] = useState<Slide>('personal');
  const idx = SLIDES.indexOf(active);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Slide>(active);
  const scrollLock = useRef(false);
  activeRef.current = active;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (scrollLock.current) return;
      const currentIdx = SLIDES.indexOf(activeRef.current);
      if (e.deltaY > 0 && currentIdx < SLIDES.length - 1) {
        e.preventDefault();
        scrollLock.current = true;
        setActive(SLIDES[currentIdx + 1]);
        setTimeout(() => {
          scrollLock.current = false;
        }, 600);
      } else if (e.deltaY < 0 && currentIdx > 0) {
        e.preventDefault();
        scrollLock.current = true;
        setActive(SLIDES[currentIdx - 1]);
        setTimeout(() => {
          scrollLock.current = false;
        }, 600);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  return (
    <div ref={containerRef}>
      <Card className="border border-divider shadow-none bg-surface overflow-hidden">
        <Card.Content className="p-0">
          {/* Slide track */}
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {/* ── Slide 0: Personal Overview ── */}
            <div className="min-w-full p-5 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
                {t('personalOverview')}
              </p>

              {/* Stat row */}
              <div className="flex gap-4">
                <StatCard
                  icon="solar:wallet-linear"
                  iconClass="text-primary"
                  iconBg="bg-primary/10"
                  label={t('balance')}
                  value={`$${PERSONAL_STATS.balance.toLocaleString()}`}
                />
                <StatCard
                  icon="solar:check-circle-linear"
                  iconClass="text-success"
                  iconBg="bg-success/10"
                  label={t('checkIns')}
                  value={PERSONAL_STATS.checkinsThisMonth}
                />
                <StatCard
                  icon="solar:hammer-linear"
                  iconClass="text-warning"
                  iconBg="bg-warning/10"
                  label={t('activeAuctions')}
                  value={PERSONAL_STATS.activeAuctions}
                />
                <StatCard
                  icon="solar:star-linear"
                  iconClass="text-accent"
                  iconBg="bg-accent/10"
                  label={t('activityPts')}
                  value={PERSONAL_STATS.activityPoints}
                />
              </div>

              {/* Wallet balance chart */}
              <div className="rounded-xl p-3 -mx-3 transition-colors hover:bg-surface-secondary">
                <p className="text-xs text-foreground/40 mb-2">{t('balanceLast30')}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--separator)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`$${(v ?? 0).toLocaleString()}`, 'Balance']}
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
                      fill="url(#balanceFill)"
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--accent)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Slide 1: Guild Overview ── */}
            <div className="min-w-full p-5 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
                {t('guildOverview')}
              </p>

              {/* Stat row */}
              <div className="flex gap-4">
                <StatCard
                  icon="solar:users-group-rounded-linear"
                  iconClass="text-primary"
                  iconBg="bg-primary/10"
                  label={t('members')}
                  value={GUILD_STATS.members}
                />
                <StatCard
                  icon="solar:calendar-mark-linear"
                  iconClass="text-success"
                  iconBg="bg-success/10"
                  label={t('activeEvents')}
                  value={GUILD_STATS.activeEvents}
                />
                <StatCard
                  icon="solar:wallet-linear"
                  iconClass="text-warning"
                  iconBg="bg-warning/10"
                  label={t('guildBalance')}
                  value={`$${GUILD_STATS.balance.toLocaleString()}`}
                />
              </div>

              {/* Extra metrics row */}
              <div className="flex gap-4">
                <StatCard
                  icon="solar:check-square-linear"
                  iconClass="text-success"
                  iconBg="bg-success/10"
                  label={t('checkInsPerWeek')}
                  value={GUILD_STATS.checkinsThisWeek}
                />
                <StatCard
                  icon="solar:hammer-linear"
                  iconClass="text-warning"
                  iconBg="bg-warning/10"
                  label={t('activeAuctions')}
                  value={GUILD_STATS.activeAuctions}
                />
                <StatCard
                  icon="solar:ticket-linear"
                  iconClass="text-secondary"
                  iconBg="bg-secondary/10"
                  label={t('openLotteries')}
                  value={GUILD_STATS.openLotteries}
                />
              </div>
            </div>
          </div>

          {/* Dot navigation */}
          <div className="flex items-center justify-center gap-2 pb-4">
            {SLIDES.map((slide, i) => (
              <button
                key={slide}
                onPointerDown={() => setActive(slide)}
                aria-label={slide === 'personal' ? t('personalOverview') : t('guildOverview')}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  i === idx ? 'w-6 bg-accent' : 'w-2.5 bg-muted/30 hover:bg-muted/50'
                }`}
              />
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const annModalState = useOverlayState({
    onOpenChange: (isOpen) => {
      if (!isOpen) setSelectedAnn(null);
    },
  });

  return (
    <div className="space-y-5">
      {/* Overview Carousel */}
      <OverviewCarousel />

      {/* Bottom two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Announcements ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:megaphone-linear" width={18} className="text-foreground/40" />
            <h2 className="text-base font-semibold text-foreground">{t('news')}</h2>
          </div>
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Content className="p-0">
              <div className="divide-y divide-divider">
                {ANNOUNCEMENTS.map(ann => (
                  <div
                    key={ann.id}
                    className="px-4 py-3 hover:bg-surface-secondary transition-colors cursor-pointer"
                    onPointerDown={() => { setSelectedAnn(ann); annModalState.open(); }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {ann.pinned && (
                          <Icon
                            icon="solar:pin-linear"
                            width={14}
                            className="text-danger shrink-0 mt-0.5"
                          />
                        )}
                        <p className="text-sm text-foreground truncate">{ann.title}</p>
                      </div>
                      <span className="text-xs text-foreground/40 shrink-0">{ann.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </section>

        {/* ── Upcoming Events ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:bell-linear" width={18} className="text-foreground/40" />
            <h2 className="text-base font-semibold text-foreground">{t('upcomingEvents')}</h2>
          </div>
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Content className="p-0">
              <div className="divide-y divide-divider">
                {INCOMING_EVENTS.map(event => {
                  const meta = KIND_META[event.kind];
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      {/* Urgency dot */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[event.urgency]}`}
                      />

                      {/* Kind icon */}
                      <div className="p-1.5 rounded-md bg-default-100 shrink-0">
                        <Icon icon={meta.icon} width={14} className="text-foreground/50" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-foreground/40 truncate">{event.subtitle}</p>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Chip size="sm" variant="secondary" color={meta.color}>
                          {t(meta.labelKey as any)}
                        </Chip>
                        <span className="text-xs text-foreground/40">{event.timeLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card.Content>
          </Card>
        </section>
      </div>

      {/* ── Announcement modal ── */}
      <Modal state={annModalState}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog className="bg-surface border border-divider">
            <Modal.CloseTrigger />
            <Modal.Header className="text-center items-center border-b border-divider pb-3">
              <div className="flex items-start gap-3 pr-10">
                {selectedAnn?.pinned && (
                  <Icon icon="solar:pin-bold" width={16} className="text-danger shrink-0 mt-0.5" />
                )}
                <Modal.Heading className="text-base font-semibold text-foreground leading-snug">
                  {selectedAnn?.title}
                </Modal.Heading>
              </div>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <p className="text-sm text-foreground/50">{selectedAnn?.date}</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {selectedAnn?.content}
              </p>
            </Modal.Body>

            <Modal.Footer className="border-t border-divider pt-3">
              <Button slot="close" variant="secondary" size="sm">
                {t('close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
