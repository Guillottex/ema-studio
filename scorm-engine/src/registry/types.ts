import type { Action, ComponentData, ComponentStyle, Theme, ScreenData, Question } from '../types';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'color'
  | 'select'
  | 'boolean'
  | 'media'
  | 'list'
  | 'icon'
  | 'screen'
  | 'component'
  | 'question'
  | 'questions'
  | 'table'
  | 'stringlist';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  accept?: 'image' | 'video' | 'audio' | 'pdf' | 'any';
  itemFields?: FieldDef[];
  itemLabel?: string;
  newItem?: () => any;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  placeholder?: string;
  showIf?: (props: Record<string, any>) => boolean;
}

export interface QuestionResult {
  correct: boolean;
  score: number;
  maxScore: number;
}

export interface QuizResult {
  scorePct: number;
  passed: boolean;
  raw: number;
  max: number;
}

/**
 * Contexto que reciben los renderizadores de componentes.
 * En modo "edit" (editor) los hooks de runtime son no-op; en modo "play" (player/SCORM) son reales.
 */
export interface RenderCtx {
  mode: 'edit' | 'play';
  theme: Theme;
  screen: ScreenData;
  asset(src?: string): string;
  markComplete(compId: string): void;
  isComplete(compId: string): boolean;
  runActions(actions: Action[], sourceId: string): void;
  navigate(target: string, targetId?: string): void;
  openDialog(opts: { title?: string; html?: string; node?: Node; size?: 'sm' | 'md' | 'lg' }): void;
  registerMedia(compId: string, el: HTMLMediaElement | HTMLIFrameElement): void;
  /** Estado persistente de un componente (respuestas, intentos...) */
  getCompState<T = any>(compId: string): T | undefined;
  setCompState(compId: string, state: any): void;
  reportQuestion(compId: string, q: Question, result: QuestionResult): void;
  reportQuiz(compId: string, isFinal: boolean, result: QuizResult): void;
  getFinalResult(): { score: number; passed: boolean; status: string } | null;
  screenTitle(id?: string): string;
}

export interface ComponentDef {
  type: string;
  label: string;
  category: 'text' | 'media' | 'visual' | 'interactive' | 'navigation' | 'assessment';
  /** nombre de ícono lucide (kebab-case) para el editor */
  icon: string;
  defaultSize: { w: number; h: number };
  defaultProps: () => Record<string, any>;
  defaultStyle?: () => ComponentStyle;
  fields: FieldDef[];
  /** Cuenta para "pantalla completada" (actividades) */
  trackable?: boolean | ((c: ComponentData) => boolean);
  /** Edición inline en el canvas */
  inline?: 'html' | 'text';
  /** Cómo se comporta el alto en modo flujo (móvil auto) */
  flow?: 'auto' | 'ratio' | 'fixed';
  /** Admite eventos de clic */
  clickable?: boolean;
  render(comp: ComponentData, ctx: RenderCtx): HTMLElement;
}

export interface PaletteItem {
  key: string;
  type: string;
  label: string;
  icon: string;
  category: ComponentDef['category'];
  props?: Record<string, any>;
  size?: { w: number; h: number };
}
