export const FONT_SIZES = ['default', 'large', 'x-large'] as const;

export type FontSize = (typeof FONT_SIZES)[number];

const STORAGE_KEY = 'guma-font-size';

function isFontSize(value: unknown): value is FontSize {
  return FONT_SIZES.includes(value as FontSize);
}

export const fontSizeInitScript = `try{var s=localStorage.getItem('${STORAGE_KEY}');if(s==='large'||s==='x-large')document.documentElement.dataset.fontSize=s}catch(e){}`;

export function getFontSize(): FontSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFontSize(stored) ? stored : 'default';
  } catch {
    return 'default';
  }
}

export function setFontSize(size: FontSize): void {
  const root = document.documentElement;
  if (size === 'default') {
    delete root.dataset.fontSize;
  } else {
    root.dataset.fontSize = size;
  }
  try {
    if (size === 'default') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, size);
    }
  } catch {
    return;
  }
}
