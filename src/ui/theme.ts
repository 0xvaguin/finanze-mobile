export interface Palette {
  bg: string; surface: string; surface2: string; border: string;
  text: string; muted: string; accent: string; onAccent: string;
  danger: string; warn: string; income: string; expense: string;
}

export const darkPalette: Palette = {
  bg: '#0B0F14', surface: '#131A22', surface2: '#1B2430', border: '#263241',
  text: '#E8EEF4', muted: '#8FA0B3', accent: '#4ADE9A', onAccent: '#06261A',
  danger: '#F87171', warn: '#FBBF24', income: '#4ADE9A', expense: '#F87171',
};

export const lightPalette: Palette = {
  bg: '#F5F7FA', surface: '#FFFFFF', surface2: '#EDF1F6', border: '#D8E0EA',
  text: '#0F1720', muted: '#5B6B7D', accent: '#12A063', onAccent: '#FFFFFF',
  danger: '#D64545', warn: '#B7791F', income: '#12805A', expense: '#D64545',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
/** Area minima de toque recomendada (pt). */
export const MIN_TOUCH = 44;
