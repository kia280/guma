'use client';

import React from 'react';
import { cn } from '@heroui/react';

export type WheelEntry = {
  id: string;
  label: string;
  weight: number;
  detail?: string;
};

type LotteryWheelProps = {
  entries: WheelEntry[];
  winnerId?: string;
  spinKey: number;
  isRevealed: boolean;
  onSpinEnd: () => void;
  className?: string;
};

type Slice = WheelEntry & { start: number; end: number; mid: number };

type HoverState = { slice: Slice; x: number; y: number };

const SIZE = 440;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 6;
const FULL_TURNS = 6;
const SPIN_MS = 5200;
const REDUCED_SPIN_MS = 800;
const LABEL_MAX = 10;
const MIN_LABEL_ANGLE = 6;

function pointAt(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function slicePath(start: number, end: number) {
  const a = pointAt(start, RADIUS);
  const b = pointAt(end, RADIUS);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${b.x} ${b.y} Z`;
}

function truncate(label: string) {
  const chars = Array.from(label);
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX - 1).join('')}…` : label;
}

function buildSlices(entries: WheelEntry[]): Slice[] {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  let cursor = 0;
  return entries.map(entry => {
    const span = (entry.weight / total) * 360;
    const slice = { ...entry, start: cursor, end: cursor + span, mid: cursor + span / 2 };
    cursor += span;
    return slice;
  });
}

export function LotteryWheel({ entries, winnerId, spinKey, isRevealed, onSpinEnd, className }: LotteryWheelProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = React.useState(0);
  const [duration, setDuration] = React.useState(SPIN_MS);
  const [hover, setHover] = React.useState<HoverState | null>(null);
  const slices = React.useMemo(() => buildSlices(entries), [entries]);
  const winner = slices.find(slice => slice.id === winnerId);

  React.useEffect(() => {
    if (spinKey === 0 && isRevealed && winner) setRotation(360 - winner.mid);
  }, [spinKey, isRevealed, winner?.mid]);

  React.useEffect(() => {
    if (spinKey === 0 || !winner) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setDuration(reduced ? REDUCED_SPIN_MS : SPIN_MS);
    const jitter = (Math.random() - 0.5) * (winner.end - winner.start) * 0.6;
    const target = 360 - winner.mid + jitter;
    const frame = requestAnimationFrame(() => {
      setRotation(current => current - (current % 360) + FULL_TURNS * 360 + target);
    });
    return () => cancelAnimationFrame(frame);
  }, [spinKey]);

  const trackHover = (slice: Slice) => (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ slice, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative mx-auto aspect-square w-full max-w-[440px]', className)}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" role="img" aria-label={winner?.label}>
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
            transition: spinKey === 0 ? 'none' : `transform ${duration}ms cubic-bezier(0.12, 0.8, 0.18, 1)`,
          }}
          onTransitionEnd={event => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') onSpinEnd();
          }}
        >
          {slices.map((slice, i) => {
            const isWinner = isRevealed && slice.id === winnerId;
            const isHovered = hover?.slice.id === slice.id;
            const span = slice.end - slice.start;
            const label = pointAt(slice.mid, RADIUS - 14);
            const isFlipped = slice.mid > 180;
            const fill = isWinner
              ? 'fill-accent'
              : isHovered
                ? 'fill-accent/45'
                : i % 2 === 0
                  ? 'fill-accent/25'
                  : 'fill-accent/10';
            return (
              <g key={slice.id} onPointerMove={trackHover(slice)} onPointerEnter={trackHover(slice)}>
                {slices.length === 1 ? (
                  <circle cx={CENTER} cy={CENTER} r={RADIUS} className={cn('stroke-surface', fill)} strokeWidth={1.5} />
                ) : (
                  <path d={slicePath(slice.start, slice.end)} className={cn('stroke-surface transition-colors', fill)} strokeWidth={1.5} />
                )}
                {span >= MIN_LABEL_ANGLE && (
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={isFlipped ? 'start' : 'end'}
                    dominantBaseline="middle"
                    transform={`rotate(${isFlipped ? slice.mid + 90 : slice.mid - 90} ${label.x} ${label.y})`}
                    className={cn('type-caption font-medium pointer-events-none', isWinner ? 'fill-accent-foreground' : 'fill-foreground')}
                  >
                    {truncate(slice.label)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className="fill-none stroke-divider pointer-events-none" strokeWidth={2} />
        <circle cx={CENTER} cy={CENTER} r={28} className="fill-surface stroke-divider" strokeWidth={2} />
        <circle cx={CENTER} cy={CENTER} r={8} className="fill-accent" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-1/2 -top-1 size-8 -translate-x-1/2 fill-danger drop-shadow"
        aria-hidden="true"
      >
        <path d="M12 22 L3 4 H21 Z" />
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-divider bg-overlay px-2.5 py-1.5 shadow-overlay whitespace-nowrap"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <p className="type-label text-foreground">{hover.slice.label}</p>
          {hover.slice.detail && <p className="type-caption text-hint tabular-nums">{hover.slice.detail}</p>}
        </div>
      )}
    </div>
  );
}
