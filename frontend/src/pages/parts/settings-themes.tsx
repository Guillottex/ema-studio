import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Pencil, Trash2, Lock, Palette } from 'lucide-react';
import { FONTS, PRESET_THEMES, DEFAULT_THEME, type Theme } from '@engine';
import { api } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, ColorInput, Empty, Field, IconButton, Input, Modal, PageLoader, Select, Switch, clsx, confirmDialog } from '../../components/ui';
import { ThemePreview, ColorDots } from './settings-theme-preview';

export interface ThemeRow { id: string; slug?: string | null; name: string; data: Theme; is_preset: boolean; courses: number; created_by_name?: string | null; updated_at?: string }

/** Completa un tema parcial con los valores por defecto (igual que el backend) */
export function normalizeTheme(data: Partial<Theme> | undefined, name?: string): Theme {
  const d = DEFAULT_THEME;
  const x: any = data || {};
  return {
    ...d, ...x, name: name ?? x.name ?? d.name,
    colors: { ...d.colors, ...(x.colors || {}) }, fonts: { ...d.fonts, ...(x.fonts || {}) }, buttons: { ...d.buttons, ...(x.buttons || {}) },
    headings: { ...d.headings, ...(x.headings || {}) }, background: { ...d.background, ...(x.background || {}) }, cards: { ...d.cards, ...(x.cards || {}) },
    menu: { ...d.menu, ...(x.menu || {}) }, header: { ...d.header, ...(x.header || {}) }, progress: { ...d.progress, ...(x.progress || {}) },
  };
}

type EditState = { id: string | null; name: string; data: Theme };

