import { create } from 'zustand';
import { produce } from 'immer';
import { STAGE_WIDTH, uid, stageHeight, type Box, type Breakpoint, type ComponentData, type ScreenData } from '@engine';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

export interface TreeScreen { id: string; title: string; layout?: string; component_count: number }
export interface TreeLesson { id: string; title: string; screens: TreeScreen[] }
export interface TreeModule { id: string; title: string; lessons: TreeLesson[] }

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface EditorState {
  courseId: string;
  course: any | null;
  tree: TreeModule[];
  screenId: string | null;
  screen: ScreenData | null;
  selected: string[];
  bp: Breakpoint;
  zoom: number;
  zoomMode: 'fit' | 'manual';
  past: ScreenData[];
  future: ScreenData[];
  saveState: SaveState;
  lastSavedAt: Date | null;
  saveError: string;
  editingId: string | null;
  showGrid: boolean;
  snap: boolean;
  clipboard: ComponentData[];
  leftTab: 'structure' | 'components' | 'layouts';
}

const initial: EditorState = {
  courseId: '', course: null, tree: [], screenId: null, screen: null, selected: [], bp: 'desktop', zoom: 0.7, zoomMode: 'fit',
  past: [], future: [], saveState: 'idle', lastSavedAt: null, saveError: '', editingId: null, showGrid: false, snap: true,
  clipboard: [], leftTab: 'structure',
};

export const useEditor = create<EditorState>(() => ({ ...initial }));
const get = useEditor.getState;
const set = useEditor.setState;

/* ------------------------------ guardado ------------------------------ */

let saveTimer: any = null;
let saving: Promise<void> | null = null;
let pending = false;
const BACKUP = (id: string) => `ema-draft:${id}`;

function backup(s: ScreenData) {
  try { localStorage.setItem(BACKUP(s.id), JSON.stringify({ at: Date.now(), screen: s })); } catch { /* sin espacio */ }
}

function payload(s: ScreenData) {
  return { title: s.title, layout: s.layout ?? null, height: s.height, background: s.background || {}, settings: s.settings || {}, tabletMode: s.tabletMode || 'auto', mobileMode: s.mobileMode || 'auto', components: s.components };
}

export async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  if (saving) { pending = true; return saving; }
  const s = get().screen;
  if (!s || get().saveState !== 'dirty') return;
  set({ saveState: 'saving' });
  saving = (async () => {
    try {
      await api.put(`/screens/${s.id}`, payload(s));
      const still = get().screen;
      const changed = still && still !== s && still.id === s.id;
      set({ saveState: changed ? 'dirty' : 'saved', lastSavedAt: new Date(), saveError: '' });
      if (!changed) { try { localStorage.removeItem(BACKUP(s.id)); } catch { /* */ } }
      // refrescar el título/cantidad en el árbol
      set({ tree: produce(get().tree, (t) => { t.forEach((m) => m.lessons.forEach((l) => l.screens.forEach((x) => { if (x.id === s.id) { x.title = s.title; x.component_count = s.components.length; x.layout = s.layout; } }))); }) });
    } catch (e: any) {
      set({ saveState: 'error', saveError: e.message || 'Error al guardar' });
    } finally {
      saving = null;
    }
  })();
  await saving;
  if (pending || get().saveState === 'dirty') { pending = false; if (get().saveState === 'dirty') return saveNow(); }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveNow(); }, 1200);
}

/** Guardado de emergencia al cerrar la pestaña (fetch keepalive) */
export function flushOnUnload() {
  const s = get().screen;
  if (!s || (get().saveState !== 'dirty' && get().saveState !== 'error')) return false;
  backup(s);
  api.put(`/screens/${s.id}`, payload(s), { keepalive: true }).catch(() => undefined);
  return true;
}

/* ------------------------------ mutaciones ------------------------------ */

/** Aplica un cambio a la pantalla actual (con historial para deshacer) */
export function mutate(fn: (s: ScreenData) => void, opts: { history?: boolean } = {}) {
  const cur = get().screen;
  if (!cur) return;
  const next = produce(cur, fn);
  if (next === cur) return;
  const history = opts.history !== false;
  set({
    screen: next,
    past: history ? [...get().past.slice(-99), cur] : get().past,
    future: history ? [] : get().future,
    saveState: 'dirty',
  });
  backup(next);
  scheduleSave();
}

/** Inicio de un gesto (arrastrar/redimensionar): guarda un punto de deshacer */
export function beginGesture() {
  const cur = get().screen;
  if (cur) set({ past: [...get().past.slice(-99), cur], future: [] });
}

export function undo() {
  const { past, screen, future } = get();
  if (!past.length || !screen) return;
  const prev = past[past.length - 1];
  set({ screen: prev, past: past.slice(0, -1), future: [screen, ...future], saveState: 'dirty', selected: get().selected.filter((id) => prev.components.some((c) => c.id === id)) });
  backup(prev);
  scheduleSave();
}

