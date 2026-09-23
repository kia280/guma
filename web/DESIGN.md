# Design System

This document defines the color conventions used across the Guma frontend. All colors must use HeroUI v3 CSS variables — no hardcoded hex/rgb values or Tailwind-specific color classes (e.g. `text-yellow-500`, `bg-slate-400`).

## Text Colors

All text colors use `text-foreground` with opacity levels:

| Class | Usage |
|-------|-------|
| `text-foreground` | Primary text (headings, body, values) |
| `text-foreground/90` | Near-primary emphasis |
| `text-foreground/60` | Section titles, labels with medium emphasis |
| `text-foreground/50` | Secondary text, descriptions, icons |
| `text-foreground/40` | Tertiary text, placeholders, hints, timestamps |
| `text-foreground/30` | Disabled / very low emphasis (empty states) |

### Semantic Text Colors

| Class | Usage |
|-------|-------|
| `text-muted` | Muted text (uses `--muted` variable) |
| `text-accent` | Accent-colored text |
| `text-success` | Success states |
| `text-warning` | Warning states |
| `text-danger` | Error / destructive states |
| `text-danger-foreground` | Text on danger backgrounds |
| `text-primary-foreground` | Text on primary backgrounds |

## Background Colors

Backgrounds follow a layered hierarchy to ensure visual separation between components:

| Class | CSS Variable | Light Mode | Usage |
|-------|-------------|------------|-------|
| `bg-background` | `--background` | `oklch(97.02%)` light gray | Page background, content area |
| `bg-surface` | `--surface` | `oklch(100%)` white | Cards, panels, non-overlay components |
| `bg-surface-secondary` | `--surface-secondary` | `oklch(95.24%)` off-white | Nested elements inside cards |
| `bg-surface-tertiary` | `--surface-tertiary` | `oklch(93.73%)` | Deeper nested elements |
| `bg-overlay` | `--overlay` | `oklch(100%)` white | Modals, popovers, tooltips |
| `bg-default` | `--default` | `oklch(94%)` | Icon backgrounds, selected sidebar items |
| `bg-accent` | `--accent` | `oklch(62%)` | Accent-colored backgrounds |
| `bg-danger` | `--danger` | `oklch(65.32%)` | Danger backgrounds (badges, alerts) |
| `bg-success` | `--success` | `oklch(73.29%)` | Success backgrounds |
| `bg-warning` | `--warning` | `oklch(78.19%)` | Warning backgrounds |

### Background Hierarchy (for visual depth)

```
bg-background          ← page / content area
  └─ bg-surface        ← cards, sections
       └─ bg-surface-secondary  ← nested items inside cards
            └─ bg-surface-tertiary  ← deeper nested elements
```

### Tinted Backgrounds (with opacity)

Use semantic colors with opacity for subtle tinted backgrounds:

| Pattern | Usage |
|---------|-------|
| `bg-primary/10` | Primary icon background |
| `bg-success/10` | Success icon background |
| `bg-warning/10` | Warning icon background |
| `bg-danger/10` | Danger icon / alert background |
| `bg-accent/10` | Accent tinted background |

## Border Colors

| Class | Usage |
|-------|-------|
| `border-divider` | Standard borders on cards, sections |
| `border-separator` | Separator lines |

## Card Pattern

All cards must follow this pattern:

```tsx
<Card className="border border-divider shadow-none bg-surface">
```

## Chart / Inline Style Colors

When using CSS variables in inline styles (e.g. Recharts), use `var(--variable)`:

| Variable | Usage |
|----------|-------|
| `var(--accent)` | Chart lines, fills |
| `var(--separator)` | Grid lines |
| `var(--muted)` | Axis labels |
| `var(--foreground)` | Tooltip text |
| `var(--overlay)` | Tooltip background |
| `var(--border)` | Tooltip border |
| `var(--danger)` | Danger-colored elements |
| `var(--success)` | Success-colored elements |
| `var(--warning)` | Warning-colored elements |

## DO NOT USE

- Hardcoded hex colors (`#fff`, `#5865F2`)
- RGB/RGBA values (`rgba(0, 0, 0, 0.5)`)
- Tailwind-specific colors (`text-yellow-500`, `bg-slate-400`, `text-zinc-600`)
- Old HeroUI v2 variables (`--heroui-*`, `bg-content1`, `bg-content2`)
- `text-white` / `text-black` (use `text-foreground` or semantic foreground tokens)
- `text-default-*` (use `text-foreground/*` with opacity instead)