export function ThemesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['themes'], queryFn: () => api.get<ThemeRow[]>('/themes') });
  const [editing, setEditing] = useState<EditState | null>(null);

  const presets = (data || []).filter((t) => t.is_preset);
  const custom = (data || []).filter((t) => !t.is_preset);

  const startNew = () => setEditing({ id: null, name: 'Mi tema', data: normalizeTheme((presets.find((p) => p.slug === 'corporate-blue') || presets[0])?.data || DEFAULT_THEME) });
  const duplicate = (t: ThemeRow) => setEditing({ id: null, name: `${t.name} (copia)`, data: normalizeTheme(t.data) });
  const edit = (t: ThemeRow) => setEditing({ id: t.id, name: t.name, data: normalizeTheme(t.data) });
  const remove = async (t: ThemeRow) => {
    const ok = await confirmDialog({
      title: 'Eliminar tema', danger: true, confirmText: 'Eliminar',
      message: <>¿Eliminar el tema <b>{t.name}</b>?{t.courses > 0 && <> Lo usan {t.courses} curso{t.courses === 1 ? '' : 's'}: conservarán su apariencia actual, pero el tema ya no estará disponible para elegir.</>}</>,
    });
    if (!ok) return;
    try { await api.del(`/themes/${t.id}`); await qc.invalidateQueries({ queryKey: ['themes'] }); toast.success('Tema eliminado'); } catch (e) { toast.error(e); }
  };

  if (isLoading) return <PageLoader />;

  const card = (t: ThemeRow) => (
    <div key={t.id} className="card flex flex-col overflow-hidden">
      <div className="p-3 pb-0"><ThemePreview theme={normalizeTheme(t.data)} compact /></div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white">{t.name}</h3>
          <ColorDots theme={normalizeTheme(t.data)} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {t.is_preset ? <Badge><Lock className="h-3 w-3" />Predefinido</Badge> : <Badge color="violet">Personalizado</Badge>}
          <span>{t.courses} curso{t.courses === 1 ? '' : 's'}</span>
          <span>· {normalizeTheme(t.data).fonts.heading} / {normalizeTheme(t.data).fonts.body}</span>
          {!t.is_preset && t.updated_at && <span>· {fmtRelative(t.updated_at)}</span>}
        </div>
        {canManage && (
          <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
            {t.is_preset ? (
              <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => duplicate(t)}>Duplicar</Button>
            ) : (
              <>
                <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => edit(t)}>Editar</Button>
                <div className="ml-auto flex gap-0.5">
                  <IconButton title="Duplicar" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /></IconButton>
                  <IconButton title="Eliminar" className="hover:!text-red-600" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Los temas definen colores, tipografías, botones, tarjetas, menú y barra de progreso de los cursos. Se eligen al configurar cada curso y se incluyen en el paquete SCORM.
          {!canManage && ' Tu rol permite verlos, pero no modificarlos.'}
        </p>
        {canManage && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nuevo tema</Button>}
      </div>

      <section>
        <h2 className="panel-title mb-3">Temas personalizados ({custom.length})</h2>
        {custom.length === 0 ? (
          <Empty icon={<Palette className="h-10 w-10" />} title="Todavía no creaste temas propios"
            action={canManage ? <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Crear tema</Button> : undefined}>
            Partí de un tema predefinido y ajustá los colores y tipografías de tu marca.
          </Empty>
        ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{custom.map(card)}</div>}
      </section>

      <section>
        <h2 className="panel-title mb-3">Temas predefinidos ({presets.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{presets.map(card)}</div>
      </section>

      {editing && <ThemeEditorModal initial={editing} presets={presets} onClose={() => setEditing(null)} />}
    </div>
  );
}

const COLOR_FIELDS: { key: keyof Theme['colors']; label: string }[] = [
  { key: 'primary', label: 'Primario' }, { key: 'secondary', label: 'Secundario' }, { key: 'accent', label: 'Acento' },
  { key: 'background', label: 'Fondo' }, { key: 'surface', label: 'Superficie (tarjetas)' }, { key: 'text', label: 'Texto' },
  { key: 'muted', label: 'Texto secundario' }, { key: 'border', label: 'Bordes' }, { key: 'success', label: 'Correcto' }, { key: 'error', label: 'Error' },
];
const FONT_OPTIONS = FONTS.map((f) => ({ value: f.id, label: f.label + (f.embedded ? '' : ' (del sistema)') }));
const BAR_STYLES = [{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'primary', label: 'Color primario' }];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="panel-title border-b border-slate-200 pb-1.5 dark:border-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function ThemeEditorModal({ initial, presets, onClose }: { initial: EditState; presets: ThemeRow[]; onClose(): void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [t, setT] = useState<Theme>(initial.data);
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useState('');
  const patch = <K extends keyof Theme>(k: K, v: Partial<Theme[K]>) => setT((o) => ({ ...o, [k]: { ...(o[k] as object), ...(v as object) } }));
  const invalidColors = COLOR_FIELDS.filter((f) => !/^#[0-9a-f]{6}$/i.test(t.colors[f.key] || ''));

  const applyBase = (id: string) => {
    setBase(id);
    const src = presets.find((p) => p.id === id)?.data || PRESET_THEMES.find((p) => p.id === id);
    if (src) setT(normalizeTheme(src));
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Ingresá un nombre para el tema'); return; }
    if (invalidColors.length) { toast.error(`Revisá los colores: ${invalidColors.map((c) => c.label).join(', ')}`); return; }
    setSaving(true);
    try {
      const { id: _omit, ...data } = t as Theme & { id?: string };
      const body = { name: name.trim(), data: { ...data, name: name.trim() } };
      if (initial.id) await api.put(`/themes/${initial.id}`, body); else await api.post('/themes', body);
      await qc.invalidateQueries({ queryKey: ['themes'] });
      toast.success(initial.id ? 'Tema guardado' : 'Tema creado');
      onClose();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={initial.id ? `Editar tema: ${initial.name}` : 'Nuevo tema'} description="Los cambios se ven en la vista previa al instante."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={saving} onClick={save}>{initial.id ? 'Guardar tema' : 'Crear tema'}</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del tema *"><Input autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            {!initial.id && (
              <Field label="Partir de" hint="Reemplaza los valores actuales.">
                <Select value={base} onChange={(e) => applyBase(e.target.value)} options={[{ value: '', label: 'Elegí un tema base…' }, ...presets.map((p) => ({ value: p.id, label: p.name }))]} />
              </Field>
            )}
          </div>

          <Section title="Colores">
            <div className="grid gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} error={invalidColors.includes(f) ? 'Formato #rrggbb' : undefined}>
                  <ColorInput value={t.colors[f.key]} onChange={(v) => patch('colors', { [f.key]: v } as any)} />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Tipografías">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Títulos"><Select value={t.fonts.heading} onChange={(e) => patch('fonts', { heading: e.target.value })} options={FONT_OPTIONS} /></Field>
              <Field label="Cuerpo"><Select value={t.fonts.body} onChange={(e) => patch('fonts', { body: e.target.value })} options={FONT_OPTIONS} /></Field>
              <Field label="Peso de títulos">
                <Select value={t.headings.weight} onChange={(e) => patch('headings', { weight: Number(e.target.value) })}
                  options={[400, 500, 600, 700, 800, 900].map((w) => ({ value: w, label: { 400: 'Normal (400)', 500: 'Medio (500)', 600: 'Semi negrita (600)', 700: 'Negrita (700)', 800: 'Extra negrita (800)', 900: 'Black (900)' }[w]! }))} />
              </Field>
              <Field label="Transformación de títulos">
                <Select value={t.headings.transform} onChange={(e) => patch('headings', { transform: e.target.value as any })} options={[{ value: 'none', label: 'Sin cambios' }, { value: 'uppercase', label: 'MAYÚSCULAS' }]} />
              </Field>
            </div>
            <p className="text-[11.5px] text-slate-500">Las fuentes marcadas sin “(del sistema)” se incluyen en el SCORM y funcionan sin conexión.</p>
          </Section>

          <Section title="Botones">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estilo">
                <div className="flex gap-1">
                  {(['filled', 'outline', 'soft'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => patch('buttons', { style: s })}
                      className={clsx('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium', t.buttons.style === s ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-300 dark:border-slate-700')}>
                      {{ filled: 'Relleno', outline: 'Contorno', soft: 'Suave' }[s]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={`Redondeo: ${t.buttons.radius >= 999 ? 'píldora' : t.buttons.radius + 'px'}`}>
                <input type="range" min={0} max={30} value={Math.min(t.buttons.radius, 30)} onChange={(e) => patch('buttons', { radius: Number(e.target.value) === 30 ? 999 : Number(e.target.value) })} className="w-full accent-brand-600" />
              </Field>
            </div>
            <Switch checked={t.buttons.uppercase} onChange={(uppercase) => patch('buttons', { uppercase })} label="Texto de botones en mayúsculas" />
          </Section>

          <Section title="Tarjetas">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Redondeo: ${t.cards.radius}px`}>
                <input type="range" min={0} max={32} value={t.cards.radius} onChange={(e) => patch('cards', { radius: Number(e.target.value) })} className="w-full accent-brand-600" />
              </Field>
              <Field label="Sombra">
                <Select value={t.cards.shadow} onChange={(e) => patch('cards', { shadow: e.target.value as any })} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'sm', label: 'Sutil' }, { value: 'md', label: 'Media' }, { value: 'lg', label: 'Pronunciada' }]} />
              </Field>
            </div>
            <Switch checked={t.cards.border} onChange={(border) => patch('cards', { border })} label="Mostrar borde en tarjetas" />
          </Section>

          <Section title="Encabezado, menú y progreso">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Encabezado"><Select value={t.header.style} onChange={(e) => patch('header', { style: e.target.value as any })} options={BAR_STYLES} /></Field>
              <Field label="Menú lateral"><Select value={t.menu.style} onChange={(e) => patch('menu', { style: e.target.value as any })} options={BAR_STYLES} /></Field>
              <Field label="Progreso"><Select value={t.progress.style} onChange={(e) => patch('progress', { style: e.target.value as any })} options={[{ value: 'bar', label: 'Barra' }, { value: 'steps', label: 'Pasos' }, { value: 'percent', label: 'Porcentaje' }]} /></Field>
            </div>
          </Section>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="panel-title mb-2">Vista previa</div>
          <ThemePreview theme={t} />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key} className="text-center">
                <div className="h-7 rounded-md border border-slate-200 dark:border-slate-700" style={{ background: t.colors[f.key] }} />
                <div className="mt-0.5 truncate text-[10px] text-slate-500">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
