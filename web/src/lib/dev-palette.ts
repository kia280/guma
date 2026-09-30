export const PALETTES = ['classic', 'pine', 'frost', 'arcane', 'garnet', 'ink'] as const;

export type Palette = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: Palette = 'classic';

const STORAGE_KEY = 'guma-palette';

function isPalette(value: unknown): value is Palette {
  return PALETTES.includes(value as Palette);
}

const listeners = new Set<() => void>();

export function subscribePalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const storedPalettes = PALETTES.filter(palette => palette !== DEFAULT_PALETTE);

export const paletteInitScript = `try{var p=localStorage.getItem('${STORAGE_KEY}');if(${JSON.stringify(storedPalettes)}.indexOf(p)>=0)document.documentElement.dataset.palette=p}catch(e){}`;

export function getPalette(): Palette {
  const current = document.documentElement.dataset.palette;
  return isPalette(current) ? current : DEFAULT_PALETTE;
}

export function setPalette(palette: Palette): void {
  const root = document.documentElement;
  if (palette === DEFAULT_PALETTE) {
    delete root.dataset.palette;
  } else {
    root.dataset.palette = palette;
  }
  listeners.forEach(listener => listener());
  try {
    if (palette === DEFAULT_PALETTE) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, palette);
    }
  } catch {
    return;
  }
}
