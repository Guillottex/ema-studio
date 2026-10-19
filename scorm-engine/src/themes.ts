import type { Theme, CourseSettings } from './types';

/** Fuentes disponibles. Las de tipo "embedded" se incluyen como woff2 dentro del SCORM (funcionan offline). */
export const FONTS: { id: string; label: string; stack: string; embedded?: string }[] = [
  { id: 'Outfit', label: 'Outfit (EMA)', stack: "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif", embedded: 'outfit' },
  { id: 'Poppins', label: 'Poppins (EMA)', stack: "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif", embedded: 'poppins' },
  { id: 'Inter', label: 'Inter', stack: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", embedded: 'inter' },
  { id: 'Roboto', label: 'Roboto', stack: "'Roboto', system-ui, 'Segoe UI', sans-serif", embedded: 'roboto' },
  { id: 'Open Sans', label: 'Open Sans', stack: "'Open Sans', system-ui, 'Segoe UI', sans-serif", embedded: 'open-sans' },
  { id: 'Montserrat', label: 'Montserrat', stack: "'Montserrat', system-ui, 'Segoe UI', sans-serif", embedded: 'montserrat' },
  { id: 'Lato', label: 'Lato', stack: "'Lato', system-ui, 'Segoe UI', sans-serif", embedded: 'lato' },
  { id: 'Merriweather', label: 'Merriweather', stack: "'Merriweather', Georgia, serif", embedded: 'merriweather' },
  { id: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'Georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'Verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'Trebuchet MS', label: 'Trebuchet MS', stack: "'Trebuchet MS', Tahoma, sans-serif" },
  { id: 'Courier New', label: 'Courier New', stack: "'Courier New', monospace" },
];

export function fontStack(id?: string): string | undefined {
  if (!id) return undefined;
  return FONTS.find((f) => f.id === id)?.stack || `'${id}', sans-serif`;
}

const base: Theme = {
  name: 'Corporativo azul',
  colors: {
    primary: '#1d4ed8', secondary: '#0ea5e9', accent: '#f59e0b', background: '#f1f5f9', surface: '#ffffff',
    text: '#1e293b', muted: '#64748b', border: '#e2e8f0', success: '#16a34a', error: '#dc2626',
  },
  fonts: { heading: 'Montserrat', body: 'Inter' },
  buttons: { radius: 8, style: 'filled', uppercase: false },
  headings: { weight: 700, transform: 'none' },
  background: { color: '#ffffff' },
  cards: { radius: 12, shadow: 'md', border: false },
  menu: { style: 'light' },
  header: { style: 'primary' },
  progress: { style: 'bar' },
};

function variant(name: string, patch: Partial<Theme> & { colors?: Partial<Theme['colors']> }): Theme {
  return {
    ...base,
    ...patch,
    name,
    colors: { ...base.colors, ...(patch.colors || {}) },
  } as Theme;
}

/** Identidad visual de EMA Servicios (www.emaservicios.com.ar): azul marino #282964, celeste #76C6E2, Outfit + Poppins */
export const EMA_THEME: Theme = {
  ...base,
  id: 'ema-servicios',
  name: 'EMA Servicios',
  colors: {
    primary: '#282964', secondary: '#76C6E2', accent: '#1E2D8A', background: '#EEF8FC', surface: '#ffffff',
    text: '#3F3F3F', muted: '#6B6E86', border: '#DDDEE0', success: '#16a34a', error: '#dc2626',
  },
  fonts: { heading: 'Outfit', body: 'Poppins' },
  buttons: { radius: 999, style: 'filled', uppercase: true },
  headings: { weight: 700, transform: 'none', color: '#282964' },
  background: { color: '#ffffff' },
  cards: { radius: 16, shadow: 'md', border: false },
  menu: { style: 'light' },
  header: { style: 'primary' },
  progress: { style: 'bar', color: '#76C6E2' },
};

export const PRESET_THEMES: Theme[] = [
  EMA_THEME,
  { ...base, id: 'corporate-blue' },
  variant('Verde Excel', {
    id: 'excel-green',
    colors: { primary: '#107c41', secondary: '#21a366', accent: '#f2c811', background: '#f3f7f4', text: '#1f2d24', muted: '#5d6f63', border: '#dbe6de' } as any,
    fonts: { heading: 'Montserrat', body: 'Open Sans' },
  }),
  variant('Académico', {
    id: 'academic',
    colors: { primary: '#7c2d12', secondary: '#b45309', accent: '#0f766e', background: '#faf7f2', text: '#292524', muted: '#78716c', border: '#e7e0d6' } as any,
    fonts: { heading: 'Merriweather', body: 'Lato' },
    buttons: { radius: 4, style: 'outline', uppercase: true },
    header: { style: 'light' },
    cards: { radius: 6, shadow: 'sm', border: true },
  }),
  variant('Seguridad', {
    id: 'safety',
    colors: { primary: '#ea580c', secondary: '#facc15', accent: '#1f2937', background: '#fff7ed', text: '#1c1917', muted: '#57534e', border: '#fed7aa' } as any,
    fonts: { heading: 'Montserrat', body: 'Roboto' },
    headings: { weight: 800, transform: 'uppercase' },
    header: { style: 'dark' },
    menu: { style: 'dark' },
  }),
  variant('Inducción violeta', {
    id: 'onboarding',
    colors: { primary: '#6d28d9', secondary: '#db2777', accent: '#06b6d4', background: '#f5f3ff', text: '#1e1b4b', muted: '#6b7280', border: '#e9e5ff' } as any,
    buttons: { radius: 999, style: 'filled', uppercase: false },
    cards: { radius: 18, shadow: 'lg', border: false },
  }),
  variant('Minimal oscuro', {
    id: 'minimal-dark',
    colors: { primary: '#38bdf8', secondary: '#a78bfa', accent: '#fbbf24', background: '#0b1220', surface: '#111a2e', text: '#e2e8f0', muted: '#94a3b8', border: '#1f2a44', success: '#22c55e', error: '#f87171' } as any,
    background: { color: '#0f172a' },
    header: { style: 'dark' },
    menu: { style: 'dark' },
    buttons: { radius: 10, style: 'soft', uppercase: false },
  }),
];

export const DEFAULT_THEME = EMA_THEME;

export function defaultCourseSettings(theme: Theme = DEFAULT_THEME): CourseSettings {
  return {
    theme: JSON.parse(JSON.stringify(theme)),
    navigation: { mode: 'free', showMenu: true, showProgress: true, showScreenCounter: true, showHeader: true },
    completion: { criteria: 'visited', visitedPercent: 100 },
    resume: { enabled: true, ask: true },
  };
}

const SHADOWS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 3px rgba(15,23,42,.12)',
  md: '0 6px 18px rgba(15,23,42,.12)',
  lg: '0 18px 40px rgba(15,23,42,.18)',
};
export function shadowCss(s?: string) {
  return SHADOWS[s || 'none'] || 'none';
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color de texto legible sobre un fondo dado */
export function contrastOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? '#111827' : '#ffffff';
}

