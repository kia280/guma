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

- Do not use raw size classes (`text-xs` to `text-3xl`), pixel sizes (`text-[10px]`), or inline `fontSize` for text. The only exceptions are: the notification count badge (HeroUI `<Badge size="sm">`, 10px), the brand wordmark (`Logo`), the font size preview buttons on the Preference page, and form inputs, which keep `text-base` (16px) so iOS does not zoom in on focus.
- Charts (Recharts) render SVG and need numeric sizes. Use `fontSize: 12` for axis ticks and tooltips.
- Do not use `font-bold`. Roles use 600 for emphasis; bold is reserved for the brand wordmark and the notification count badge.
- Do not use `uppercase` or letter spacing. Labels are translated and often Chinese, where both look wrong. The brand wordmark is the only exception. The sidebar guild name is user content, so it uses `type-subheading` without these overrides.
- `<Modal.Heading>` keeps HeroUI's default style. HeroUI buttons and inputs keep their built-in sizes. Chips follow the convention in Chips and Badges below.
- The app font is Noto Sans TC, loaded with `next/font` in `src/app/layout.tsx`. Do not set `font-family` in components. The dev panel's palette previews may override it for evaluation only.

### Chips and Badges

A chip's text is the same size as the text around it. `globals.css` sets `font-size: inherit` on `.chip`, so a chip takes its size from its parent instead of HeroUI's fixed 12px, and it scales with the font size preference like every role.

- Use `size="sm"` for every chip. The size prop only sets padding and height (20px at the default font size), never the text size.
- Do not put `type-*`, `text-*`, `leading-*`, or height classes on a chip. Put the role on the chip's shared parent (the row, stack, or header that also holds the adjacent text), and drop the now redundant role from the siblings.
- Pick the parent's role from the text the chip sits with:
  - Inline in a list row, table cell, or settings row next to body text: `type-body`.
  - Stacked with metadata in a card (a status above a caption timestamp, a tag row under an item name, a status above a card title): `type-caption`.
  - Detail page headers (status and tag chips above the page title, next to the body date line): `type-body`.
  - Next to a heading role (a count beside a card or section title, a status beside a price): `type-body`. Chips never take heading sizes.
  - Inside HeroUI tabs, list box items, and table cells the component already sets 14px, so no extra class is needed.
- Align a chip in a row with `items-center`; a stretched chip grows to the row's line height.
- A chip inside a button or link must not be the whole target when it is smaller than 24px. Give the wrapping button `min-h-6` and center the chip in it.
- Chips are for short statuses, tags, and counts. Do not stretch a chip into a full-width bar. A card footer that states why the card cannot be opened uses `CardFooterStatus`, which matches `CardLinkHint`.
- The one exception is the header wallet balance, which uses `size="lg"` (28px) to line up with the 28px header buttons and avatar.
- Notification counts use HeroUI `<Badge size="sm" color="danger">` on a `Badge.Anchor`, with the accessible count on the button's `aria-label` and the badge `aria-hidden`. Status dots use `<Badge size="sm">` with no content.

## Text Colors

Text uses a hierarchy of theme-aware tokens defined in `globals.css`. Each level is darker in the light theme than a plain opacity would be, so secondary text stays readable on white:

| Class | Usage | Light | Dark |
|-------|-------|-------|------|
| `text-foreground` | Primary text (headings, body, values) | 100% | 100% |
| `text-foreground/90` | Near-primary emphasis | 90% | 90% |
| `text-soft` | Labels and text with medium emphasis | 80% | 64% |
| `text-subtle` | Secondary text, descriptions, icons | 70% | 56% |
| `text-hint` | Captions, placeholders, hints, timestamps | 62% | 48% |
| `text-disabled` | Disabled / very low emphasis (empty states) | 45% | 30% |

Do not use `text-foreground/60`, `/50`, `/40`, or `/30` directly; use the tokens above. `text-hint` meets WCAG AA (4.5:1) on `bg-surface` in both themes and every color scheme.

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
| `bg-accent` | `--accent` | `oklch(53.5%)` | Accent-colored backgrounds |
| `bg-danger` | `--danger` | `oklch(54%)` | Danger backgrounds (badges, alerts) |
| `bg-success` | `--success` | `oklch(51%)` | Success backgrounds |
| `bg-warning` | `--warning` | `oklch(54%)` | Warning backgrounds |

Light values are for the default Guild Gold scheme; see Color Schemes below.

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

## Color Schemes

Color schemes are under evaluation: developers pick one in the dev tools panel's Palette tab (`NEXT_PUBLIC_DEV_TOOLS=true`), independently of the light, dark, or system theme. Users always get the default scheme. Every scheme defines its own light and dark variant, so components never need to know which scheme is active: they use the semantic tokens above and the scheme changes their values.

| Id | Name | Character |
|----|------|-----------|
| `classic` | Guild Gold (default) | Neutral grays, antique gold accent |
| `pine` | Pine | Cool mist neutrals, deep teal accent |
| `frost` | Frost | Blue-gray neutrals, steel blue accent |
| `arcane` | Arcane | Violet-tinted neutrals, amethyst accent |
| `garnet` | Garnet | Rose-tinted neutrals, garnet accent |
| `ink` | Ink | Near-neutral paper, ink-black accent (bone white in dark) |

### How it works

