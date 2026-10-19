import { create } from 'zustand';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }

interface ToastState { toasts: Toast[]; push(kind: Toast['kind'], message: string): void; remove(id: number): void }

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string | unknown) => useToasts.getState().push('error', typeof m === 'string' ? m : (m as any)?.message || 'Ocurrió un error'),
  info: (m: string) => useToasts.getState().push('info', m),
};
