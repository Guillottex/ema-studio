import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Compass, Flag, Info, Palette, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { FONTS, PRESET_THEMES, contrastOn, fontStack, shadowCss, themeVars, alpha, type CourseSettings, type Theme } from '@engine';
import { api, assetUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { toast } from '../../lib/toast';
import { MediaField } from '../../components/MediaPicker';
import { Button, ColorInput, Field, IconButton, Input, Modal, Select, Spinner, Switch, Tabs, Textarea, clsx, confirmDialog, promptDialog } from '../../components/ui';

/* ------------------------------- Tipos ------------------------------- */

interface Category { id: number; name: string; color?: string }
interface ThemeRow { id: string; name: string; data: Theme; is_preset: boolean }

interface Meta {
  title: string;
  description: string;
  author: string;
  categoryId: number | null;
  coverImage: string;
  duration: string;
  level: string;
  language: string;
  objectives: string[];
  requirements: string[];
  status: 'draft' | 'published';
}

type TabId = 'general' | 'appearance' | 'navigation' | 'completion';

const LEVELS = ['Básico', 'Intermedio', 'Avanzado'];
const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Completa un tema parcial con los valores del tema base (evita undefined en la vista previa). */
function normalizeTheme(t?: Partial<Theme> | null): Theme {
  const d = PRESET_THEMES[0];
  const x: any = t || {};
  return {
    ...clone(d), ...x,
    colors: { ...d.colors, ...(x.colors || {}) }, fonts: { ...d.fonts, ...(x.fonts || {}) }, buttons: { ...d.buttons, ...(x.buttons || {}) },
    headings: { ...d.headings, ...(x.headings || {}) }, background: { ...d.background, ...(x.background || {}) }, cards: { ...d.cards, ...(x.cards || {}) },
    menu: { ...d.menu, ...(x.menu || {}) }, header: { ...d.header, ...(x.header || {}) }, progress: { ...d.progress, ...(x.progress || {}) },
  };
}

function normalizeSettings(s: any): CourseSettings {
  return {
    theme: normalizeTheme(s?.theme),
    navigation: { mode: 'free', showMenu: true, showProgress: true, showScreenCounter: true, showHeader: true, ...(s?.navigation || {}) },
    completion: { criteria: 'visited', visitedPercent: 100, ...(s?.completion || {}) },
    resume: { enabled: true, ask: true, ...(s?.resume || {}) },
    logo: s?.logo || '',
  };
}

function metaFrom(c: any): Meta {
  return {
    title: c.title || '',
    description: c.description || '',
    author: c.author || '',
    categoryId: c.category_id ?? null,
    coverImage: c.cover_image || '',
    duration: c.duration || '',
    level: c.level || '',
    language: c.language || 'es',
    objectives: Array.isArray(c.objectives) ? c.objectives : [],
    requirements: Array.isArray(c.requirements) ? c.requirements : [],
    status: c.status === 'published' ? 'published' : 'draft',
  };
}

const num = (v: string, fallback: number, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/* --------------------------- Piezas reutilizables --------------------------- */

function StringList({ value, onChange, placeholder, addLabel, disabled }: { value: string[]; onChange(v: string[]): void; placeholder: string; addLabel: string; disabled?: boolean }) {
  const set = (i: number, v: string) => onChange(value.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {value.length === 0 && <p className="text-xs italic text-slate-400">Sin elementos.</p>}
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-5 flex-none text-right text-xs text-slate-400">{i + 1}.</span>
          <Input sm value={v} maxLength={500} placeholder={placeholder} disabled={disabled} onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const n = [...value]; n.splice(i + 1, 0, ''); onChange(n); } }} />
          <IconButton title="Subir" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="h-7 w-7 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></IconButton>
          <IconButton title="Bajar" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)} className="h-7 w-7 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></IconButton>
          <IconButton title="Quitar" disabled={disabled} onClick={() => onChange(value.filter((_, k) => k !== i))} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-red-500" /></IconButton>
        </div>
      ))}
      <Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onChange([...value, ''])}>{addLabel}</Button>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange(v: T): void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={clsx('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', value === o.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OptionCard({ selected, onClick, title, children }: { selected: boolean; onClick(): void; title: ReactNode; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition', selected ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
      <span className={clsx('mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border', selected ? 'border-brand-600 bg-brand-600' : 'border-slate-400')}>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{title}</span>
        {children && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{children}</span>}
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="panel-title">{title}</h4>
      {children}
    </section>
  );
}

/* ------------------------------ Vista previa ------------------------------ */

function ThemePreview({ theme, nav, logo, title }: { theme: Theme; nav: CourseSettings['navigation']; logo?: string; title: string }) {
  const v = themeVars(theme);
  const c = theme.colors;
  const progressColor = v['--ema-progress'];
  const btnBase = { borderRadius: theme.buttons.radius, textTransform: theme.buttons.uppercase ? 'uppercase' : 'none', fontFamily: v['--ema-font-body'], fontWeight: 600, fontSize: 11, padding: '6px 12px', border: '2px solid transparent' } as const;
  const btn = theme.buttons.style === 'outline'
    ? { ...btnBase, background: 'transparent', color: c.primary, borderColor: c.primary }
    : theme.buttons.style === 'soft'
      ? { ...btnBase, background: alpha(c.primary, 0.14), color: c.primary }
      : { ...btnBase, background: c.primary, color: contrastOn(c.primary) };
  const heading = { fontFamily: v['--ema-font-heading'], fontWeight: theme.headings.weight, textTransform: theme.headings.transform, color: v['--ema-heading-color'] } as const;
  const pct = 40;
  const progress = !nav.showProgress ? null : theme.progress.style === 'steps' ? (
    <div className="flex gap-1">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < 3 ? progressColor : alpha(c.muted, 0.25) }} />)}</div>
  ) : theme.progress.style === 'percent' ? (
    <div className="text-right text-[10px] font-semibold" style={{ color: progressColor }}>{pct}% completado</div>
  ) : (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: alpha(c.muted, 0.2) }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: progressColor }} /></div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 shadow-sm dark:border-slate-700" style={{ background: c.background, color: c.text, fontFamily: v['--ema-font-body'] }}>
      {nav.showHeader && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: v['--ema-header-bg'], color: v['--ema-header-fg'] }}>
          {logo ? <img src={assetUrl(logo)} alt="" className="h-5 max-w-[60px] object-contain" /> : <span className="h-4 w-4 rounded" style={{ background: c.accent }} />}
          <span className="truncate text-[11px] font-semibold" style={{ fontFamily: v['--ema-font-heading'] }}>{title || 'Mi curso'}</span>
          {nav.showScreenCounter && <span className="ml-auto text-[10px] opacity-80">3 / 8</span>}
        </div>
      )}
      <div className="flex min-h-[230px]">
        {nav.showMenu && (
          <div className="w-[30%] flex-none space-y-1 p-2 text-[10px]" style={{ background: v['--ema-menu-bg'], color: v['--ema-menu-fg'], borderRight: `1px solid ${c.border}` }}>
            <div className="mb-1 font-semibold opacity-70">Módulo 1</div>
            {['Introducción', 'Conceptos', 'Práctica', 'Evaluación'].map((x, i) => (
              <div key={x} className="truncate rounded px-1.5 py-1" style={i === 1 ? { background: theme.menu.style === 'light' ? alpha(c.primary, 0.12) : 'rgba(255,255,255,.15)', color: theme.menu.style === 'light' ? c.primary : undefined, fontWeight: 600 } : undefined}>{x}</div>
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="flex-1 space-y-2 p-3" style={{ background: v['--ema-stage-bg'], borderRadius: 6 }}>
            <div className="text-[15px] leading-tight" style={heading}>Conceptos clave</div>
            <p className="text-[11px] leading-snug" style={{ color: c.text }}>Una planilla organiza datos en <b style={{ color: c.secondary }}>filas y columnas</b>. Cada celda puede contener texto, números o fórmulas.</p>
            <div className="p-2 text-[10.5px]" style={{ background: c.surface, borderRadius: theme.cards.radius, boxShadow: shadowCss(theme.cards.shadow), border: theme.cards.border ? `1px solid ${c.border}` : '1px solid transparent' }}>
              <div className="mb-0.5 font-semibold" style={{ fontFamily: v['--ema-font-heading'], color: c.accent }}>💡 Tarjeta</div>
              <span style={{ color: c.muted }}>Texto secundario dentro de una tarjeta.</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" style={btn}>Continuar</button>
              <button type="button" style={{ ...btnBase, background: c.secondary, color: contrastOn(c.secondary) }}>Ver más</button>
            </div>
          </div>
          {progress && <div className="mt-2">{progress}</div>}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Diálogo --------------------------------- */

export function CourseSettingsDialog({ courseId, open, onClose, onSaved }: { courseId: string; open: boolean; onClose(): void; onSaved(course: any): void }) {
  const { can } = useAuth();
  const canEdit = can('courses.edit');
  const canPublish = can('courses.publish');
  const canManageThemes = can('themes.manage');

  const [tab, setTab] = useState<TabId>('general');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [settings, setSettings] = useState<CourseSettings | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, cats, ths] = await Promise.all([
        api.get<any>(`/courses/${courseId}`),
        api.get<Category[]>('/categories').catch(() => [] as Category[]),
        api.get<ThemeRow[]>('/themes').catch(() => [] as ThemeRow[]),
      ]);
      const m = metaFrom(c);
      const s = normalizeSettings(c.settings);
      setCourse(c); setCategories(cats); setThemes(ths); setMeta(m); setSettings(s); setThemeId(c.theme_id ?? null);
      setInitial(JSON.stringify({ m, s, t: c.theme_id ?? null }));
    } catch (e: any) {
      setLoadError(e?.message || 'No se pudo cargar el curso');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (open) { setTab('general'); setTitleError(undefined); load(); }
    else { setCourse(null); setMeta(null); setSettings(null); }
  }, [open, load]);

  const dirty = useMemo(() => !!meta && !!settings && JSON.stringify({ m: meta, s: settings, t: themeId }) !== initial, [meta, settings, themeId, initial]);

  const requestClose = async () => {
    if (saving) return;
    if (dirty && !(await confirmDialog({ title: 'Descartar cambios', message: 'Hay cambios sin guardar en la configuración del curso. ¿Querés cerrar igual?', confirmText: 'Descartar', danger: true }))) return;
    onClose();
  };

  const upMeta = (p: Partial<Meta>) => setMeta((m) => (m ? { ...m, ...p } : m));
  const upSettings = (p: Partial<CourseSettings>) => setSettings((s) => (s ? { ...s, ...p } : s));
  const upTheme = <K extends keyof Theme>(k: K, patch: Partial<Theme[K]>) =>
    setSettings((s) => (s ? { ...s, theme: { ...s.theme, [k]: { ...(s.theme[k] as any), ...(patch as any) } } } : s));
  const setColor = (k: keyof Theme['colors'], v: string) => upTheme('colors', { [k]: v } as any);

  const pickTheme = (row: ThemeRow) => {
    setThemeId(row.id);
    setSettings((s) => (s ? { ...s, theme: normalizeTheme({ ...clone(row.data), name: row.name }) } : s));
  };

  const saveAsTheme = async () => {
    if (!settings) return;
    const name = await promptDialog({ title: 'Guardar como tema', label: 'Nombre del tema', value: settings.theme.name ? `${settings.theme.name} (personalizado)` : 'Mi tema', confirmText: 'Guardar tema' });
    if (!name) return;
    setSavingTheme(true);
    try {
      const { id: _id, ...data } = settings.theme as any;
      const row = await api.post<ThemeRow>('/themes', { name, data: { ...data, name } });
      setThemes((t) => [...t, row]);
      setThemeId(row.id);
      setSettings((s) => (s ? { ...s, theme: { ...s.theme, name } } : s));
      toast.success(`Tema “${name}” guardado. Ya podés usarlo en otros cursos.`);
    } catch (e) {
      toast.error(e);
    } finally {
      setSavingTheme(false);
    }
  };

  const save = async () => {
    if (!meta || !settings || !course) return;
    if (!meta.title.trim()) { setTitleError('El nombre es obligatorio'); setTab('general'); return; }
    setSaving(true);
    try {
      const orig = metaFrom(course);
      const body: Record<string, any> = {
        title: meta.title.trim(),
        description: meta.description,
        author: meta.author,
        categoryId: meta.categoryId,
        coverImage: meta.coverImage || null,
        duration: meta.duration,
        level: meta.level,
        language: meta.language,
        objectives: meta.objectives.map((x) => x.trim()).filter(Boolean),
        requirements: meta.requirements.map((x) => x.trim()).filter(Boolean),
      };
      if (meta.status !== orig.status) body.status = meta.status;
      if (themeId !== (course.theme_id ?? null)) body.themeId = themeId;
      await api.patch(`/courses/${courseId}`, body);
      const { id: _id, ...theme } = settings.theme as any;
      await api.put(`/courses/${courseId}/settings`, {
        theme,
        navigation: settings.navigation,
        completion: { criteria: settings.completion.criteria, visitedPercent: num(String(settings.completion.visitedPercent), 100, 1, 100) },
        resume: settings.resume,
        logo: settings.logo || '',
      });
      const updated = await api.get<any>(`/courses/${courseId}`);
      toast.success('Configuración del curso guardada');
      onSaved(updated);
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'appearance', label: 'Apariencia', icon: <Palette className="h-4 w-4" /> },
    { id: 'navigation', label: 'Navegación', icon: <Compass className="h-4 w-4" /> },
    { id: 'completion', label: 'Finalización y SCORM', icon: <Flag className="h-4 w-4" /> },
  ];

  const levelOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Sin especificar' }, ...LEVELS.map((l) => ({ value: l, label: l }))];
    if (meta?.level && !LEVELS.includes(meta.level)) opts.push({ value: meta.level, label: meta.level });
    return opts;
  }, [meta?.level]);
  const langOptions = useMemo(() => {
    const opts = [...LANGUAGES];
    if (meta?.language && !opts.some((o) => o.value === meta.language)) opts.push({ value: meta.language, label: meta.language });
    return opts;
  }, [meta?.language]);

  const t = settings?.theme;
  const fontOptions = FONTS.map((f) => ({ value: f.id, label: f.label }));

  return (
    <Modal open={open} onClose={requestClose} size="xl" title="Configuración del curso"
      description={course ? <>“{course.title}” · {course.counts?.modules ?? 0} módulos · {course.counts?.lessons ?? 0} lecciones · {course.counts?.screens ?? 0} pantallas</> : undefined}
      footer={<>
        {dirty && <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">Cambios sin guardar</span>}
        {!canEdit && <span className="mr-auto text-xs text-slate-500">Sólo lectura: no tenés permiso para editar cursos.</span>}
        <Button onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={saving} disabled={!canEdit || !meta || loading} onClick={save}>Guardar cambios</Button>
      </>}>
      {loading && !meta ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Spinner className="h-7 w-7" />Cargando configuración…</div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-600">❌ {loadError}<Button size="sm" onClick={load}>Reintentar</Button></div>
      ) : meta && settings && t ? (
        <div>
          <Tabs<TabId> tabs={tabs} value={tab} onChange={setTab} className="-mx-1 mb-4 overflow-x-auto px-1" />

          {/* ------------------------------ General ------------------------------ */}
          {tab === 'general' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre del curso *" error={titleError} className="md:col-span-2">
                <Input value={meta.title} maxLength={200} onChange={(e) => { upMeta({ title: e.target.value }); setTitleError(undefined); }} />
              </Field>
              <Field label="Descripción" className="md:col-span-2">
                <Textarea rows={3} maxLength={5000} value={meta.description} placeholder="De qué trata el curso y a quién está dirigido" onChange={(e) => upMeta({ description: e.target.value })} />
              </Field>
              <Field label="Autor"><Input value={meta.author} maxLength={200} onChange={(e) => upMeta({ author: e.target.value })} /></Field>
              <Field label="Categoría">
                <Select value={meta.categoryId ?? ''} onChange={(e) => upMeta({ categoryId: e.target.value ? Number(e.target.value) : null })}
                  options={[{ value: '', label: 'Sin categoría' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              </Field>
              <Field label="Imagen de portada" hint="Se muestra en el listado de cursos y en la pantalla de inicio.">
                <MediaField value={meta.coverImage} onChange={(v) => upMeta({ coverImage: v })} accept="image" />
              </Field>
              <Field label="Duración estimada"><Input value={meta.duration} maxLength={80} placeholder="Ej.: 2 horas" onChange={(e) => upMeta({ duration: e.target.value })} /></Field>
              <Field label="Nivel"><Select value={meta.level} onChange={(e) => upMeta({ level: e.target.value })} options={levelOptions} /></Field>
              <Field label="Idioma"><Select value={meta.language} onChange={(e) => upMeta({ language: e.target.value })} options={langOptions} /></Field>
              <Field label="Versión" hint="Las versiones se administran desde “Versiones”.">
                <div className="input flex items-center bg-slate-50 font-mono text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">v{course?.version || '1.0'}</div>
              </Field>
              <Field label="Estado" hint={!canPublish ? 'Sólo un administrador puede publicar cursos.' : 'Los cursos publicados quedan marcados como versión final.'}>
                <Segmented<Meta['status']> value={meta.status} onChange={(v) => { if (v === 'published' && !canPublish) return; upMeta({ status: v }); }}
                  options={canPublish || meta.status === 'published' ? [{ value: 'draft', label: 'Borrador' }, { value: 'published', label: 'Publicado' }] : [{ value: 'draft', label: 'Borrador' }]} />
              </Field>
              <Field label="Objetivos de aprendizaje" className="md:col-span-1">
                <StringList value={meta.objectives} onChange={(v) => upMeta({ objectives: v })} placeholder="Al finalizar, el alumno podrá…" addLabel="Agregar objetivo" />
              </Field>
              <Field label="Requisitos previos" className="md:col-span-1">
                <StringList value={meta.requirements} onChange={(v) => upMeta({ requirements: v })} placeholder="Ej.: Manejo básico de computadora" addLabel="Agregar requisito" />
              </Field>
            </div>
          )}

          {/* ----------------------------- Apariencia ----------------------------- */}
          {tab === 'appearance' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <Section title="Tema base">
                  {themes.length === 0 ? <p className="text-sm text-slate-500">No hay temas disponibles.</p> : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {themes.map((row) => {
                        const d = normalizeTheme(row.data);
                        const sel = themeId === row.id;
                        return (
                          <button key={row.id} type="button" onClick={() => pickTheme(row)} title={`Aplicar “${row.name}”`}
                            className={clsx('relative overflow-hidden rounded-lg border text-left transition', sel ? 'border-brand-600 ring-2 ring-brand-500/40' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
                            <div className="flex h-9">
                              {[d.colors.primary, d.colors.secondary, d.colors.accent, d.colors.background].map((col, i) => <span key={i} className="flex-1" style={{ background: col }} />)}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1.5">
                              <span className="truncate text-xs font-medium" style={{ fontFamily: fontStack(d.fonts.heading) }}>{row.name}</span>
                              {!row.is_preset && <span className="ml-auto flex-none text-[10px] text-slate-400">Propio</span>}
                            </div>
                            {sel && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white"><Check className="h-3 w-3" /></span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Elegir un tema copia sus valores; después podés ajustarlos sin modificar el tema original.</p>
                </Section>

                <Section title="Colores">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Color principal"><ColorInput value={t.colors.primary} onChange={(v) => setColor('primary', v)} /></Field>
                    <Field label="Color secundario"><ColorInput value={t.colors.secondary} onChange={(v) => setColor('secondary', v)} /></Field>
                    <Field label="Acento"><ColorInput value={t.colors.accent} onChange={(v) => setColor('accent', v)} /></Field>
                    <Field label="Fondo"><ColorInput value={t.colors.background} onChange={(v) => setColor('background', v)} /></Field>
                    <Field label="Superficie"><ColorInput value={t.colors.surface} onChange={(v) => setColor('surface', v)} /></Field>
                    <Field label="Texto"><ColorInput value={t.colors.text} onChange={(v) => setColor('text', v)} /></Field>
                  </div>
                </Section>

                <Section title="Tipografía">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tipografía de títulos"><Select value={t.fonts.heading} onChange={(e) => upTheme('fonts', { heading: e.target.value })} options={fontOptions} /></Field>
                    <Field label="Tipografía de textos"><Select value={t.fonts.body} onChange={(e) => upTheme('fonts', { body: e.target.value })} options={fontOptions} /></Field>
                  </div>
                  <p className="text-xs text-slate-500">Inter, Roboto, Open Sans, Montserrat, Lato y Merriweather se incluyen dentro del paquete SCORM (funcionan sin internet).</p>
                </Section>

                <Section title="Botones">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={`Redondeo: ${t.buttons.radius >= 999 ? 'píldora' : `${t.buttons.radius} px`}`}>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={30} value={Math.min(30, t.buttons.radius)} onChange={(e) => upTheme('buttons', { radius: Number(e.target.value) })} className="flex-1 accent-brand-600" />
                        <Button size="xs" variant={t.buttons.radius >= 999 ? 'primary' : 'secondary'} onClick={() => upTheme('buttons', { radius: 999 })}>Píldora</Button>
                      </div>
                    </Field>
                    <Field label="Estilo">
                      <Segmented<Theme['buttons']['style']> value={t.buttons.style} onChange={(v) => upTheme('buttons', { style: v })}
                        options={[{ value: 'filled', label: 'Relleno' }, { value: 'outline', label: 'Contorno' }, { value: 'soft', label: 'Suave' }]} />
                    </Field>
                  </div>
                  <Switch checked={t.buttons.uppercase} onChange={(v) => upTheme('buttons', { uppercase: v })} label="Texto de botones en mayúsculas" />
                </Section>

                <Section title="Encabezados y tarjetas">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Peso de los títulos">
                      <Select value={t.headings.weight} onChange={(e) => upTheme('headings', { weight: Number(e.target.value) })}
                        options={[{ value: 400, label: 'Normal (400)' }, { value: 500, label: 'Medio (500)' }, { value: 600, label: 'Seminegrita (600)' }, { value: 700, label: 'Negrita (700)' }, { value: 800, label: 'Extra negrita (800)' }, { value: 900, label: 'Black (900)' }]} />
                    </Field>
                    <Field label="Títulos en mayúsculas">
                      <div className="pt-1.5"><Switch checked={t.headings.transform === 'uppercase'} onChange={(v) => upTheme('headings', { transform: v ? 'uppercase' : 'none' })} label={t.headings.transform === 'uppercase' ? 'Sí' : 'No'} /></div>
                    </Field>
                    <Field label={`Redondeo de tarjetas: ${t.cards.radius} px`}>
                      <input type="range" min={0} max={32} value={t.cards.radius} onChange={(e) => upTheme('cards', { radius: Number(e.target.value) })} className="w-full accent-brand-600" />
                    </Field>
                    <Field label="Sombra de tarjetas">
                      <Segmented<Theme['cards']['shadow']> value={t.cards.shadow} onChange={(v) => upTheme('cards', { shadow: v })}
                        options={[{ value: 'none', label: 'Sin' }, { value: 'sm', label: 'Suave' }, { value: 'md', label: 'Media' }, { value: 'lg', label: 'Fuerte' }]} />
                    </Field>
                  </div>
                  <Switch checked={t.cards.border} onChange={(v) => upTheme('cards', { border: v })} label="Borde en las tarjetas" />
                </Section>

                <Section title="Menú, barra superior y progreso">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Menú lateral">
                      <Segmented<Theme['menu']['style']> value={t.menu.style} onChange={(v) => upTheme('menu', { style: v })}
                        options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'primary', label: 'Color principal' }]} />
                    </Field>
                    <Field label="Barra superior">
                      <Segmented<Theme['header']['style']> value={t.header.style} onChange={(v) => upTheme('header', { style: v })}
                        options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'primary', label: 'Color principal' }]} />
                    </Field>
                    <Field label="Barra de progreso">
                      <Segmented<Theme['progress']['style']> value={t.progress.style} onChange={(v) => upTheme('progress', { style: v })}
                        options={[{ value: 'bar', label: 'Barra' }, { value: 'steps', label: 'Pasos' }, { value: 'percent', label: 'Porcentaje' }]} />
                    </Field>
                    <Field label="Color del progreso" hint="Vacío = color secundario">
                      <ColorInput value={t.progress.color || ''} allowEmpty onChange={(v) => upTheme('progress', { color: v || undefined })} />
                    </Field>
                  </div>
                </Section>

                <Section title="Logo">
                  <Field hint="Se muestra en la barra superior del curso. Recomendado: PNG o SVG con fondo transparente.">
                    <MediaField value={settings.logo || ''} onChange={(v) => upSettings({ logo: v })} accept="image" />
                  </Field>
                </Section>
              </div>

              <div className="lg:sticky lg:top-0 lg:self-start">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="panel-title">Vista previa</h4>
                  <span className="text-[11px] text-slate-400">{t.name}</span>
                </div>
                <ThemePreview theme={t} nav={settings.navigation} logo={settings.logo} title={meta.title} />
                {canManageThemes && (
                  <Button size="sm" className="mt-3 w-full" icon={<Save className="h-4 w-4" />} loading={savingTheme} onClick={saveAsTheme}>Guardar como tema</Button>
                )}
                <p className="mt-2 text-[11px] text-slate-500">La vista previa es aproximada. Para ver el curso completo usá “Vista previa” en el editor.</p>
              </div>
            </div>
          )}

          {/* ----------------------------- Navegación ----------------------------- */}
          {tab === 'navigation' && (
            <div className="grid gap-6 md:grid-cols-2">
              <Section title="Modo de navegación">
                <div className="space-y-2">
                  <OptionCard selected={settings.navigation.mode === 'free'} onClick={() => upSettings({ navigation: { ...settings.navigation, mode: 'free' } })} title="Libre">
                    El alumno puede moverse por cualquier pantalla, en el orden que quiera, usando el menú o los botones.
                  </OptionCard>
                  <OptionCard selected={settings.navigation.mode === 'linear'} onClick={() => upSettings({ navigation: { ...settings.navigation, mode: 'linear' } })} title="Lineal">
                    Obliga a completar las pantallas en orden: no se puede avanzar a la siguiente sin terminar la actual (incluidas las actividades obligatorias).
                  </OptionCard>
                </div>
              </Section>
              <Section title="Elementos visibles">
                <div className="space-y-3">
                  <Switch checked={settings.navigation.showHeader} onChange={(v) => upSettings({ navigation: { ...settings.navigation, showHeader: v } })} label="Mostrar encabezado" hint="Barra superior con el logo y el nombre del curso." />
                  <Switch checked={settings.navigation.showMenu} onChange={(v) => upSettings({ navigation: { ...settings.navigation, showMenu: v } })} label="Mostrar menú" hint="Índice lateral con módulos, lecciones y pantallas." />
                  <Switch checked={settings.navigation.showProgress} onChange={(v) => upSettings({ navigation: { ...settings.navigation, showProgress: v } })} label="Mostrar barra de progreso" hint="Indica cuánto del curso lleva visto el alumno." />
                  <Switch checked={settings.navigation.showScreenCounter} onChange={(v) => upSettings({ navigation: { ...settings.navigation, showScreenCounter: v } })} label="Mostrar contador de pantallas" hint="Por ejemplo “3 / 22”." />
                </div>
                <div className="pt-2"><ThemePreview theme={t} nav={settings.navigation} logo={settings.logo} title={meta.title} /></div>
              </Section>
            </div>
          )}

          {/* ------------------------ Finalización y SCORM ------------------------ */}
          {tab === 'completion' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                <Section title="Criterio de finalización">
                  <div className="space-y-2">
                    <OptionCard selected={settings.completion.criteria === 'visited'} onClick={() => upSettings({ completion: { ...settings.completion, criteria: 'visited' } })}
                      title={<>Al ver el {settings.completion.visitedPercent}% de las pantallas</>}>
                      El curso se marca como completado cuando el alumno recorre ese porcentaje de pantallas.
                    </OptionCard>
                    <OptionCard selected={settings.completion.criteria === 'quiz'} onClick={() => upSettings({ completion: { ...settings.completion, criteria: 'quiz' } })} title="Al aprobar la evaluación final">
                      Requiere una evaluación marcada como final. Se informa aprobado o desaprobado y la nota.
                    </OptionCard>
                    <OptionCard selected={settings.completion.criteria === 'both'} onClick={() => upSettings({ completion: { ...settings.completion, criteria: 'both' } })} title="Ambas condiciones">
                      Tiene que ver el porcentaje indicado de pantallas <b>y</b> aprobar la evaluación final.
                    </OptionCard>
                  </div>
                  {settings.completion.criteria !== 'quiz' && (
                    <Field label="Porcentaje de pantallas vistas" hint="Entre 1 y 100.">
                      <div className="flex items-center gap-2">
                        <input type="range" min={1} max={100} value={settings.completion.visitedPercent} className="flex-1 accent-brand-600"
                          onChange={(e) => upSettings({ completion: { ...settings.completion, visitedPercent: Number(e.target.value) } })} />
                        <Input sm type="number" min={1} max={100} className="w-20" value={settings.completion.visitedPercent}
                          onChange={(e) => upSettings({ completion: { ...settings.completion, visitedPercent: num(e.target.value, settings.completion.visitedPercent, 1, 100) } })} />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </Field>
                  )}
                </Section>

                <Section title="Reanudación">
                  <Switch checked={settings.resume.enabled} onChange={(v) => upSettings({ resume: { ...settings.resume, enabled: v } })} label="Habilitar reanudación"
                    hint="Al volver a entrar, el alumno continúa desde la última pantalla vista y conserva su progreso." />
                  <Switch checked={settings.resume.ask} disabled={!settings.resume.enabled} onChange={(v) => upSettings({ resume: { ...settings.resume, ask: v } })} label="Preguntar al alumno antes de continuar"
                    hint="Muestra “¿Querés continuar donde lo dejaste?” en lugar de saltar directamente." />
                </Section>
              </div>

              <Section title="Qué se informa al LMS (SCORM 1.2)">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="mb-3 flex gap-2 text-slate-600 dark:text-slate-300"><Info className="mt-0.5 h-4 w-4 flex-none text-brand-600" />El curso se comunica con el LMS mediante la API SCORM 1.2 y envía estos datos:</div>
                  <dl className="space-y-2.5">
                    {[
                      ['cmi.core.lesson_status', <>Estado: <b>passed</b> / <b>failed</b> (con evaluación), <b>completed</b> (al cumplir el criterio) o <b>incomplete</b> (en curso).</>],
                      ['cmi.core.score.raw', <>Nota de la evaluación final (0 a 100), junto con score.min y score.max.</>],
                      ['cmi.core.lesson_location', <>Última pantalla vista, para reanudar.</>],
                      ['cmi.suspend_data', <>Progreso guardado: pantallas vistas, respuestas y estado de las actividades.</>],
                      ['cmi.core.session_time', <>Tiempo de la sesión; el LMS lo suma al tiempo total.</>],
                    ].map(([k, d]) => (
                      <div key={k as string}>
                        <dt><code className="kbd">{k}</code></dt>
                        <dd className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{d}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Section>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
