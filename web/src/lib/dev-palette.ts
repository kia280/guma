export type PaletteTokens = Record<`--${string}`, string>;

export interface PaletteFont {
  googleFamilies: string[];
  stack: string;
}

export interface DevPalette {
  id: string;
  tokens: PaletteTokens;
  font?: PaletteFont;
}

const warmNeutrals: PaletteTokens = {
  '--background': 'oklch(97.5% 0.004 85)',
  '--surface': 'oklch(100% 0 0)',
  '--surface-secondary': 'oklch(95.5% 0.005 85)',
  '--surface-tertiary': 'oklch(93.5% 0.006 85)',
  '--default': 'oklch(94% 0.006 85)',
  '--border': 'oklch(90% 0.006 85)',
  '--separator': 'oklch(92% 0.005 85)',
  '--scrollbar': 'oklch(87% 0.006 85)',
};

const coolNeutrals: PaletteTokens = {
  '--background': 'oklch(97.5% 0.004 265)',
  '--surface': 'oklch(100% 0 0)',
  '--surface-secondary': 'oklch(95.5% 0.006 265)',
  '--surface-tertiary': 'oklch(93.5% 0.007 265)',
  '--default': 'oklch(94% 0.007 265)',
  '--border': 'oklch(90% 0.007 265)',
  '--separator': 'oklch(92% 0.006 265)',
  '--scrollbar': 'oklch(87% 0.007 265)',
};

const readableStatus: PaletteTokens = {
  '--success': 'oklch(53% 0.15 145)',
  '--success-foreground': 'oklch(99% 0 0)',
  '--warning': 'oklch(57% 0.16 55)',
  '--warning-foreground': 'oklch(99% 0 0)',
  '--danger': 'oklch(57% 0.21 18)',
  '--danger-foreground': 'oklch(99% 0 0)',
};

export const DEFAULT_PALETTE_ID = 'current';

export const DEV_PALETTES: DevPalette[] = [
  { id: DEFAULT_PALETTE_ID, tokens: {} },
  {
    id: 'sun-gold',
    tokens: {
      ...warmNeutrals,
      ...readableStatus,
      '--accent': 'oklch(84% 0.165 88)',
      '--accent-foreground': 'oklch(21% 0.02 85)',
      '--focus': 'oklch(62% 0.14 75)',
    },
    font: {
      googleFamilies: ['Nunito:wght@400;500;600;700', 'LXGW WenKai TC:wght@400;700'],
      stack: "'Nunito', 'LXGW WenKai TC', sans-serif",
    },
  },
  {
    id: 'ink-gold',
    tokens: {
      ...warmNeutrals,
      ...readableStatus,
      '--accent': 'oklch(24% 0.01 85)',
      '--accent-foreground': 'oklch(99% 0 0)',
      '--focus': 'oklch(78% 0.16 85)',
    },
    font: {
      googleFamilies: ['Inter:wght@400;500;600;700', 'Noto Sans TC:wght@400;500;600;700'],
      stack: "'Inter', 'Noto Sans TC', sans-serif",
    },
  },
  {
    id: 'indigo',
    tokens: {
      ...coolNeutrals,
      ...readableStatus,
      '--accent': 'oklch(52% 0.19 275)',
      '--accent-foreground': 'oklch(99% 0 0)',
      '--focus': 'oklch(52% 0.19 275)',
    },
    font: {
      googleFamilies: ['Plus Jakarta Sans:wght@400;500;600;700', 'Chiron Hei HK:wght@400;500;600;700'],
      stack: "'Plus Jakarta Sans', 'Chiron Hei HK', sans-serif",
    },
  },
];

const STORAGE_KEY = 'guma-dev-palette';

const ALL_TOKEN_NAMES = [...new Set(DEV_PALETTES.flatMap((p) => Object.keys(p.tokens)))];

export function getDevPaletteId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return DEV_PALETTES.some((p) => p.id === stored) ? stored! : DEFAULT_PALETTE_ID;
  } catch {
    return DEFAULT_PALETTE_ID;
  }
}

export function saveDevPaletteId(id: string): void {
  try {
    if (id === DEFAULT_PALETTE_ID) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    return;
  }
}

export function loadPaletteFont(palette: DevPalette): void {
  if (!palette.font) return;
  const linkId = `guma-dev-palette-font-${palette.id}`;
  if (document.getElementById(linkId)) return;
  const query = palette.font.googleFamilies
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}`)
    .join('&');
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  document.head.appendChild(link);
}

export function applyDevPalette(id: string, isLight: boolean): void {
  const palette = DEV_PALETTES.find((p) => p.id === id);
  const style = document.documentElement.style;
  for (const name of ALL_TOKEN_NAMES) {
    style.removeProperty(name);
  }
  if (isLight) {
    for (const [name, value] of Object.entries(palette?.tokens ?? {})) {
      style.setProperty(name, value);
    }
  }

  if (palette?.font) {
    loadPaletteFont(palette);
    document.body.style.fontFamily = palette.font.stack;
  } else {
    document.body.style.removeProperty('font-family');
  }
}
