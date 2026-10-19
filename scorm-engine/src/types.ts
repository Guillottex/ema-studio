/**
 * EMA Studio — Esquema JSON del curso.
 * Este archivo es el contrato compartido entre frontend (editor), backend (API/exportación)
 * y el player SCORM. Todo el contenido se representa como JSON; nunca como HTML fijo.
 */

export const SCHEMA_VERSION = 1;

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

/** Ancho de diseño de cada breakpoint (px). El alto es libre (screen.height). */
export const STAGE_WIDTH: Record<Breakpoint, number> = { desktop: 1200, tablet: 768, mobile: 375 };
export const DEFAULT_STAGE_HEIGHT = 675;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ocultar el componente en este breakpoint */
  hidden?: boolean;
}

export interface ComponentLayout {
  desktop: Box;
  tablet?: Box;
  mobile?: Box;
}

export interface ComponentStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  color?: string;
  background?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number;
  margin?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  opacity?: number;
  rotation?: number;
}

export type AnimationType = 'none' | 'fade' | 'slide' | 'zoom' | 'bounce' | 'appear' | 'scroll';
export type AnimationTrigger = 'load' | 'scroll' | 'click' | 'action';

export interface AnimationConfig {
  type: AnimationType;
  duration: number; // ms
  delay: number; // ms
  direction: 'up' | 'down' | 'left' | 'right';
  trigger: AnimationTrigger;
}

export type ActionType =
  | 'show'
  | 'hide'
  | 'toggle'
  | 'openModal'
  | 'goto'
  | 'next'
  | 'prev'
  | 'home'
  | 'playMedia'
  | 'pauseMedia'
  | 'message'
  | 'animate'
  | 'complete'
  | 'setVar';

export interface Action {
  type: ActionType;
  /** id de componente destino (show/hide/toggle/openModal/playMedia/animate/complete) */
  target?: string;
  /** id de pantalla, lección o módulo (goto) */
  screenId?: string;
  title?: string;
  text?: string;
  animation?: AnimationType;
  varName?: string;
  value?: string;
}

export type EventTrigger = 'click' | 'hover' | 'complete';

export interface ComponentEvent {
  trigger: EventTrigger;
  actions: Action[];
}

export type ConditionType =
  | 'always'
  | 'screenComplete'
  | 'componentComplete'
  | 'variable'
  | 'quizPassed'
  | 'screenVisited';

export interface Condition {
  type: ConditionType;
  target?: string;
  value?: string;
}

export interface ComponentData {
  id: string;
  type: string;
  name?: string;
  props: Record<string, any>;
  style: ComponentStyle;
  layout: ComponentLayout;
  animation?: AnimationConfig;
  events?: ComponentEvent[];
  visibility?: { hidden?: boolean; condition?: Condition };
  locked?: boolean;
}

export interface ScreenBackground {
  color?: string;
  image?: string;
  size?: 'cover' | 'contain';
  overlay?: string; // rgba
}

export interface ScreenSettings {
  /** El botón Siguiente se habilita sólo cuando se completan las actividades de la pantalla */
  requireCompletion?: boolean;
  hideNav?: boolean;
  notes?: string;
}

export interface ScreenData {
  id: string;
  title: string;
  layout?: string;
  height: number;
  background?: ScreenBackground;
  settings: ScreenSettings;
  tabletMode?: 'auto' | 'custom';
  mobileMode?: 'auto' | 'custom';
  components: ComponentData[];
}

export interface LessonData {
  id: string;
  title: string;
  description?: string;
  screens: ScreenData[];
}

export interface ModuleData {
  id: string;
  title: string;
  description?: string;
  lessons: LessonData[];
}

export interface Theme {
  id?: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    success: string;
    error: string;
  };
  fonts: { heading: string; body: string };
  buttons: { radius: number; style: 'filled' | 'outline' | 'soft'; uppercase: boolean };
  headings: { weight: number; transform: 'none' | 'uppercase'; color?: string };
  background: { color?: string; image?: string };
  cards: { radius: number; shadow: 'none' | 'sm' | 'md' | 'lg'; border: boolean };
  menu: { style: 'light' | 'dark' | 'primary' };
  header: { style: 'light' | 'dark' | 'primary' };
  progress: { style: 'bar' | 'steps' | 'percent'; color?: string };
}