- `classic` is the base `:root` / `.dark` tokens in `src/app/globals.css`. Every other scheme is a `[data-palette="<id>"]` block for light and a `.dark[data-palette="<id>"], .dark [data-palette="<id>"]` block for dark, each overriding the full set of neutral, accent, focus, and status tokens.
- The choice is stored in `localStorage` (`guma-palette`) and applied to `<html data-palette>` by an inline script in `src/app/layout.tsx` before first paint, so there is no flash. The script is only rendered when dev tools are enabled. `src/lib/dev-palette.ts` holds the list, `getPalette`, and `setPalette`.
- `data-palette` also works on any element, which is how the dev panel previews each scheme in the current theme. Only raw tokens (`--accent`, `--surface`, `--muted`, ...) follow a nested `data-palette`; derived tokens such as `--fg-hint` or HeroUI's `--accent-hover` resolve on `<html>`.

### Rules for a scheme

- Neutrals share one hue and change only lightness; chroma stays low (about 0.003 to 0.011) so the tint is felt rather than seen. Surfaces keep the elevation steps of the default scheme.
- Light variants use a deep accent (L about 50%) with near-white `--accent-foreground`; dark variants use a bright accent (L about 75%) with a near-black foreground tinted with the accent hue. Ink pushes this to near-black and near-white. Status colors follow the same rule.
- Every pair must meet WCAG AA (4.5:1): text and text tokens on `background`, `surface`, and `surface-secondary`; `accent`, `success`, `warning`, and `danger` as text on `surface` and on their `/10` tint; each `*-foreground` on its color; each `*-soft-foreground` on its soft background. `--focus` must reach 3:1 against `--background`.
- Keep the accent clearly apart from the status hues (danger near 25, warning near 55 to 70, success near 140 to 152). When an accent sits near one of them, shift that status hue for the scheme instead of weakening the accent, as Pine does with success and Garnet with danger.
- Add a new scheme's id to `PALETTES` in `src/lib/dev-palette.ts` and its name and description to `devTools.palettes` in both message catalogs.

## Border Colors

| Class | Usage |
|-------|-------|
| `border-divider` | Dividers, and borders on elements nested inside a card |
| `border-separator` | Separator lines |

`border-divider` is `--border` at 50% opacity, so dividers and nested outlines stay soft. HeroUI controls (inputs, tooltips) keep the full-strength `--border`.

## Card Pattern

All cards must follow this pattern:

```tsx
<Card className="border border-transparent shadow-edge bg-surface">
```

- `shadow-edge` (`--shadow-edge` in `globals.css`) replaces the hard outline with a slightly feathered edge: a 3px blur in the `--border` color. The transparent border keeps the card's size and lets `hover:border-foreground/20` draw a crisp line on hover.
- Card-like containers that sit directly on the page (stat tiles, detail page sections, the calendar grid) use the same three classes.
- Elements nested inside a card (`bg-surface-secondary` tiles, list rows, inner sections) keep `border border-divider`.
- Overlays (modals, popovers, dropdowns, tooltips, toasts) get the same edge in the dark theme through `--overlay-shadow`, so do not add `border border-divider` to them. In the light theme they keep HeroUI's elevation shadow; toasts use the edge in both themes.
- The feather extends about 2px past the card. A parent that clips (`overflow-hidden`, `overflow-y-auto`) needs room for it: add `p-1` and cancel it with `-m-1`.

## Empty States

Every empty state that fills a card, a card section, or a modal body uses `<EmptyContent>` from `src/components/AsyncContent.tsx`, so they all share one size:

```tsx
<EmptyContent icon="solar:backpack-linear" title={t('noItems')} description={t('noItemsHint')} />
```

- The pattern is a `size-10 text-disabled` icon (40px at the default font size), a `type-subheading text-soft` title, an optional `type-body text-subtle` description, and `py-12` of vertical padding. The title is `text-soft`, not `text-foreground`, so an empty panel reads quieter than real content. The icon is sized in rem, not with a pixel `width`, so it grows with the title next to it when the font size preference changes. Do not hand-roll smaller or larger variants.
- The empty-state title never exceeds the heading of the card or section it sits in. Under a `type-subheading` (or larger) heading, and where there is no heading, use the default `size="md"`. Under a smaller heading (`type-caption` or `type-label`, such as the dashboard balance chart or the auction bid history) use `size="sm"`: a `size-8` icon, a `type-label` title, a `type-caption` description, and `py-8`.
- The title is a short phrase without a trailing period. Put any explanation of what will appear there in `description`, as a full sentence.
- Pass `minHeight` instead of relying on the padding when the block replaces content with a fixed height (a chart), so the panel does not jump between states.
- Pass an action as children (a `size="sm"` button); it renders below the text.
- The block has no surface of its own. Inside a card it sits on the card; on the lottery and auction list pages it sits directly on the page background, without a wrapping card.
- This does not apply to `renderEmptyState` in list boxes and combo boxes, to not-found pages, to error states with a retry, or to a one-line placeholder that stands in for a single value inside a form or a small grid card.

## Interactive Rows

Clickable rows in a list (announcements, events, navigation items) use inset, rounded rows instead of full-width rows with dividers:

```tsx
<Card.Content className="p-1.5">
  <ul className="flex flex-col gap-0.5">
    <li>
      <button className="w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
```

- Use `<button>` for rows that open something and `<Link>` for rows that navigate, so they work with the keyboard.
- Cards themselves use `hover:border-foreground/20` instead of a background change.

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