export function redo() {
  const { past, screen, future } = get();
  if (!future.length || !screen) return;
  const next = future[0];
  set({ screen: next, past: [...past, screen], future: future.slice(1), saveState: 'dirty' });
  backup(next);
  scheduleSave();
}

/* ------------------------------ carga ------------------------------ */

export async function loadCourse(courseId: string) {
  set({ ...initial, courseId, clipboard: get().clipboard });
  const [course, tree] = await Promise.all([api.get(`/courses/${courseId}`), api.get<TreeModule[]>(`/courses/${courseId}/tree`)]);
  set({ course, tree });
  return { course, tree };
}

export async function reloadTree() {
  const tree = await api.get<TreeModule[]>(`/courses/${get().courseId}/tree`);
  set({ tree });
  return tree;
}

export async function openScreen(id: string) {
  if (get().screenId === id && get().screen) return;
  await saveNow();
  set({ screenId: id, selected: [], editingId: null });
  try {
    const s = await api.get<ScreenData & { updatedAt: string }>(`/screens/${id}`);
    if (get().screenId !== id) return;
    const { updatedAt, ...screen } = s as any;
    set({ screen, past: [], future: [], saveState: 'idle' });
    // recuperación de cambios locales no guardados (cierre accidental del navegador)
    try {
      const raw = localStorage.getItem(BACKUP(id));
      if (raw) {
        const b = JSON.parse(raw);
        const serverTime = new Date(updatedAt).getTime();
        if (b.at > serverTime + 1000 && JSON.stringify(payload(b.screen)) !== JSON.stringify(payload(screen))) {
          return { recoverable: b as { at: number; screen: ScreenData } };
        }
        localStorage.removeItem(BACKUP(id));
      }
    } catch { /* */ }
  } catch (e) {
    toast.error(e);
    set({ screen: null });
  }
  return {};
}

export function restoreBackup(b: { screen: ScreenData }) {
  mutate((s) => { Object.assign(s, b.screen); });
}

/* ------------------------------ helpers de layout ------------------------------ */

/** Breakpoint cuyas cajas se editan, o null si la vista es automática (sólo lectura) */
export function editableBp(screen: ScreenData | null, bp: Breakpoint): Breakpoint | null {
  if (!screen) return null;
  if (bp === 'desktop') return 'desktop';
  if (bp === 'tablet') return screen.tabletMode === 'custom' ? 'tablet' : null;
  return screen.mobileMode === 'custom' ? 'mobile' : null;
}

export function boxOf(c: ComponentData, bp: Breakpoint): Box {
  return (bp !== 'desktop' && c.layout[bp]) || c.layout.desktop;
}

export function stageSize(screen: ScreenData, bp: Breakpoint) {
  const eb = editableBp(screen, bp);
  if (bp === 'desktop' || !eb) {
    if (bp === 'tablet' && !eb) return { w: STAGE_WIDTH.desktop, h: screen.height };
    if (bp === 'mobile' && !eb) return { w: STAGE_WIDTH.mobile, h: 0 };
    return { w: STAGE_WIDTH.desktop, h: screen.height };
  }
  return { w: STAGE_WIDTH[eb], h: stageHeight(screen, eb) };
}

export function setBoxes(updates: Record<string, Partial<Box>>, bp: Breakpoint, history = false) {
  mutate((s) => {
    s.components.forEach((c) => {
      const u = updates[c.id];
      if (!u) return;
      const base = boxOf(c, bp);
      const nb = { ...base, ...u };
      if (bp === 'desktop') c.layout.desktop = nb;
      else c.layout[bp] = nb;
    });
  }, { history });
}

/* ------------------------------ componentes ------------------------------ */

export function select(ids: string[], additive = false) {
  if (additive) {
    const cur = new Set(get().selected);
    ids.forEach((id) => (cur.has(id) ? cur.delete(id) : cur.add(id)));
    set({ selected: [...cur], editingId: null });
  } else set({ selected: ids, editingId: ids.includes(get().editingId || '') ? get().editingId : null });
}

export function addComponent(c: ComponentData) {
  const bp = get().bp;
  mutate((s) => {
    if (bp !== 'desktop' && editableBp(s, bp)) c.layout[bp] = { ...c.layout.desktop };
    s.components.push(c);
  });
  set({ selected: [c.id] });
}

export function updateComponent(id: string, fn: (c: ComponentData) => void, history = true) {
  mutate((s) => {
    const c = s.components.find((x) => x.id === id);
    if (c) fn(c);
  }, { history });
}

export function deleteSelected() {
  const ids = new Set(get().selected);
  if (!ids.size) return;
  mutate((s) => { s.components = s.components.filter((c) => !ids.has(c.id) || c.locked); });
  set({ selected: [] });
}

