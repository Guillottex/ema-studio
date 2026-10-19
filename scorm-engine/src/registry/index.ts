import type { ComponentDef, PaletteItem } from './types';
import { textComponents } from './components/text';
import { mediaComponents } from './components/media';
import { visualComponents } from './components/visual';
import { interactiveComponents } from './components/interactive';
import { navigationComponents } from './components/navigation';
import { assessmentComponents } from './components/assessment';
import { uid, type ComponentData, type AnimationConfig } from '../types';
import { newQuestion } from '../assessment/factory';

/**
 * Registro de componentes. Para agregar un nuevo tipo de componente basta con
 * crear un ComponentDef y sumarlo aquí: el editor (paleta + panel de propiedades),
 * el player y la exportación SCORM lo toman automáticamente.
 */
export const COMPONENTS: ComponentDef[] = [
  ...textComponents,
  ...mediaComponents,
  ...visualComponents,
  ...interactiveComponents,
  ...navigationComponents,
  ...assessmentComponents,
];

const byType = new Map(COMPONENTS.map((d) => [d.type, d]));

export function getDef(type: string): ComponentDef | undefined {
  return byType.get(type);
}

export function registerComponent(def: ComponentDef) {
  if (!byType.has(def.type)) COMPONENTS.push(def);
  byType.set(def.type, def);
}

export const CATEGORY_LABELS: Record<ComponentDef['category'], string> = {
  text: 'Texto',
  media: 'Multimedia',
  visual: 'Elementos visuales',
  interactive: 'Interactivos',
  navigation: 'Navegación',
  assessment: 'Evaluación',
};

const presets: PaletteItem[] = [
  { key: 'numbered', type: 'list', label: 'Lista numerada', icon: 'list-ordered', category: 'text', props: { ordered: true } },
  { key: 'gif', type: 'image', label: 'GIF', icon: 'film', category: 'media', props: { fit: 'contain' } },
  { key: 'nav-prev', type: 'navButton', label: 'Anterior', icon: 'arrow-left', category: 'navigation', props: { text: 'Anterior', target: 'prev', variant: 'outline' } },
  { key: 'nav-home', type: 'navButton', label: 'Inicio', icon: 'house', category: 'navigation', props: { text: 'Inicio', target: 'home', variant: 'ghost' } },
  { key: 'nav-module', type: 'navButton', label: 'Ir a módulo', icon: 'folder', category: 'navigation', props: { text: 'Ir al módulo', target: 'screen' } },
  { key: 'nav-lesson', type: 'navButton', label: 'Ir a lección', icon: 'book-open', category: 'navigation', props: { text: 'Ir a la lección', target: 'screen' } },
  { key: 'nav-screen', type: 'navButton', label: 'Ir a pantalla', icon: 'file', category: 'navigation', props: { text: 'Ir a la pantalla', target: 'screen' } },
  { key: 'nav-custom', type: 'button', label: 'Botón personalizado', icon: 'mouse-pointer-click', category: 'navigation', props: { text: 'Acción personalizada', variant: 'secondary' } },
  { key: 'q-tf', type: 'question', label: 'Verdadero/Falso', icon: 'toggle-left', category: 'assessment', props: { __questionType: 'truefalse' } },
  { key: 'q-multi', type: 'question', label: 'Selección múltiple', icon: 'list-checks', category: 'assessment', props: { __questionType: 'multiple' } },
  { key: 'q-order', type: 'question', label: 'Ordenar', icon: 'arrow-down-up', category: 'assessment', props: { __questionType: 'order' } },
  { key: 'q-match', type: 'question', label: 'Relacionar', icon: 'link', category: 'assessment', props: { __questionType: 'match' } },
  { key: 'q-fill', type: 'question', label: 'Completar espacios', icon: 'text-cursor-input', category: 'assessment', props: { __questionType: 'fill' } },
  { key: 'q-short', type: 'question', label: 'Respuesta corta', icon: 'pencil-line', category: 'assessment', props: { __questionType: 'short' } },
];

/** Ítems de la paleta del editor (componentes + variantes preconfiguradas) */
export function paletteItems(): PaletteItem[] {
  const base: PaletteItem[] = COMPONENTS.map((d) => ({ key: d.type, type: d.type, label: d.label, icon: d.icon, category: d.category }));
  const out: PaletteItem[] = [];
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    out.push(...base.filter((b) => b.category === cat));
    out.push(...presets.filter((p) => p.category === cat));
  }
  return out;
}

export const DEFAULT_ANIMATION: AnimationConfig = { type: 'none', duration: 600, delay: 0, direction: 'up', trigger: 'load' };

export function createComponent(type: string, opts: { x?: number; y?: number; props?: Record<string, any>; w?: number; h?: number } = {}): ComponentData {
  const def = getDef(type);
  if (!def) throw new Error(`Tipo de componente desconocido: ${type}`);
  const props = { ...def.defaultProps(), ...(opts.props || {}) };
  if (props.__questionType) {
    props.question = newQuestion(props.__questionType);
    delete props.__questionType;
  }
  const w = opts.w ?? def.defaultSize.w;
  const h = opts.h ?? def.defaultSize.h;
  return {
    id: uid(8),
    type,
    props,
    style: def.defaultStyle ? def.defaultStyle() : {},
    layout: { desktop: { x: Math.round(opts.x ?? 60), y: Math.round(opts.y ?? 60), w, h } },
    animation: { ...DEFAULT_ANIMATION },
    events: [],
    visibility: { hidden: false },
  };
}

export type { ComponentDef, PaletteItem, FieldDef, RenderCtx } from './types';

/** ¿El componente cuenta como actividad obligatoria de la pantalla? */
export function isTrackable(c: ComponentData): boolean {
  const def = getDef(c.type);
  if (!def || !def.trackable) return false;
  return typeof def.trackable === 'function' ? def.trackable(c) : true;
}