export function alpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** Variables CSS que consume player.css. Se aplican al elemento raíz (.ema-root). */
export function themeVars(t: Theme): Record<string, string> {
  const c = t.colors;
  const headerBg = t.header.style === 'primary' ? c.primary : t.header.style === 'dark' ? '#111827' : c.surface;
  const menuBg = t.menu.style === 'primary' ? c.primary : t.menu.style === 'dark' ? '#111827' : c.surface;
  return {
    '--ema-primary': c.primary,
    '--ema-on-primary': contrastOn(c.primary),
    '--ema-primary-soft': alpha(c.primary, 0.12),
    '--ema-secondary': c.secondary,
    '--ema-on-secondary': contrastOn(c.secondary),
    '--ema-accent': c.accent,
    '--ema-bg': c.background,
    '--ema-surface': c.surface,
    '--ema-text': c.text,
    '--ema-muted': c.muted,
    '--ema-border': c.border,
    '--ema-success': c.success,
    '--ema-error': c.error,
    '--ema-font-heading': fontStack(t.fonts.heading) || 'sans-serif',
    '--ema-font-body': fontStack(t.fonts.body) || 'sans-serif',
    '--ema-btn-radius': `${t.buttons.radius}px`,
    '--ema-btn-transform': t.buttons.uppercase ? 'uppercase' : 'none',
    '--ema-heading-weight': String(t.headings.weight),
    '--ema-heading-transform': t.headings.transform,
    '--ema-heading-color': t.headings.color || c.text,
    '--ema-stage-bg': t.background.color || c.surface,
    '--ema-card-radius': `${t.cards.radius}px`,
    '--ema-card-shadow': shadowCss(t.cards.shadow),
    '--ema-card-border': t.cards.border ? `1px solid ${c.border}` : '1px solid transparent',
    '--ema-header-bg': headerBg,
    '--ema-header-fg': contrastOn(headerBg),
    '--ema-menu-bg': menuBg,
    '--ema-menu-fg': contrastOn(menuBg),
    '--ema-progress': t.progress.color || c.secondary,
  };
}

export function applyThemeVars(el: HTMLElement, t: Theme) {
  const vars = themeVars(t);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.dataset.btnStyle = t.buttons.style;
}

/** Fuentes embebidas que necesita un curso (para incluir sólo esas en el ZIP) */
export function usedEmbeddedFonts(fontIds: string[]): string[] {
  const out = new Set<string>();
  fontIds.forEach((id) => {
    const f = FONTS.find((x) => x.id === id);
    if (f?.embedded) out.add(f.embedded);
  });
  return [...out];
}
