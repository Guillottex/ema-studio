import { api } from './api';

export type ThemeMode = 'light' | 'dark';

export function currentMode(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyMode(mode: ThemeMode, persist = true) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try { localStorage.setItem('ema-theme', mode); } catch { /* */ }
  if (persist) api.put('/auth/preferences', { theme: mode }).catch(() => undefined);
}
