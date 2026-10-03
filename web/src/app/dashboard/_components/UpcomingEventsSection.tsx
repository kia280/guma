'use client';

import { Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyContent } from '@/components/AsyncContent';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import type { FeedEvent } from '@/types/dashboard';
import { KIND_META, URGENCY_DOT } from '../_lib/event-kinds';

export function UpcomingEventsSection({ events }: { events: FeedEvent[] }) {
  const t = useTranslations('dashboard');
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon icon="solar:bell-linear" width={18} className="text-hint" />
        <h2 className="type-heading text-foreground">{t('upcomingEvents')}</h2>
      </div>
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Content className="p-1.5">
          {events.length === 0 ? (
            <EmptyContent icon="solar:bell-linear" title={t('noUpcomingEvents')} />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {events.map(event => {
                const meta = KIND_META[event.kind];
                const kindLabel = t(meta.labelKey as any);
                return (
                  <li key={event.id}>
                    <Link href={meta.href} className={`flex items-center gap-3 ${LIST_ROW_CLASS}`}>
                      {/* Urgency dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[event.urgency]}`} />

                      {/* Kind icon */}
                      <div className="p-1.5 rounded-md bg-default shrink-0 max-sm:hidden">
                        <Icon icon={meta.icon} width={14} className="text-subtle" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="type-body font-medium text-foreground line-clamp-2 wrap-break-word sm:line-clamp-1">
                          {event.title}
                        </p>
                        <p className="type-caption text-hint line-clamp-2 sm:line-clamp-1">{event.subtitle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 type-caption sm:hidden">
                          <Chip size="sm" variant="secondary" color={meta.color}>
                            {kindLabel}
                          </Chip>
                          <span className="text-hint">{event.timeLabel}</span>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-col items-end gap-1 shrink-0 type-caption max-sm:hidden">
                        <Chip size="sm" variant="secondary" color={meta.color}>
                          {kindLabel}
                        </Chip>
                        <span className="text-hint">{event.timeLabel}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