function cloneComps(comps: ComponentData[], offset: number): ComponentData[] {
  const map = new Map<string, string>();
  comps.forEach((c) => map.set(c.id, uid(8)));
  return comps.map((c) => {
    const n: ComponentData = JSON.parse(JSON.stringify(c));
    n.id = map.get(c.id)!;
    n.locked = false;
    (['desktop', 'tablet', 'mobile'] as const).forEach((k) => { const b = n.layout[k]; if (b) { b.x += offset; b.y += offset; } });
    // reapuntar acciones internas del grupo copiado
    n.events?.forEach((e) => e.actions.forEach((a) => { if (a.target && map.has(a.target)) a.target = map.get(a.target); }));
    return n;
  });
}

export function duplicateSelected() {
  const s = get().screen;
  if (!s) return;
  const comps = s.components.filter((c) => get().selected.includes(c.id));
  if (!comps.length) return;
  const copies = cloneComps(comps, 20);
  mutate((sc) => { sc.components.push(...copies); });
  set({ selected: copies.map((c) => c.id) });
}

export function copySelected(cut = false) {
  const s = get().screen;
  if (!s) return;
  const comps = s.components.filter((c) => get().selected.includes(c.id));
  if (!comps.length) return;
  set({ clipboard: JSON.parse(JSON.stringify(comps)) });
  try { localStorage.setItem('ema-clipboard', JSON.stringify(comps)); } catch { /* */ }
  if (cut) deleteSelected();
  toast.info(cut ? `${comps.length} componente(s) cortado(s)` : `${comps.length} componente(s) copiado(s)`);
}

export function paste() {
  let clip = get().clipboard;
  if (!clip.length) {
    try { clip = JSON.parse(localStorage.getItem('ema-clipboard') || '[]'); } catch { clip = []; }
  }
  if (!clip.length || !get().screen) return;
  const sameScreen = clip.every((c) => get().screen!.components.some((x) => x.id === c.id));
  const copies = cloneComps(clip, sameScreen ? 20 : 0);
  mutate((s) => { s.components.push(...copies); });
  set({ selected: copies.map((c) => c.id) });
}

export function reorder(kind: 'front' | 'back' | 'forward' | 'backward') {
  const ids = new Set(get().selected);
  mutate((s) => {
    const sel = s.components.filter((c) => ids.has(c.id));
    const rest = s.components.filter((c) => !ids.has(c.id));
    if (kind === 'front') s.components = [...rest, ...sel];
    else if (kind === 'back') s.components = [...sel, ...rest];
    else {
      const arr = s.components.slice();
      const order = kind === 'forward' ? [...arr.keys()].reverse() : [...arr.keys()];
      for (const i of order) {
        if (!ids.has(arr[i].id)) continue;
        const j = kind === 'forward' ? i + 1 : i - 1;
        if (j < 0 || j >= arr.length || ids.has(arr[j].id)) continue;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      s.components = arr;
    }
  });
}

export function align(kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
  const { screen, bp, selected } = get();
  const eb = editableBp(screen, bp);
  if (!screen || !eb) return;
  const comps = screen.components.filter((c) => selected.includes(c.id) && !c.locked);
  if (!comps.length) return;
  const st = stageSize(screen, bp);
  const boxes = comps.map((c) => boxOf(c, eb));
  // un solo elemento: alinear contra el escenario; varios: contra la selección
  const ref = comps.length === 1 ? { x: 0, y: 0, w: st.w, h: st.h } : (() => {
    const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  })();
  const up: Record<string, Partial<Box>> = {};
  comps.forEach((c, i) => {
    const b = boxes[i];
    if (kind === 'left') up[c.id] = { x: ref.x };
    if (kind === 'hcenter') up[c.id] = { x: Math.round(ref.x + (ref.w - b.w) / 2) };
    if (kind === 'right') up[c.id] = { x: ref.x + ref.w - b.w };
    if (kind === 'top') up[c.id] = { y: ref.y };
    if (kind === 'vcenter') up[c.id] = { y: Math.round(ref.y + (ref.h - b.h) / 2) };
    if (kind === 'bottom') up[c.id] = { y: ref.y + ref.h - b.h };
  });
  setBoxes(up, eb, true);
}

export function distribute(axis: 'h' | 'v') {
  const { screen, bp, selected } = get();
  const eb = editableBp(screen, bp);
  if (!screen || !eb) return;
  const comps = screen.components.filter((c) => selected.includes(c.id) && !c.locked);
  if (comps.length < 3) { toast.info('Seleccioná al menos 3 componentes para distribuir'); return; }
  const items = comps.map((c) => ({ c, b: boxOf(c, eb) })).sort((a, b) => (axis === 'h' ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b, last = items[items.length - 1].b;
  const total = items.reduce((a, i) => a + (axis === 'h' ? i.b.w : i.b.h), 0);
  const span = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const gap = (span - total) / (items.length - 1);
  let pos = axis === 'h' ? first.x : first.y;
  const up: Record<string, Partial<Box>> = {};
  items.forEach((i) => {
    up[i.c.id] = axis === 'h' ? { x: Math.round(pos) } : { y: Math.round(pos) };
    pos += (axis === 'h' ? i.b.w : i.b.h) + gap;
  });
  setBoxes(up, eb, true);
}
