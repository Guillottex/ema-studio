import { useState } from 'react';
import clsx from 'clsx';
import {
  AlignLeft, AlignCenter, AlignRight, AlignJustify, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal,
  AlignEndHorizontal, Lock, Unlock, Trash2, Copy, Play, Plus, X, Monitor, Tablet, Smartphone, Save, Eye, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowUpToLine, ArrowDownToLine, ChevronsUp, ChevronsDown,
} from 'lucide-react';
import { getDef, FONTS, animationClasses, type Action, type ActionType, type AnimationConfig, type ComponentData, type ComponentEvent, type Condition, type ComponentStyle } from '@engine';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { ColorInput, Field, Input, Select, Switch, Tabs, Textarea, Button, promptDialog } from '../components/ui';
import { MediaField } from '../components/MediaPicker';
import { FieldRenderer, ScreenPicker, ComponentPicker } from './fields/FieldRenderer';
import { DynIcon } from './Palette';
import { useEditor, mutate, updateComponent, boxOf, editableBp, setBoxes, align, distribute, deleteSelected, duplicateSelected, reorder, saveNow } from './store';

/* agrupar cambios consecutivos del mismo campo en un solo paso de deshacer */
let lastKey = '';
let lastAt = 0;
function patch(id: string, key: string, fn: (c: ComponentData) => void) {
  const now = Date.now();
  const history = !(key === lastKey && now - lastAt < 1200);
  lastKey = key;
  lastAt = now;
  updateComponent(id, fn, history);
}
function patchScreen(key: string, fn: (s: any) => void) {
  const now = Date.now();
  const history = !(key === lastKey && now - lastAt < 1200);
  lastKey = key;
  lastAt = now;
  mutate(fn, { history });
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2.5 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
    <div className="panel-title">{title}</div>
    {children}
  </div>
);