export interface NavigationSettings {
  mode: 'free' | 'linear';
  showMenu: boolean;
  showProgress: boolean;
  showScreenCounter: boolean;
  showHeader: boolean;
}

export interface CompletionSettings {
  /** visited: completa al ver X% de pantallas. quiz: aprueba con evaluación final. both: ambas. */
  criteria: 'visited' | 'quiz' | 'both';
  visitedPercent: number;
}

export interface CourseSettings {
  theme: Theme;
  navigation: NavigationSettings;
  completion: CompletionSettings;
  resume: { enabled: boolean; ask: boolean };
  logo?: string;
}

export interface CourseDoc {
  schemaVersion: number;
  id: string;
  title: string;
  description?: string;
  author?: string;
  category?: string;
  coverImage?: string;
  duration?: string;
  level?: string;
  language?: string;
  version?: string;
  objectives?: string[];
  requirements?: string[];
  status?: 'draft' | 'published';
  settings: CourseSettings;
  modules: ModuleData[];
  /** Sólo en exportación de proyecto (.json): recursos embebidos en base64 */
  assets?: Record<string, ProjectAsset>;
}

export interface ProjectAsset {
  name: string;
  mime: string;
  size: number;
  data: string; // base64
}

/* ---------------------------- Evaluaciones ---------------------------- */

export type QuestionType = 'single' | 'truefalse' | 'multiple' | 'order' | 'match' | 'fill' | 'short';

export interface QuestionOption {
  id: string;
  text: string;
  correct?: boolean;
  /** Para "relacionar conceptos": texto de la columna derecha */
  match?: string;
  feedback?: string;
}

export interface QuestionMedia {
  kind: 'image' | 'audio' | 'video';
  src: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  media?: QuestionMedia | null;
  /** single/multiple/truefalse: opciones. order: orden correcto. match: pares text→match */
  options: QuestionOption[];
  /** fill: texto con huecos marcados {{respuesta|alternativa}} */
  fillText?: string;
  /** short: respuestas aceptadas */
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  points: number;
  partialCredit?: boolean;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
  explanation?: string;
  /** 0 = ilimitados */
  attempts: number;
  shuffle?: boolean;
  /** segundos; 0 = sin límite */
  timeLimit?: number;
}

export interface QuizConfig {
  title: string;
  intro?: string;
  questions: Question[];
  /** 0 = todas */
  drawCount: number;
  randomize: boolean;
  passingScore: number; // %
  attempts: number; // 0 ilimitados
  timeLimit: number; // minutos, 0 sin límite
  showAnswers: boolean;
  showResult: boolean;
  passMessage: string;
  failMessage: string;
  /** Evaluación final: reporta puntaje/aprobación al LMS */
  isFinal: boolean;
  passScreen?: string;
  failScreen?: string;
}

/* ------------------------------ Utilidades ----------------------------- */

export interface FlatScreen {
  screen: ScreenData;
  lesson: LessonData;
  module: ModuleData;
  index: number;
  moduleIndex: number;
  lessonIndex: number;
  screenIndex: number;
}

export function flattenScreens(doc: Pick<CourseDoc, 'modules'>): FlatScreen[] {
  const out: FlatScreen[] = [];
  doc.modules.forEach((module, mi) =>
    module.lessons.forEach((lesson, li) =>
      lesson.screens.forEach((screen, si) =>
        out.push({ screen, lesson, module, index: out.length, moduleIndex: mi, lessonIndex: li, screenIndex: si })
      )
    )
  );
  return out;
}

export function uid(len = 10): string {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  const c: any = (globalThis as any).crypto;
  if (c && c.getRandomValues) {
    const arr = new Uint8Array(len);
    c.getRandomValues(arr);
    for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  } else {
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
