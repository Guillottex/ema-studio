import { forwardRef, useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, Loader2, AlertTriangle, CheckCircle2, Info, Inbox } from 'lucide-react';
import { create } from 'zustand';
import { useToasts } from '../../lib/toast';

export { clsx };

/* ------------------------------- Botones ------------------------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'xs' | 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }>(
  ({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button ref={ref} type="button" className={clsx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
);

export function IconButton({ title, active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} className={clsx('icon-btn', active && 'is-active', className)} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------- Formularios ------------------------------- */

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('min-w-0', className)}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { sm?: boolean }>(({ className, sm, ...rest }, ref) => (
  <input ref={ref} className={clsx('input', sm && 'input-sm', className)} {...rest} />
));

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={clsx('input', className)} {...rest} />
));

export function Select({ className, sm, options, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { sm?: boolean; options?: { value: string | number; label: string }[] }) {
  return (
    <select className={clsx('input pr-8', sm && 'input-sm', className)} {...rest}>
      {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : rest.children}
    </select>
  );
}

export function Switch({ checked, onChange, label, disabled, hint }: { checked: boolean; onChange(v: boolean): void; label?: ReactNode; disabled?: boolean; hint?: ReactNode }) {
  return (
    <label className={clsx('flex items-start gap-2.5 cursor-pointer select-none', disabled && 'opacity-50 pointer-events-none')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 inline-flex h-5 w-9 flex-none rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600')}
      >
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      {label && (
        <span className="text-sm leading-snug">
          {label}
          {hint && <span className="block text-xs text-slate-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function ColorInput({ value, onChange, allowEmpty, placeholder }: { value?: string; onChange(v: string): void; allowEmpty?: boolean; placeholder?: string }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value || '') ? value! : '#000000';
  return (
    <div className="flex items-center gap-1.5">
      <label className="relative h-8 w-9 flex-none overflow-hidden rounded-md border border-slate-300 dark:border-slate-700 cursor-pointer" style={{ background: value || 'transparent' }}>
        {!value && <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]" />}
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      <input className="input input-sm font-mono" value={value || ''} placeholder={placeholder || (allowEmpty ? 'Automático' : '#000000')} onChange={(e) => onChange(e.target.value)} />
      {allowEmpty && value && (
        <button type="button" className="icon-btn h-7 w-7" title="Quitar color" onClick={() => onChange('')}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({ open, onClose, title, children, footer, size = 'md', description }: { open: boolean; onClose(): void; title?: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[96vw]' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] animate-[fadein_.15s_ease]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className={clsx('card flex max-h-[92vh] w-full flex-col overflow-hidden shadow-2xl', width)}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <IconButton title="Cerrar" onClick={onClose}><X className="h-4 w-4" /></IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* --------------------------- Confirmación global --------------------------- */

interface ConfirmReq { title: string; message?: ReactNode; confirmText?: string; danger?: boolean; resolve(v: boolean): void }
const useConfirmStore = create<{ req: ConfirmReq | null; set(r: ConfirmReq | null): void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  if (!req) return null;
  const close = (v: boolean) => { req.resolve(v); set(null); };
  return (
    <Modal open onClose={() => close(false)} title={req.title} size="sm"
      footer={<><Button onClick={() => close(false)}>Cancelar</Button><Button variant={req.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{req.confirmText || 'Confirmar'}</Button></>}>
      <div className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
        {req.danger && <AlertTriangle className="h-5 w-5 flex-none text-red-500" />}
        <div>{req.message}</div>
      </div>
    </Modal>
  );
}

/* --------------------------- Prompt de texto --------------------------- */

interface PromptReq { title: string; label?: string; value?: string; confirmText?: string; resolve(v: string | null): void }
const usePromptStore = create<{ req: PromptReq | null; set(r: PromptReq | null): void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function promptDialog(opts: Omit<PromptReq, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => usePromptStore.getState().set({ ...opts, resolve }));
}

export function PromptHost() {
  const { req, set } = usePromptStore();
  const [v, setV] = useState('');
  useEffect(() => { if (req) setV(req.value || ''); }, [req]);
  if (!req) return null;
  const close = (val: string | null) => { req.resolve(val); set(null); };
  return (
    <Modal open onClose={() => close(null)} title={req.title} size="sm"
      footer={<><Button onClick={() => close(null)}>Cancelar</Button><Button variant="primary" disabled={!v.trim()} onClick={() => close(v.trim())}>{req.confirmText || 'Aceptar'}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) close(v.trim()); }}>
        <Field label={req.label}><Input autoFocus value={v} onChange={(e) => setV(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

/* ------------------------------- Toasts ------------------------------- */

export function Toaster() {
  const { toasts, remove } = useToasts();
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[200] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={clsx('flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm shadow-lg border bg-white dark:bg-slate-800',
          t.kind === 'error' ? 'border-red-200 dark:border-red-900' : t.kind === 'success' ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700')}>
          {t.kind === 'error' ? <AlertTriangle className="h-4 w-4 flex-none text-red-500 mt-0.5" /> : t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 flex-none text-emerald-500 mt-0.5" /> : <Info className="h-4 w-4 flex-none text-brand-500 mt-0.5" />}
          <span className="flex-1 break-words">{t.message}</span>
          <button className="text-slate-400 hover:text-slate-600" onClick={() => remove(t.id)} aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ------------------------------- Varios ------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7" /></div>;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      <div className="mb-3 text-slate-400">{icon || <Inbox className="h-10 w-10" />}</div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, icon }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ color = 'slate', children, className }: { color?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'; children: ReactNode; className?: string }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    blue: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  }[color];
  return <span className={clsx('badge', c, className)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange, className, size = 'md' }: { tabs: { id: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange(v: T): void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={clsx('flex gap-1 border-b border-slate-200 dark:border-slate-800', className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx('-mb-px flex items-center gap-1.5 border-b-2 font-medium transition-colors whitespace-nowrap', size === 'sm' ? 'px-2 py-2 text-xs' : 'px-3 py-2.5 text-sm',
            value === t.id ? 'border-brand-600 text-brand-700 dark:text-brand-300 dark:border-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------- Menú contextual ---------------------------- */

export interface MenuItem { label?: string; icon?: ReactNode; onClick?(): void; danger?: boolean; disabled?: boolean; divider?: boolean; shortcut?: string }

export function useMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = (e: { clientX: number; clientY: number; preventDefault?(): void; stopPropagation?(): void }, items: MenuItem[]) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setState({ x: e.clientX, y: e.clientY, items });
  };
  const node = state ? <ContextMenu x={state.x} y={state.y} items={state.items} onClose={() => setState(null)} /> : null;
  return { open, node, close: () => setState(null) };
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
    }
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const timer = setTimeout(() => { document.addEventListener('mousedown', close); document.addEventListener('contextmenu', close); }, 0);
    document.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', close); document.removeEventListener('contextmenu', close); document.removeEventListener('keydown', key); window.removeEventListener('blur', onClose); };
  }, [x, y, onClose]);
  return createPortal(
    <div ref={ref} role="menu" className="fixed z-[300] min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800" style={{ left: pos.x, top: pos.y }}>
      {items.map((it, i) => it.divider ? <div key={i} className="my-1 divider" /> : (
        <button key={i} role="menuitem" type="button" disabled={it.disabled} onClick={() => { onClose(); it.onClick?.(); }}
          className={clsx('flex w-full items-center gap-2.5 px-3 py-1.5 text-left disabled:opacity-40', it.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-700')}>
          <span className="w-4 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
          <span className="flex-1">{it.label}</span>
          {it.shortcut && <span className="text-[11px] text-slate-400">{it.shortcut}</span>}
        </button>
      ))}
    </div>,
    document.body
  );
}

/** Menú desplegable anclado a un botón */
export function Dropdown({ trigger, items, align = 'right' }: { trigger: (open: () => void) => ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [st, setSt] = useState<{ x: number; y: number } | null>(null);
  const open = () => {
    const r = ref.current!.getBoundingClientRect();
    setSt({ x: align === 'right' ? r.right - 220 : r.left, y: r.bottom + 4 });
  };
  return (
    <span ref={ref} className="inline-flex">
      {trigger(open)}
      {st && <ContextMenu x={st.x} y={st.y} items={items} onClose={() => setSt(null)} />}
    </span>
  );
}
