export interface DevFont {
  id: string;
  googleFamilies: string[];
  stack?: string;
}

export const DEFAULT_FONT_ID = 'current';

export const DEV_FONTS: DevFont[] = [
  { id: DEFAULT_FONT_ID, googleFamilies: [] },
  {
    id: 'nunito-wenkai',
    googleFamilies: ['Nunito:wght@400;500;600;700', 'LXGW WenKai TC:wght@400;700'],
    stack: "'Nunito', 'LXGW WenKai TC', sans-serif",
  },
  {
    id: 'inter-noto',
    googleFamilies: ['Inter:wght@400;500;600;700', 'Noto Sans TC:wght@400;500;600;700'],
    stack: "'Inter', 'Noto Sans TC', sans-serif",
  },
  {
    id: 'jakarta-chiron',
    googleFamilies: ['Plus Jakarta Sans:wght@400;500;600;700', 'Chiron Hei HK:wght@400;500;600;700'],
    stack: "'Plus Jakarta Sans', 'Chiron Hei HK', sans-serif",
  },
];

const STORAGE_KEY = 'guma-dev-font';

export function getDevFontId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return DEV_FONTS.some((f) => f.id === stored) ? stored! : DEFAULT_FONT_ID;
  } catch {
    return DEFAULT_FONT_ID;
  }
}

export function saveDevFontId(id: string): void {
  try {
    if (id === DEFAULT_FONT_ID) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    return;
  }
}

export function loadDevFont(font: DevFont): void {
  if (font.googleFamilies.length === 0) return;
  const linkId = `guma-dev-font-${font.id}`;
  if (document.getElementById(linkId)) return;
  const query = font.googleFamilies
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}`)
    .join('&');
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  document.head.appendChild(link);
}

export function applyDevFont(id: string): void {
  const font = DEV_FONTS.find((f) => f.id === id);
  if (font?.stack) {
    loadDevFont(font);
    document.body.style.fontFamily = font.stack;
  } else {
    document.body.style.removeProperty('font-family');
  }
}