const Seg = ({ value, options, onChange }: { value: string | undefined; options: { v: string; icon: any; title: string }[]; onChange(v: string): void }) => (
  <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
    {options.map((o) => (
      <button key={o.v} type="button" title={o.title} onClick={() => onChange(o.v)} className={clsx('grid h-7 w-8 place-items-center rounded-md', value === o.v ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')}>
        <o.icon className="h-3.5 w-3.5" />
      </button>
    ))}
  </div>
);

export function PropertiesPanel() {
  const screen = useEditor((s) => s.screen);
  const selected = useEditor((s) => s.selected);
  if (!screen) return <div className="p-4 text-sm text-slate-500">Sin pantalla seleccionada.</div>;
  const comps = screen.components.filter((c) => selected.includes(c.id));
  if (comps.length === 0) return <ScreenProps />;
  if (comps.length > 1) return <MultiProps count={comps.length} />;
  return <ComponentProps key={comps[0].id} comp={comps[0]} />;
}

/* ------------------------------ selección múltiple ------------------------------ */

function AlignTools() {
  return (
    <div className="flex flex-wrap gap-1">
      <button className="icon-btn" title="Alinear a la izquierda" onClick={() => align('left')}><AlignStartVertical className="h-4 w-4" /></button>
      <button className="icon-btn" title="Centrar horizontalmente" onClick={() => align('hcenter')}><AlignCenterVertical className="h-4 w-4" /></button>
      <button className="icon-btn" title="Alinear a la derecha" onClick={() => align('right')}><AlignEndVertical className="h-4 w-4" /></button>
      <button className="icon-btn" title="Alinear arriba" onClick={() => align('top')}><AlignStartHorizontal className="h-4 w-4" /></button>
      <button className="icon-btn" title="Centrar verticalmente" onClick={() => align('vcenter')}><AlignCenterHorizontal className="h-4 w-4" /></button>
      <button className="icon-btn" title="Alinear abajo" onClick={() => align('bottom')}><AlignEndHorizontal className="h-4 w-4" /></button>
      <button className="icon-btn" title="Distribuir horizontalmente" onClick={() => distribute('h')}><AlignHorizontalDistributeCenter className="h-4 w-4" /></button>
      <button className="icon-btn" title="Distribuir verticalmente" onClick={() => distribute('v')}><AlignVerticalDistributeCenter className="h-4 w-4" /></button>
    </div>
  );
}

function OrderTools() {
  return (
    <div className="flex flex-wrap gap-1">
      <button className="icon-btn" title="Traer al frente" onClick={() => reorder('front')}><ArrowUpToLine className="h-4 w-4" /></button>
      <button className="icon-btn" title="Subir una capa" onClick={() => reorder('forward')}><ChevronsUp className="h-4 w-4" /></button>
      <button className="icon-btn" title="Bajar una capa" onClick={() => reorder('backward')}><ChevronsDown className="h-4 w-4" /></button>
      <button className="icon-btn" title="Enviar al fondo" onClick={() => reorder('back')}><ArrowDownToLine className="h-4 w-4" /></button>
      <span className="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
      <button className="icon-btn" title="Duplicar (Ctrl+D)" onClick={duplicateSelected}><Copy className="h-4 w-4" /></button>
      <button className="icon-btn text-red-500" title="Eliminar (Supr)" onClick={deleteSelected}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function MultiProps({ count }: { count: number }) {
  return (
    <div>
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div className="font-semibold">{count} componentes seleccionados</div><div className="text-xs text-slate-500">Shift + clic para sumar o quitar de la selección.</div></div>
      <Section title="Alinear y distribuir"><AlignTools /></Section>
      <Section title="Capas y acciones"><OrderTools /></Section>
    </div>
  );
}

/* ------------------------------ componente ------------------------------ */

type Tab = 'content' | 'style' | 'anim' | 'events' | 'responsive';

function ComponentProps({ comp }: { comp: ComponentData }) {
  const [tab, setTab] = useState<Tab>('content');
  const def = getDef(comp.type);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><DynIcon name={def?.icon || 'square'} className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{def?.label || comp.type}</div>
          <input className="w-full bg-transparent text-xs text-slate-500 outline-none placeholder:text-slate-400" placeholder="Nombre (opcional, para interacciones)" value={comp.name || ''}
            onChange={(e) => patch(comp.id, 'name', (c) => { c.name = e.target.value || undefined; })} />
        </div>
        <button className="icon-btn" title={comp.locked ? 'Desbloquear' : 'Bloquear posición'} onClick={() => updateComponent(comp.id, (c) => { c.locked = !c.locked; })}>{comp.locked ? <Lock className="h-4 w-4 text-amber-500" /> : <Unlock className="h-4 w-4" />}</button>
      </div>
      <Tabs size="sm" className="overflow-x-auto px-1" value={tab} onChange={(v) => setTab(v as Tab)} tabs={[{ id: 'content', label: 'Contenido' }, { id: 'style', label: 'Estilo' }, { id: 'anim', label: 'Animación' }, { id: 'events', label: 'Interacción' }, { id: 'responsive', label: 'Responsive' }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'content' && (
          <div className="space-y-3 px-4 py-3.5">
            {(def?.fields || []).map((f) => (
              <FieldRenderer key={f.key} field={f} value={comp.props[f.key]} props={comp.props}
                onChange={(v) => patch(comp.id, 'p:' + f.key, (c) => { c.props[f.key] = v; })}
                onPatch={(p) => updateComponent(comp.id, (c) => { Object.assign(c.props, p); })} />
            ))}
            {def?.inline && <p className="text-[11px] text-slate-500">Tip: hacé doble clic sobre el componente para editar el texto directamente en el lienzo.</p>}
          </div>
        )}
        {tab === 'style' && <StyleTab comp={comp} />}
        {tab === 'anim' && <AnimTab comp={comp} />}
        {tab === 'events' && <EventsTab comp={comp} />}
        {tab === 'responsive' && <ResponsiveTab comp={comp} />}
      </div>
    </div>
  );
}

function StyleTab({ comp }: { comp: ComponentData }) {
  const s = comp.style || {};
  const bp = useEditor((x) => x.bp);
  const screen = useEditor((x) => x.screen)!;
  const eb = editableBp(screen, bp);
  const box = eb ? boxOf(comp, eb) : comp.layout.desktop;
  const setS = (k: keyof ComponentStyle, v: any) => patch(comp.id, 's:' + k, (c) => { (c.style as any)[k] = v === '' || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : v; });
  const num = (k: keyof ComponentStyle, label: string, min = 0, max = 400, step = 1) => (
    <Field label={label}><Input sm type="number" min={min} max={max} step={step} value={(s as any)[k] ?? ''} placeholder="auto" onChange={(e) => setS(k, e.target.value === '' ? undefined : Number(e.target.value))} /></Field>
  );
  return (
    <div>
      <Section title="Posición y tamaño">
        {eb ? (
          <div className="grid grid-cols-4 gap-1.5">
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <Field key={k} label={{ x: 'X', y: 'Y', w: 'Ancho', h: 'Alto' }[k]}>
                <Input sm type="number" value={Math.round(box[k])} disabled={comp.locked} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) { const now = Date.now(); const h = !('b:' + k === lastKey && now - lastAt < 1200); lastKey = 'b:' + k; lastAt = now; setBoxes({ [comp.id]: { [k]: k === 'w' || k === 'h' ? Math.max(8, v) : v } }, eb, h); } }} />
              </Field>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">Vista automática: la posición se calcula sola. Personalizá el dispositivo para mover componentes.</p>}
        <AlignTools />
        <OrderTools />
      </Section>
      <Section title="Tipografía">
        <Field label="Fuente">
          <Select sm value={s.fontFamily || ''} onChange={(e) => setS('fontFamily', e.target.value)}>
            <option value="">Según el tema</option>
            {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}{f.embedded ? '' : ' (del sistema)'}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-1.5">
          {num('fontSize', 'Tamaño', 8, 160)}
          <Field label="Peso"><Select sm value={s.fontWeight ?? ''} onChange={(e) => setS('fontWeight', e.target.value ? Number(e.target.value) : undefined)} options={[{ value: '', label: 'Auto' }, { value: 400, label: 'Normal' }, { value: 500, label: 'Medio' }, { value: 600, label: 'Semi' }, { value: 700, label: 'Negrita' }, { value: 800, label: 'Extra' }]} /></Field>
          {num('lineHeight', 'Interlineado', 0.8, 3, 0.1)}
        </div>
        <Field label="Color de texto"><ColorInput value={s.color || ''} onChange={(v) => setS('color', v)} allowEmpty /></Field>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={s.textAlign} onChange={(v) => setS('textAlign', s.textAlign === v ? undefined : v)} options={[{ v: 'left', icon: AlignLeft, title: 'Izquierda' }, { v: 'center', icon: AlignCenter, title: 'Centro' }, { v: 'right', icon: AlignRight, title: 'Derecha' }, { v: 'justify', icon: AlignJustify, title: 'Justificado' }]} />
          <Seg value={s.verticalAlign} onChange={(v) => setS('verticalAlign', s.verticalAlign === v ? undefined : v)} options={[{ v: 'top', icon: AlignStartHorizontal, title: 'Arriba' }, { v: 'middle', icon: AlignCenterHorizontal, title: 'Medio' }, { v: 'bottom', icon: AlignEndHorizontal, title: 'Abajo' }]} />
          <button type="button" className={clsx('btn btn-xs', s.fontStyle === 'italic' ? 'btn-primary' : 'btn-secondary')} onClick={() => setS('fontStyle', s.fontStyle === 'italic' ? undefined : 'italic')}><i>Cursiva</i></button>
        </div>
      </Section>
      <Section title="Caja">
        <Field label="Fondo"><ColorInput value={s.background || ''} onChange={(v) => setS('background', v)} allowEmpty placeholder="Transparente" /></Field>
        <div className="grid grid-cols-3 gap-1.5">
          {num('padding', 'Relleno', 0, 200)}
          {num('margin', 'Margen', 0, 200)}
          {num('borderRadius', 'Redondeo', 0, 400)}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {num('borderWidth', 'Borde (px)', 0, 30)}
          <Field label="Estilo de borde"><Select sm value={s.borderStyle || 'solid'} onChange={(e) => setS('borderStyle', e.target.value)} options={[{ value: 'solid', label: 'Continuo' }, { value: 'dashed', label: 'Guiones' }, { value: 'dotted', label: 'Puntos' }]} /></Field>
        </div>
        {!!s.borderWidth && <Field label="Color de borde"><ColorInput value={s.borderColor || ''} onChange={(v) => setS('borderColor', v)} allowEmpty /></Field>}
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Sombra"><Select sm value={s.shadow || 'none'} onChange={(e) => setS('shadow', e.target.value)} options={[{ value: 'none', label: 'Ninguna' }, { value: 'sm', label: 'Suave' }, { value: 'md', label: 'Media' }, { value: 'lg', label: 'Fuerte' }]} /></Field>
          {num('rotation', 'Rotación (°)', -180, 180)}
        </div>
        <Field label={`Opacidad: ${Math.round((s.opacity ?? 1) * 100)}%`}><input type="range" min={0.05} max={1} step={0.05} value={s.opacity ?? 1} onChange={(e) => setS('opacity', Number(e.target.value) >= 1 ? undefined : Number(e.target.value))} className="w-full accent-brand-600" /></Field>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => updateComponent(comp.id, (c) => { const d = getDef(c.type); c.style = d?.defaultStyle ? d.defaultStyle() : {}; })}>Restablecer estilo</button>
      </Section>
    </div>
  );
}

const ANIMS = [
  { value: 'none', label: 'Sin animación' }, { value: 'fade', label: 'Fundido (fade)' }, { value: 'slide', label: 'Deslizar (slide)' }, { value: 'zoom', label: 'Zoom' },
  { value: 'bounce', label: 'Rebote (bounce)' }, { value: 'appear', label: 'Aparecer' }, { value: 'scroll', label: 'Desplazamiento (al hacer scroll)' },
];

export function previewAnimation(id: string, a: AnimationConfig) {
  const el = document.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
  if (!el || a.type === 'none') return;
  const { cls, vars } = animationClasses({ ...a, trigger: 'load' });
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  el.classList.add(...cls);
  void el.offsetWidth;
  el.classList.add('ema-anim-run');
  setTimeout(() => el.classList.remove(...cls, 'ema-anim-run'), (a.duration || 600) + (a.delay || 0) + 150);
}

function AnimTab({ comp }: { comp: ComponentData }) {
  const a: AnimationConfig = { type: 'none', duration: 600, delay: 0, direction: 'up', trigger: 'load', ...(comp.animation || {}) };
  const setA = (p: Partial<AnimationConfig>) => patch(comp.id, 'anim', (c) => { c.animation = { ...a, ...p }; });
  return (
    <Section title="Animación de entrada">
      <Field label="Tipo"><Select sm value={a.type} onChange={(e) => setA({ type: e.target.value as any, ...(e.target.value === 'scroll' ? { trigger: 'scroll' } : {}) })} options={ANIMS} /></Field>
      {a.type !== 'none' && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Duración (ms)"><Input sm type="number" min={100} max={5000} step={100} value={a.duration} onChange={(e) => setA({ duration: Number(e.target.value) || 600 })} /></Field>
            <Field label="Retraso (ms)"><Input sm type="number" min={0} max={10000} step={100} value={a.delay} onChange={(e) => setA({ delay: Number(e.target.value) || 0 })} /></Field>
          </div>
          {(a.type === 'slide' || a.type === 'scroll') && (
            <Field label="Dirección"><Select sm value={a.direction} onChange={(e) => setA({ direction: e.target.value as any })} options={[{ value: 'up', label: 'Desde abajo' }, { value: 'down', label: 'Desde arriba' }, { value: 'left', label: 'Desde la derecha' }, { value: 'right', label: 'Desde la izquierda' }]} /></Field>
          )}
          <Field label="Activación">
            <Select sm value={a.type === 'scroll' ? 'scroll' : a.trigger} disabled={a.type === 'scroll'} onChange={(e) => setA({ trigger: e.target.value as any })}
              options={[{ value: 'load', label: 'Al mostrarse la pantalla' }, { value: 'scroll', label: 'Al llegar con el scroll' }, { value: 'click', label: 'Al hacer clic en el componente' }, { value: 'action', label: 'Cuando una acción lo muestra' }]} />
          </Field>
          <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={() => previewAnimation(comp.id, a)}>Previsualizar</Button>
          <p className="text-[11px] text-slate-500">Las animaciones respetan la preferencia de “movimiento reducido” del alumno.</p>
        </>
      )}
    </Section>
  );
}

const ACTIONS: { value: ActionType; label: string }[] = [
  { value: 'show', label: 'Mostrar componente' }, { value: 'hide', label: 'Ocultar componente' }, { value: 'toggle', label: 'Mostrar/ocultar componente' },
  { value: 'openModal', label: 'Abrir ventana' }, { value: 'message', label: 'Mostrar mensaje' }, { value: 'goto', label: 'Ir a pantalla' },
  { value: 'next', label: 'Pantalla siguiente' }, { value: 'prev', label: 'Pantalla anterior' }, { value: 'home', label: 'Ir al inicio' },
  { value: 'playMedia', label: 'Reproducir audio/video' }, { value: 'pauseMedia', label: 'Pausar audio/video' }, { value: 'animate', label: 'Ejecutar animación' },
  { value: 'complete', label: 'Marcar actividad completada' }, { value: 'setVar', label: 'Asignar variable' },
];

function ActionEditor({ a, compId, onChange, onRemove }: { a: Action; compId: string; onChange(a: Action): void; onRemove(): void }) {
  const set = (p: Partial<Action>) => onChange({ ...a, ...p });
  const needsTarget = ['show', 'hide', 'toggle', 'playMedia', 'pauseMedia', 'animate'].includes(a.type);
  return (
    <div className="space-y-1.5 rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
      <div className="flex gap-1">
        <Select sm value={a.type} onChange={(e) => onChange({ type: e.target.value as ActionType })} options={ACTIONS} />
        <button type="button" className="icon-btn h-8 w-8 flex-none" title="Quitar acción" onClick={onRemove}><X className="h-3.5 w-3.5" /></button>
      </div>
      {needsTarget && <ComponentPicker value={a.target || ''} onChange={(target) => set({ target })} exclude={a.type === 'animate' ? undefined : compId} filter={a.type.includes('Media') ? (t) => ['video', 'audio', 'embed'].includes(t) : undefined} />}
      {a.type === 'openModal' && (
        <>
          <ComponentPicker value={a.target || ''} onChange={(target) => set({ target })} filter={(t) => t === 'modal'} emptyLabel="(ventana definida aquí)" />
          {!a.target && <><Input sm placeholder="Título" value={a.title || ''} onChange={(e) => set({ title: e.target.value })} /><Textarea rows={2} placeholder="Contenido" value={a.text || ''} onChange={(e) => set({ text: e.target.value })} /></>}
        </>
      )}
      {a.type === 'message' && <><Input sm placeholder="Título" value={a.title || ''} onChange={(e) => set({ title: e.target.value })} /><Textarea rows={2} placeholder="Mensaje" value={a.text || ''} onChange={(e) => set({ text: e.target.value })} /></>}
      {a.type === 'goto' && <ScreenPicker value={a.screenId || ''} onChange={(screenId) => set({ screenId })} />}
      {a.type === 'animate' && <Select sm value={a.animation || 'bounce'} onChange={(e) => set({ animation: e.target.value as any })} options={ANIMS.filter((x) => x.value !== 'none')} />}
      {a.type === 'complete' && <ComponentPicker value={a.target || ''} onChange={(target) => set({ target })} emptyLabel="(este componente)" />}
      {a.type === 'setVar' && <div className="flex gap-1"><Input sm placeholder="variable" value={a.varName || ''} onChange={(e) => set({ varName: e.target.value })} /><Input sm placeholder="valor" value={a.value || ''} onChange={(e) => set({ value: e.target.value })} /></div>}
    </div>
  );
}

function EventsTab({ comp }: { comp: ComponentData }) {
  const events = comp.events || [];
  const setEvents = (ev: ComponentEvent[]) => patch(comp.id, 'events', (c) => { c.events = ev; });
  const cond: Condition = comp.visibility?.condition || { type: 'always' };
  const setCond = (p: Partial<Condition>) => patch(comp.id, 'cond', (c) => { c.visibility = { ...(c.visibility || {}), condition: { ...cond, ...p } }; });
  const quizComps = (t: string) => t === 'quiz';
  return (
    <div>
      <Section title="Eventos y acciones">
        {events.length === 0 && <p className="text-xs text-slate-500">Agregá un evento para que el componente responda a la interacción del alumno (por ejemplo, al hacer clic mostrar otro elemento o ir a una pantalla).</p>}
        {events.map((ev, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-500">Cuando</span>
              <Select sm value={ev.trigger} onChange={(e) => setEvents(events.map((x, j) => (j === i ? { ...x, trigger: e.target.value as any } : x)))}
                options={[{ value: 'click', label: 'se hace clic' }, { value: 'hover', label: 'se pasa el cursor' }, { value: 'complete', label: 'se completa la actividad' }]} />
              <button type="button" className="icon-btn h-8 w-8 flex-none" title="Eliminar evento" onClick={() => setEvents(events.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {ev.actions.map((a, k) => (
              <ActionEditor key={k} a={a} compId={comp.id}
                onChange={(na) => setEvents(events.map((x, j) => (j === i ? { ...x, actions: x.actions.map((y, m) => (m === k ? na : y)) } : x)))}
                onRemove={() => setEvents(events.map((x, j) => (j === i ? { ...x, actions: x.actions.filter((_, m) => m !== k) } : x)))} />
            ))}
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEvents(events.map((x, j) => (j === i ? { ...x, actions: [...x.actions, { type: 'show' as ActionType }] } : x)))}><Plus className="h-3 w-3" />Acción</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEvents([...events, { trigger: 'click', actions: [{ type: 'show' }] }])}><Plus className="h-3.5 w-3.5" />Agregar evento</button>
      </Section>
      <Section title="Visibilidad y condiciones">
        <Switch checked={!!comp.visibility?.hidden} onChange={(v) => patch(comp.id, 'hidden', (c) => { c.visibility = { ...(c.visibility || {}), hidden: v }; })} label="Oculto al inicio" hint="Se muestra con una acción “Mostrar componente”." />
        <Field label="Mostrar sólo cuando…">
          <Select sm value={cond.type} onChange={(e) => setCond({ type: e.target.value as any, target: '', value: '' })} options={[
            { value: 'always', label: 'Siempre' }, { value: 'screenComplete', label: 'Se completaron las actividades de la pantalla' },
            { value: 'componentComplete', label: 'Se completó una actividad específica' }, { value: 'quizPassed', label: 'Se aprobó una evaluación' },
            { value: 'screenVisited', label: 'Se visitó una pantalla' }, { value: 'variable', label: 'Una variable tiene un valor' },
          ]} />
        </Field>
        {cond.type === 'componentComplete' && <ComponentPicker value={cond.target || ''} onChange={(target) => setCond({ target })} exclude={comp.id} />}
        {cond.type === 'quizPassed' && <ComponentPicker value={cond.target || ''} onChange={(target) => setCond({ target })} filter={quizComps} emptyLabel="(evaluación final del curso)" />}
        {cond.type === 'screenVisited' && <ScreenPicker value={cond.target || ''} onChange={(target) => setCond({ target })} />}
        {cond.type === 'screenComplete' && <ScreenPicker value={cond.target || ''} onChange={(target) => setCond({ target })} emptyLabel="(esta pantalla)" />}
        {cond.type === 'variable' && <div className="flex gap-1"><Input sm placeholder="variable" value={cond.target || ''} onChange={(e) => setCond({ target: e.target.value })} /><Input sm placeholder="valor" value={cond.value || ''} onChange={(e) => setCond({ value: e.target.value })} /></div>}
        {cond.type !== 'always' && <p className="text-[11px] text-slate-500">Ejemplo: un botón “Siguiente” visible sólo cuando el alumno completó la actividad.</p>}
      </Section>
    </div>
  );
}

function ResponsiveTab({ comp }: { comp: ComponentData }) {
  const screen = useEditor((s) => s.screen)!;
  const toggleHide = (bp: 'tablet' | 'mobile', v: boolean) => updateComponent(comp.id, (c) => {
    const base = c.layout[bp] || { ...c.layout.desktop };
    c.layout[bp] = { ...base, hidden: v };
  });
  return (
    <Section title="Comportamiento por dispositivo">
      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2"><Monitor className="h-4 w-4" />Escritorio: posición libre (diseño base de 1200 px).</div>
        <div className="flex items-center gap-2"><Tablet className="h-4 w-4" />Tablet: {screen.tabletMode === 'custom' ? 'diseño personalizado' : 'escala del diseño de escritorio'}.</div>
        <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Celular: {screen.mobileMode === 'custom' ? 'diseño personalizado' : 'apilado automático en una columna'}.</div>
      </div>
      <Switch checked={!!comp.layout.tablet?.hidden} onChange={(v) => toggleHide('tablet', v)} label="Ocultar en tablet" />
      <Switch checked={!!comp.layout.mobile?.hidden} onChange={(v) => toggleHide('mobile', v)} label="Ocultar en celular" />
      <p className="text-[11px] text-slate-500">Usá los botones de dispositivo de la barra superior para ver y ajustar el diseño de cada resolución.</p>
    </Section>
  );
}

/* ------------------------------ pantalla ------------------------------ */

function ScreenProps() {
  const screen = useEditor((s) => s.screen)!;
  const courseId = useEditor((s) => s.courseId);
  const bg = screen.background || {};
  const setBg = (p: any) => patchScreen('bg', (s) => { s.background = { ...(s.background || {}), ...p }; });
  const setSet = (p: any) => mutate((s) => { s.settings = { ...(s.settings || {}), ...p }; });
  const saveTemplate = async () => {
    const name = await promptDialog({ title: 'Guardar pantalla como plantilla', label: 'Nombre de la plantilla', value: screen.title });
    if (!name) return;
    await saveNow();
    try {
      await api.post('/templates/from-screen', { screenId: screen.id, name });
      toast.success('Plantilla guardada en “Mis plantillas”');
    } catch (e) { toast.error(e); }
  };
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div className="font-semibold">Pantalla</div><div className="text-xs text-slate-500">Seleccioná un componente para editarlo.</div></div>
      <Section title="General">
        <Field label="Título"><Input sm value={screen.title} onChange={(e) => patchScreen('title', (s) => { s.title = e.target.value; })} /></Field>
        <Field label="Alto de la pantalla (px)" hint="El ancho de diseño es 1200 px. Aumentá el alto para pantallas con scroll.">
          <div className="flex gap-1">
            <Input sm type="number" min={300} max={10000} step={25} value={screen.height} onChange={(e) => patchScreen('height', (s) => { s.height = Math.max(300, Number(e.target.value) || 675); })} />
            <Select sm className="w-32" value="" onChange={(e) => e.target.value && mutate((s) => { s.height = Number(e.target.value); })} options={[{ value: '', label: 'Presets' }, { value: 675, label: '16:9 (675)' }, { value: 900, label: '4:3 (900)' }, { value: 1200, label: 'Larga (1200)' }, { value: 1800, label: 'Muy larga (1800)' }]} />
          </div>
        </Field>
        <Button size="sm" onClick={() => useEditor.setState({ leftTab: 'layouts' })}>Cambiar layout…</Button>
      </Section>
      <Section title="Fondo">
        <Field label="Color"><ColorInput value={bg.color || ''} onChange={(v) => setBg({ color: v || undefined })} allowEmpty placeholder="Según el tema" /></Field>
        <Field label="Imagen"><MediaField value={bg.image || ''} onChange={(v) => setBg({ image: v || undefined })} /></Field>
        {bg.image && (
          <>
            <Field label="Capa de color (rgba)"><Input sm value={bg.overlay || ''} placeholder="rgba(0,0,0,0.3)" onChange={(e) => setBg({ overlay: e.target.value || undefined })} /></Field>
            <Field label="Ajuste"><Select sm value={bg.size || 'cover'} onChange={(e) => setBg({ size: e.target.value })} options={[{ value: 'cover', label: 'Cubrir' }, { value: 'contain', label: 'Contener' }]} /></Field>
          </>
        )}
      </Section>
      <Section title="Navegación">
        <Switch checked={!!screen.settings?.requireCompletion} onChange={(v) => setSet({ requireCompletion: v })} label="Exigir completar las actividades" hint="El botón Siguiente se habilita cuando el alumno completa preguntas e interactivos." />
        <Switch checked={!!screen.settings?.hideNav} onChange={(v) => setSet({ hideNav: v })} label="Ocultar barra de navegación" hint="Usá botones de navegación dentro de la pantalla." />
      </Section>
      <Section title="Notas del autor">
        <Textarea rows={3} value={screen.settings?.notes || ''} placeholder="Notas internas (no se muestran al alumno)" onChange={(e) => patchScreen('notes', (s) => { s.settings = { ...(s.settings || {}), notes: e.target.value }; })} />
      </Section>
      <Section title="Acciones">
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" icon={<Eye className="h-3.5 w-3.5" />} onClick={async () => { await saveNow(); window.open(`/cursos/${courseId}/preview?pantalla=${screen.id}`, '_blank'); }}>Previsualizar pantalla</Button>
          <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={saveTemplate}>Guardar como plantilla</Button>
        </div>
      </Section>
    </div>
  );
}
