# Design System

This document defines the color and typography conventions used across the Guma frontend. All colors must use HeroUI v3 CSS variables — no hardcoded hex/rgb values or Tailwind-specific color classes (e.g. `text-yellow-500`, `bg-slate-400`).

## Typography

Typography is built from named roles. Each role fixes size, line height, and weight together, so pick the role for what the text *is* (a page title, a caption) instead of combining size and weight classes. Roles are defined with `@utility` in `src/app/globals.css`.

### Principles

- **Chinese first.** Most text is Traditional Chinese, which needs larger sizes and more line height than Latin text to stay readable. Body text is 14px with a 22px line height, long-form text is 15px with 26px, and nothing is smaller than 13px.
- **Few sizes, clear steps.** Eight roles cover the whole app. Adjacent levels differ by size *and* weight, so hierarchy is visible at a glance.
- **Scales with the user.** Every role is rem-based, so the Preference page's font size setting (100%, 112.5%, 125%) scales all text consistently.
- **Numbers line up.** Numeric roles use tabular figures so balances and amounts align in lists and tables.

### Roles

| Role | Size / line height | Weight | Use for |
|------|--------------------|--------|---------|
| `type-display` | 32 / 40 | 600, tabular | Key figures: wallet balance, guild bank balance, prize pool, current bid, error codes |
| `type-title` | 24 / 32 | 600 | Page titles (`<PageHeader>`), detail page titles, stat tile values (add `tabular-nums`) |
| `type-heading` | 18 / 28 | 600 | Section headings outside cards (dashboard sections), prices in cards (add `tabular-nums`) |
| `type-subheading` | 16 / 24 | 600 | Card header titles, item titles in grid cards, empty-state titles, sub-sections inside a card |
| `type-prose` | 15 / 26 | 400 | Long-form reading: announcements, terms, descriptions on detail pages |
| `type-body` | 14 / 22 | 400 | Default UI text: list rows, table cells, form text, card descriptions |
| `type-caption` | 13 / 20 | 400 | Timestamps, metadata, helper text, stat tile labels |
| `type-label` | 13 / 20 | 500 | Short labels: section overlines, tags, field labels in dense layouts |

Sizes are in pixels at the default font size.

### Combining roles with other classes

- Add a color from Text Colors below. Typical pairings: titles and body use `text-foreground`, descriptions use `text-subtle`, captions use `text-hint`.
- `type-body`, `type-prose`, and `type-caption` have no weight, so you may add `font-medium` for emphasis (for example a list item's name).
- Do not add size, weight, `leading-*`, or `tracking-*` classes to heading roles (`type-display` to `type-subheading`). If none fits, the design needs a new role, not an override.
- Add `tabular-nums` to any role that shows numbers meant to be compared.
- Use `truncate` (with `min-w-0` on the flex parent) for single-line titles in cards and lists.

### Rules

- Do not use raw size classes (`text-xs` to `text-3xl`), pixel sizes (`text-[10px]`), or inline `fontSize` for text. The only exceptions are: the notification count badge, the brand wordmark (`Logo`, sidebar), the font size preview buttons on the Preference page, and form inputs, which keep `text-base` (16px) so iOS does not zoom in on focus.
- Charts (Recharts) render SVG and need numeric sizes. Use `fontSize: 12` for axis ticks and tooltips.
- Do not use `font-bold`. Roles use 600 for emphasis; bold is reserved for the brand wordmark and the notification count badge.
- Do not use `uppercase` or letter spacing. Labels are translated and often Chinese, where both look wrong. The brand wordmark is the only exception.
- `<Modal.Heading>` keeps HeroUI's default style. HeroUI components (buttons, chips, inputs) keep their built-in sizes.
- The app font is Noto Sans TC, loaded with `next/font` in `src/app/layout.tsx`. Do not set `font-family` in components. The dev panel's palette previews may override it for evaluation only.

## Text Colors

Text uses a hierarchy of theme-aware tokens defined in `globals.css`. Each level is darker in the light theme than a plain opacity would be, so secondary text stays readable on white:

| Class | Usage | Light | Dark |
|-------|-------|-------|------|
| `text-foreground` | Primary text (headings, body, values) | 100% | 100% |
| `text-foreground/90` | Near-primary emphasis | 90% | 90% |
| `text-soft` | Labels and text with medium emphasis | 80% | 60% |
| `text-subtle` | Secondary text, descriptions, icons | 70% | 50% |
| `text-hint` | Captions, placeholders, hints, timestamps | 62% | 40% |
| `text-disabled` | Disabled / very low emphasis (empty states) | 45% | 30% |

Do not use `text-foreground/60`, `/50`, `/40`, or `/30` directly; use the tokens above.

### Semantic Text Colors

| Class | Usage |
|-------|-------|
| `text-muted` | Muted text (uses `--muted` variable) |
| `text-accent` | Accent-colored text |
| `text-success` | Success states |
| `text-warning` | Warning states |
| `text-danger` | Error / destructive states |
| `text-danger-foreground` | Text on danger backgrounds |
| `text-accent-foreground` | Text on accent backgrounds |

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
| `bg-accent/10` | Accent icon background, selected state |
| `bg-success/10` | Success icon background |
| `bg-warning/10` | Warning icon background |
| `bg-danger/10` | Danger icon / alert background |

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
- `text-default-*` and `text-foreground/60`, `/50`, `/40`, `/30` (use `text-soft`, `text-subtle`, `text-hint`, `text-disabled`)
- Raw size classes, pixel font sizes, or inline `fontSize` for text (use a `type-*` role; see Typography > Rules for exceptions)
- `font-bold`, `uppercase`, and `tracking-*` on text (see Typography > Rules)
- `primary` colors (`bg-primary`, `text-primary`, ...) do not exist in HeroUI v3; use `accent`
- Numbered default scales (`bg-default-100`, `border-default-400`) do not exist in HeroUI v3; use `bg-default`, `bg-surface-*`, or `border-divider`
