import { useId, useMemo } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, assetUrl } from '../../lib/api';
import { Badge, clsx, Spinner } from '../../components/ui';

/* ------------------------------- Tipos de la API ------------------------------- */

export interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  status: 'draft' | 'published';
  version: string;
  cover_image: string | null;
  level: string | null;
  duration: string | null;
  language: string | null;
  updated_at: string;
  created_at: string;
  category: string | null;
  category_color: string | null;
  updated_by_name: string | null;
  modules: number;
  screens: number;
  last_export: string | null;
}

export interface Category { id: number; name: string; color: string | null; description?: string | null; courses?: number }

export interface ThemeRow {
  id: string;
  slug?: string | null;
  name: string;
  is_preset: boolean;
  data: { name?: string; colors?: Record<string, string>; fonts?: { heading?: string; body?: string } };
}

export interface TemplateRow {
  id: string;
  kind: 'course' | 'screen';
  name: string;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  is_system: boolean;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  summary: { modules?: number; theme?: string | null; primary?: string | null; components?: number };
}

/* ------------------------------- Queries compartidas ------------------------------- */

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
export const useThemes = (enabled = true) => useQuery({ queryKey: ['themes'], queryFn: () => api.get<ThemeRow[]>('/themes'), enabled });
export const useCourseTemplates = (enabled = true) => useQuery({ queryKey: ['templates', 'course'], queryFn: () => api.get<TemplateRow[]>('/templates?kind=course'), enabled });

/* ------------------------------- Componentes ------------------------------- */

export function StatusBadge({ status }: { status: string }) {
  return status === 'published'
    ? <Badge color="green"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Publicado</Badge>
    : <Badge color="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Borrador</Badge>;
}

export function CategoryBadge({ name, color }: { name?: string | null; color?: string | null }) {
  if (!name) return <span className="text-xs text-slate-400">Sin categoría</span>;
  const c = color || '#64748b';
  return (
    <span className="badge max-w-full truncate" style={{ backgroundColor: c + '1f', color: c }}>
      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ backgroundColor: c }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Portada del curso o un placeholder con degradé */
export function CourseCover({ src, title, className }: { src?: string | null; title: string; className?: string }) {
  if (src) return <img src={assetUrl(src)} alt="" loading="lazy" className={clsx('object-cover', className)} />;
  const hue = Array.from(title).reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <div className={clsx('grid place-items-center text-white/90', className)} style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 65% 42%))` }}>
      <BookOpen className="h-1/3 max-h-10 w-1/3 max-w-10" />
    </div>
  );
}

export function ThemeSwatch({ theme, size = 'md' }: { theme: ThemeRow; size?: 'sm' | 'md' }) {
  const c = theme.data?.colors || {};
  const keys = ['primary', 'secondary', 'accent', 'background'];
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      {keys.map((k) => <span key={k} className={size === 'sm' ? 'h-3 w-3' : 'h-5 w-4'} style={{ backgroundColor: c[k] || '#e2e8f0' }} />)}
    </span>
  );
}

/** Selector de tema visual con muestras de color */
export function ThemePicker({ value, onChange, allowDefault = true, compact }: { value: string | null; onChange(id: string | null): void; allowDefault?: boolean; compact?: boolean }) {
  const { data, isLoading } = useThemes();
  if (isLoading) return <div className="py-3"><Spinner className="h-4 w-4" /></div>;
  const items = data || [];
  return (
    <div className={clsx('grid grid-cols-1 gap-2', compact ? 'sm:grid-cols-2 lg:grid-cols-1' : 'sm:grid-cols-2')}>
      {allowDefault && (
        <button type="button" onClick={() => onChange(null)}
          className={clsx('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition', value === null ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/60 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
          <span className="inline-flex h-5 w-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-slate-600">auto</span>
          <span className="flex-1 truncate">Tema predeterminado</span>
          {value === null && <Check className="h-4 w-4 text-brand-600" />}
        </button>
      )}
      {items.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} title={t.data?.fonts ? `${t.data.fonts.heading || ''} / ${t.data.fonts.body || ''}` : undefined}
          className={clsx('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition', value === t.id ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/60 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
          <ThemeSwatch theme={t} />
          <span className="flex-1 truncate">{t.name}</span>
          {value === t.id && <Check className="h-4 w-4 text-brand-600" />}
        </button>
      ))}
    </div>
  );
}

/** Miniatura SVG de plantilla (SVG generado por el servidor, confiable) */
export function TemplateThumb({ svg, className }: { svg?: string | null; className?: string }) {
  // Varias miniaturas en la misma página comparten ids internos (ej. el degradé "g"): los volvemos únicos.
  const prefix = 'tt' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(() => (svg ? svg
    .replace(/\bid="([^"]+)"/g, (_m, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${prefix}-${id})`)
    .replace(/href="#([^"]+)"/g, (_m, id) => `href="#${prefix}-${id}"`) : ''), [svg, prefix]);
  if (!svg) return <div className={clsx('grid place-items-center bg-slate-100 text-slate-400 dark:bg-slate-800', className)}><BookOpen className="h-8 w-8" /></div>;
  return <div className={clsx('overflow-hidden [&>svg]:h-full [&>svg]:w-full', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Tailwind sólo genera las clases de `@layer components` que encuentra literalmente en el código.
 * El Button del kit arma `btn-${variant}` / `btn-${size}` dinámicamente, así que las dejamos escritas acá:
 * btn-primary btn-secondary btn-ghost btn-danger btn-success btn-xs btn-sm btn-lg
 */
export const linesToList =(s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
