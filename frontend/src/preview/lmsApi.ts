/**
 * Simulador del RTE de SCORM 1.2 (API Adapter) para la previsualización.
 *
 * Implementa el objeto `API` que un LMS expone a los SCO según la especificación
 * "SCORM Run-Time Environment 1.2" (ADL): estados de la sesión, modelo de datos CMI con sus
 * tipos, permisos de lectura/escritura y códigos de error. Los datos se guardan en
 * localStorage (`ema-lms-sim:<cursoId>`) al hacer LMSCommit/LMSFinish, así al reabrir el curso
 * se reanuda igual que en un LMS real.
 */

export type SessionState = 'not-initialized' | 'running' | 'finished';

export interface LmsLogEntry {
  id: number;
  time: number;
  session: number;
  fn: string;
  args: string[];
  result: string;
  errorCode: string;
}

export interface Learner {
  id: string;
  name: string;
}

export interface SimulatorOptions {
  courseId: string;
  learner?: Learner;
  /** adlcp:masteryscore del manifiesto (o null si el curso no tiene) */
  masteryScore?: number | null;
  /** Clave de almacenamiento (por defecto ema-lms-sim:<courseId>) */
  storageKey?: string;
}

export interface Interaction {
  id: string;
  type: string;
  student_response: string;
  result: string;
  weighting: string;
  time: string;
  latency: string;
  objectives: string[];
  correct_responses: string[];
}

export interface CmiData {
  core: {
    lesson_location: string;
    lesson_status: string;
    score: { raw: string; min: string; max: string };
    total_time: string;
    exit: string;
    session_time: string;
    entry: string;
  };
  suspend_data: string;
  launch_data: string;
  comments: string;
  interactions: Interaction[];
}

/** Lo que se persiste entre sesiones (como lo guardaría el LMS) */
interface Stored {
  v: 1;
  cmi: CmiData;
  /** Valor de cmi.core.exit con el que terminó la última sesión */
  lastExit: string | null;
  sessions: number;
  updatedAt: number;
}

export interface SimulatorSnapshot {
  state: SessionState;
  session: number;
  sessionsStored: number;
  /** cmi.core.exit con el que cerró la última sesión guardada */
  lastExit: string | null;
  initializedAt: number | null;
  finishedAt: number | null;
  learner: Learner;
  masteryScore: number | null;
  lastError: string;
  dirty: boolean;
  savedAt: number | null;
  cmi: CmiData;
}

export const ERROR_STRINGS: Record<string, string> = {
  '0': 'No error',
  '101': 'General exception',
  '201': 'Invalid argument error',
  '202': 'Element cannot have children',
  '203': 'Element not an array - cannot have count',
  '301': 'Not initialized',
  '401': 'Not implemented error',
  '402': 'Invalid set value, element is a keyword',
  '403': 'Element is read only',
  '404': 'Element is write only',
  '405': 'Incorrect Data Type',
};

const CHILDREN: Record<string, string> = {
  'cmi.core': 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
  'cmi.core.score': 'raw,min,max',
  'cmi.student_data': 'mastery_score,max_time_allowed,time_limit_action',
  'cmi.interactions': 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency',
  'cmi.objectives': 'id,score,status',
  'cmi.student_preference': 'audio,language,speed,text',
};

/** Elementos opcionales del modelo de datos que este simulador no implementa (→ 401) */
const NOT_IMPLEMENTED = /^cmi\.(objectives|student_preference)(\.|$)|^cmi\.student_data\.(max_time_allowed|time_limit_action)$/;

const STATUS_VOCAB = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
/** En SCORM 1.2 el SCO no puede volver a escribir "not attempted" (solo lo asigna el LMS) */
const STATUS_SETTABLE = ['passed', 'completed', 'failed', 'incomplete', 'browsed'];
const EXIT_VOCAB = ['time-out', 'suspend', 'logout', ''];
const INTERACTION_TYPES = ['true-false', 'choice', 'fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric'];
const RESULT_VOCAB = ['correct', 'wrong', 'unanticipated', 'neutral'];

const RE_DECIMAL = /^-?\d+(\.\d+)?$/;
const RE_TIMESPAN = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/;
const RE_TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,2})?$/;
const RE_IDENTIFIER = /^[^\s]{1,255}$/;

const ZERO_TIME = '0000:00:00.00';

export function emptyCmi(): CmiData {
  return {
    core: {
      lesson_location: '',
      lesson_status: 'not attempted',
      score: { raw: '', min: '', max: '' },
      total_time: ZERO_TIME,
      exit: '',
      session_time: '',
      entry: 'ab-initio',
    },
    suspend_data: '',
    launch_data: '',
    comments: '',
    interactions: [],
  };
}

function timespanToCs(t: string): number {
  const m = /^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/.exec(t || '');
  if (!m) return 0;
  const cs = m[4] ? Number(m[4].padEnd(2, '0')) : 0;
  return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 100 + cs;
}

function csToTimespan(total: number): string {
  const cs = total % 100;
  const s = Math.floor(total / 100);
  const hh = Math.min(9999, Math.floor(s / 3600));
  const mm = Math.floor(s / 60) % 60;
  const ss = s % 60;
  return `${String(hh).padStart(4, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function addTimespans(a: string, b: string): string {
  return csToTimespan(timespanToCs(a) + timespanToCs(b));
}

/** Milisegundos → "HH:MM:SS" para mostrar */
export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

class CmiError extends Error {
  constructor(public code: string) {
    super(ERROR_STRINGS[code] || 'Error');
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export class Scorm12Simulator {
  readonly courseId: string;
  readonly storageKey: string;
  learner: Learner;
  masteryScore: number | null;

  private state: SessionState = 'not-initialized';
  private cmi: CmiData = emptyCmi();
  private stored: Stored | null = null;
  private lastError = '0';
  private lastDiagnostic = '';
  private session = 0;
  private initializedAt: number | null = null;
  private finishedAt: number | null = null;
  private dirty = false;
  private savedAt: number | null = null;
  private logEntries: LmsLogEntry[] = [];
  private logSeq = 0;
  private listeners = new Set<() => void>();
  private notifyQueued = false;
  private snap: SimulatorSnapshot | null = null;

  /** Máximo de entradas que se guardan en el registro de llamadas */
  maxLog = 1500;

  constructor(opts: SimulatorOptions) {
    this.courseId = opts.courseId;
    this.storageKey = opts.storageKey || `ema-lms-sim:${opts.courseId}`;
    this.learner = opts.learner || { id: 'PRUEBA01', name: 'Alumno, Prueba' };
    this.masteryScore = opts.masteryScore ?? null;
    this.loadSession();
    // Los métodos se usan sueltos desde el SCO (API.LMSGetValue(...)): fijamos `this`.
    for (const k of ['LMSInitialize', 'LMSFinish', 'LMSGetValue', 'LMSSetValue', 'LMSCommit', 'LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic'] as const) {
      (this as any)[k] = (this as any)[k].bind(this);
    }
  }

  /* ----------------------------- Persistencia ----------------------------- */

  private readStorage(): Stored | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || p.v !== 1 || !p.cmi) return null;
      const base = emptyCmi();
      p.cmi = { ...base, ...p.cmi, core: { ...base.core, ...p.cmi.core, score: { ...base.core.score, ...(p.cmi.core?.score || {}) } }, interactions: Array.isArray(p.cmi.interactions) ? p.cmi.interactions : [] };
      return p as Stored;
    } catch {
      return null;
    }
  }

  private writeStorage(extra?: Partial<Stored>) {
    const data: Stored = {
      v: 1,
      cmi: clone(this.cmi),
      lastExit: this.stored?.lastExit ?? null,
      sessions: this.stored?.sessions ?? 0,
      updatedAt: Date.now(),
      ...extra,
    };
    // Los elementos de sesión no se conservan como datos del alumno
    data.cmi.core.session_time = '';
    data.cmi.core.exit = '';
    this.stored = data;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      /* sin storage: la sesión sigue funcionando en memoria */
    }
    this.dirty = false;
    this.savedAt = data.updatedAt;
  }

  /** Prepara una nueva sesión (nuevo "lanzamiento" del SCO) leyendo lo que guardó el LMS */
  private loadSession() {
    this.stored = this.readStorage();
    const cmi = this.stored ? clone(this.stored.cmi) : emptyCmi();
    cmi.core.exit = '';
    cmi.core.session_time = '';
    if (!this.stored || this.stored.sessions === 0) cmi.core.entry = 'ab-initio';
    else cmi.core.entry = this.stored.lastExit === 'suspend' ? 'resume' : '';
    this.cmi = cmi;
    this.state = 'not-initialized';
    this.lastError = '0';
    this.lastDiagnostic = '';
    this.initializedAt = null;
    this.finishedAt = null;
    this.dirty = false;
    this.savedAt = this.stored?.updatedAt ?? null;
    this.session++;
  }

  /**
   * Simula que el LMS vuelve a lanzar el SCO: descarta lo no confirmado de la sesión anterior
   * y arranca una nueva en estado "no inicializado".
   */
  relaunch() {
    this.loadSession();
    this.log('— Nueva sesión —', [], '', '0');
  }

  /** Borra todos los datos guardados (nuevo intento) y prepara una sesión limpia */
  reset() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
    this.loadSession();
    this.log('— Intento reiniciado —', [], '', '0');
  }

  setConfig(opts: { learner?: Learner; masteryScore?: number | null }) {
    if (opts.learner) this.learner = opts.learner;
    if (opts.masteryScore !== undefined) this.masteryScore = opts.masteryScore;
    this.emit();
  }

  /* ----------------------------- Suscripción ----------------------------- */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.snap = null;
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    // Agrupa ráfagas de llamadas (el SCO hace muchas seguidas) en una sola notificación
    queueMicrotask(() => {
      this.notifyQueued = false;
      this.listeners.forEach((l) => {
        try {
          l();
        } catch {
          /* ignore */
        }
      });
    });
  }

  /** Copia inmutable del estado actual (estable entre cambios, apta para useSyncExternalStore) */
  snapshot(): SimulatorSnapshot {
    if (!this.snap) {
      this.snap = {
        state: this.state,
        session: this.session,
        sessionsStored: this.stored?.sessions ?? 0,
        lastExit: this.stored?.lastExit ?? null,
        initializedAt: this.initializedAt,
        finishedAt: this.finishedAt,
        learner: { ...this.learner },
        masteryScore: this.masteryScore,
        lastError: this.lastError,
        dirty: this.dirty,
        savedAt: this.savedAt,
        cmi: clone(this.cmi),
      };
    }
    return this.snap;
  }

  getLog(): LmsLogEntry[] {
    return this.logEntries;
  }

  clearLog() {
    this.logEntries = [];
    this.emit();
  }

  /** Datos CMI planos (elemento → valor) tal como los vería el LMS */
  exportCmi(): Record<string, string> {
    const c = this.cmi;
    const out: Record<string, string> = {
      'cmi.core.student_id': this.learner.id,
      'cmi.core.student_name': this.learner.name,
      'cmi.core.lesson_location': c.core.lesson_location,
      'cmi.core.credit': 'credit',
      'cmi.core.lesson_status': c.core.lesson_status,
      'cmi.core.entry': c.core.entry,
      'cmi.core.score.raw': c.core.score.raw,
      'cmi.core.score.min': c.core.score.min,
      'cmi.core.score.max': c.core.score.max,
      'cmi.core.total_time': c.core.total_time,
      'cmi.core.lesson_mode': 'normal',
      'cmi.core.exit': c.core.exit,
      'cmi.core.session_time': c.core.session_time,
      'cmi.suspend_data': c.suspend_data,
      'cmi.launch_data': c.launch_data,
      'cmi.comments': c.comments,
      'cmi.student_data.mastery_score': this.masteryScore == null ? '' : String(this.masteryScore),
      'cmi.interactions._count': String(c.interactions.length),
    };
    c.interactions.forEach((it, n) => {
      const p = `cmi.interactions.${n}.`;
      out[p + 'id'] = it.id;
      out[p + 'type'] = it.type;
      out[p + 'student_response'] = it.student_response;
      out[p + 'result'] = it.result;
      out[p + 'weighting'] = it.weighting;
      out[p + 'time'] = it.time;
      out[p + 'latency'] = it.latency;
      it.objectives.forEach((o, m) => (out[`${p}objectives.${m}.id`] = o));
      it.correct_responses.forEach((r, m) => (out[`${p}correct_responses.${m}.pattern`] = r));
    });
    return out;
  }

  /* ------------------------------ Registro ------------------------------ */

  private log(fn: string, args: string[], result: string, errorCode: string) {
    this.logEntries.push({ id: ++this.logSeq, time: Date.now(), session: this.session, fn, args, result, errorCode });
    if (this.logEntries.length > this.maxLog) this.logEntries.splice(0, this.logEntries.length - this.maxLog);
    this.emit();
  }

  private ok(fn: string, args: string[], result: string): string {
    this.lastError = '0';
    this.lastDiagnostic = '';
    this.log(fn, args, result, '0');
    return result;
  }

  private fail(fn: string, args: string[], code: string, result: string, diagnostic = ''): string {
    this.lastError = code;
    this.lastDiagnostic = diagnostic || ERROR_STRINGS[code] || '';
    this.log(fn, args, result, code);
    return result;
  }

  /* ------------------------------ API RTE ------------------------------ */

  LMSInitialize(param: string = ''): string {
    const args = [String(param ?? '')];
    if (param !== '' && param != null) return this.fail('LMSInitialize', args, '201', 'false', 'El parámetro debe ser una cadena vacía');
    if (this.state === 'running') return this.fail('LMSInitialize', args, '101', 'false', 'La sesión ya estaba inicializada');
    if (this.state === 'finished') return this.fail('LMSInitialize', args, '101', 'false', 'La sesión ya finalizó (LMSFinish)');
    this.state = 'running';
    this.initializedAt = Date.now();
    return this.ok('LMSInitialize', args, 'true');
  }

  LMSFinish(param: string = ''): string {
    const args = [String(param ?? '')];
    if (param !== '' && param != null) return this.fail('LMSFinish', args, '201', 'false', 'El parámetro debe ser una cadena vacía');
    if (this.state === 'not-initialized') return this.fail('LMSFinish', args, '301', 'false');
    if (this.state === 'finished') return this.fail('LMSFinish', args, '101', 'false', 'La sesión ya finalizó');
    const c = this.cmi.core;
    // Acumula el tiempo de la sesión
    if (c.session_time) c.total_time = addTimespans(c.total_time, c.session_time);
    // Con mastery score (adlcp:masteryscore) y puntaje informado, el LMS puede resolver
    // "completed" como aprobado/desaprobado (RTE 1.2, cmi.student_data.mastery_score).
    if (this.masteryScore != null && c.score.raw !== '' && c.lesson_status === 'completed') {
      c.lesson_status = Number(c.score.raw) >= this.masteryScore ? 'passed' : 'failed';
    }
    const exit = c.exit;
    this.writeStorage({ lastExit: exit, sessions: (this.stored?.sessions ?? 0) + 1 });
    this.state = 'finished';
    this.finishedAt = Date.now();
    return this.ok('LMSFinish', args, 'true');
  }

  LMSCommit(param: string = ''): string {
    const args = [String(param ?? '')];
    if (param !== '' && param != null) return this.fail('LMSCommit', args, '201', 'false', 'El parámetro debe ser una cadena vacía');
    if (this.state === 'not-initialized') return this.fail('LMSCommit', args, '301', 'false');
    if (this.state === 'finished') return this.fail('LMSCommit', args, '101', 'false', 'La sesión ya finalizó');
    this.writeStorage();
    return this.ok('LMSCommit', args, 'true');
  }

  LMSGetLastError(): string {
    // No modifica el último error ni se registra en el log para no ensuciarlo
    return this.lastError;
  }

  LMSGetErrorString(code: string): string {
    return ERROR_STRINGS[String(code)] ?? '';
  }

  LMSGetDiagnostic(code: string): string {
    const c = code === '' || code == null ? this.lastError : String(code);
    if (c === this.lastError && this.lastDiagnostic) return this.lastDiagnostic;
    return ERROR_STRINGS[c] ?? '';
  }

  LMSGetValue(element: string): string {
    const el = String(element ?? '');
    const args = [el];
    if (this.state === 'not-initialized') return this.fail('LMSGetValue', args, '301', '');
    if (this.state === 'finished') return this.fail('LMSGetValue', args, '101', '', 'La sesión ya finalizó');
    try {
      return this.ok('LMSGetValue', args, this.get(el));
    } catch (e) {
      if (e instanceof CmiError) return this.fail('LMSGetValue', args, e.code, '');
      return this.fail('LMSGetValue', args, '101', '', String(e));
    }
  }

  LMSSetValue(element: string, value: string): string {
    const el = String(element ?? '');
    const v = value == null ? '' : String(value);
    const args = [el, v];
    if (this.state === 'not-initialized') return this.fail('LMSSetValue', args, '301', 'false');
    if (this.state === 'finished') return this.fail('LMSSetValue', args, '101', 'false', 'La sesión ya finalizó');
    try {
      this.set(el, v);
      this.dirty = true;
      return this.ok('LMSSetValue', args, 'true');
    } catch (e) {
      if (e instanceof CmiError) return this.fail('LMSSetValue', args, e.code, 'false');
      return this.fail('LMSSetValue', args, '101', 'false', String(e));
    }
  }

  /* --------------------------- Modelo de datos --------------------------- */

  /** Valida un elemento de tipo keyword (_children/_count) y devuelve su valor */
  private keyword(el: string): string {
    const m = /^(.*)\.(_children|_count|_version)$/.exec(el);
    if (!m) throw new CmiError('201');
    const [, base, kw] = m;
    if (el === 'cmi._version') return '3.4';
    const genericBase = base.replace(/\.\d+\./g, '.').replace(/\.\d+$/, '');
    if (kw === '_children') {
      if (NOT_IMPLEMENTED.test(base)) throw new CmiError('401');
      if (genericBase in CHILDREN && !/^cmi\.interactions\.\d+$/.test(base)) return CHILDREN[genericBase];
      if (this.isKnown(base)) throw new CmiError('202');
      throw new CmiError('201');
    }
    if (kw === '_count') {
      if (base === 'cmi.interactions') return String(this.cmi.interactions.length);
      const sub = /^cmi\.interactions\.(\d+)\.(objectives|correct_responses)$/.exec(base);
      if (sub) {
        const it = this.cmi.interactions[+sub[1]];
        if (!it) throw new CmiError('201');
        return String(it[sub[2] as 'objectives' | 'correct_responses'].length);
      }
      if (/^cmi\.(objectives)$/.test(base)) throw new CmiError('401');
      if (this.isKnown(base)) throw new CmiError('203');
      throw new CmiError('201');
    }
    throw new CmiError('201');
  }

  private isKnown(el: string): boolean {
    return (
      /^cmi\.core(\.(student_id|student_name|lesson_location|credit|lesson_status|entry|total_time|lesson_mode|exit|session_time|score(\.(raw|min|max))?))?$/.test(el) ||
      /^cmi\.(suspend_data|launch_data|comments|comments_from_lms|student_data(\.mastery_score)?)$/.test(el) ||
      /^cmi\.interactions(\.\d+(\.(id|type|student_response|result|weighting|time|latency|objectives(\.\d+(\.id)?)?|correct_responses(\.\d+(\.pattern)?)?))?)?$/.test(el) ||
      el === 'cmi'
    );
  }

  private get(el: string): string {
    if (/\._(children|count|version)$/.test(el)) return this.keyword(el);
    if (NOT_IMPLEMENTED.test(el)) throw new CmiError('401');
    const c = this.cmi.core;
    switch (el) {
      case 'cmi.core.student_id': return this.learner.id;
      case 'cmi.core.student_name': return this.learner.name;
      case 'cmi.core.lesson_location': return c.lesson_location;
      case 'cmi.core.credit': return 'credit';
      case 'cmi.core.lesson_status': return c.lesson_status;
      case 'cmi.core.entry': return c.entry;
      case 'cmi.core.score.raw': return c.score.raw;
      case 'cmi.core.score.min': return c.score.min;
      case 'cmi.core.score.max': return c.score.max;
      case 'cmi.core.total_time': return c.total_time;
      case 'cmi.core.lesson_mode': return 'normal';
      case 'cmi.core.exit':
      case 'cmi.core.session_time':
        throw new CmiError('404');
      case 'cmi.suspend_data': return this.cmi.suspend_data;
      case 'cmi.launch_data': return this.cmi.launch_data;
      case 'cmi.comments': return this.cmi.comments;
      case 'cmi.comments_from_lms': return '';
      case 'cmi.student_data.mastery_score': return this.masteryScore == null ? '' : String(this.masteryScore);
    }
    // Interacciones: todos sus campos son de solo escritura en SCORM 1.2
    if (/^cmi\.interactions\.\d+\./.test(el)) {
      if (this.isKnown(el)) throw new CmiError('404');
      throw new CmiError('201');
    }
    // Elementos contenedores (cmi.core, cmi.core.score, …) no tienen valor propio
    throw new CmiError('201');
  }

  private set(el: string, v: string) {
    if (/\._(children|count|version)$/.test(el)) {
      // Validar que exista el keyword antes de informar 402
      this.keyword(el);
      throw new CmiError('402');
    }
    if (NOT_IMPLEMENTED.test(el)) throw new CmiError('401');
    const c = this.cmi.core;
    switch (el) {
      case 'cmi.core.student_id':
      case 'cmi.core.student_name':
      case 'cmi.core.credit':
      case 'cmi.core.entry':
      case 'cmi.core.total_time':
      case 'cmi.core.lesson_mode':
      case 'cmi.launch_data':
      case 'cmi.comments_from_lms':
      case 'cmi.student_data.mastery_score':
        throw new CmiError('403');
      case 'cmi.core.lesson_location':
        if (v.length > 255) throw new CmiError('405');
        c.lesson_location = v;
        return;
      case 'cmi.core.lesson_status':
        if (!STATUS_SETTABLE.includes(v)) throw new CmiError('405');
        c.lesson_status = v;
        return;
      case 'cmi.core.score.raw':
      case 'cmi.core.score.min':
      case 'cmi.core.score.max': {
        if (v !== '' && (!RE_DECIMAL.test(v) || Number(v) < 0 || Number(v) > 100)) throw new CmiError('405');
        c.score[el.slice(15) as 'raw' | 'min' | 'max'] = v;
        return;
      }
      case 'cmi.core.exit':
        if (!EXIT_VOCAB.includes(v)) throw new CmiError('405');
        c.exit = v;
        return;
      case 'cmi.core.session_time':
        if (!RE_TIMESPAN.test(v)) throw new CmiError('405');
        c.session_time = v;
        return;
      case 'cmi.suspend_data':
        if (v.length > 4096) throw new CmiError('405');
        this.cmi.suspend_data = v;
        return;
      case 'cmi.comments':
        if (v.length > 4096) throw new CmiError('405');
        this.cmi.comments = v;
        return;
    }
    const m = /^cmi\.interactions\.(\d+)\.(.+)$/.exec(el);
    if (m) return this.setInteraction(+m[1], m[2], v, el);
    if (this.isKnown(el)) throw new CmiError(el === 'cmi.core' || el === 'cmi.core.score' || el === 'cmi.interactions' || el === 'cmi' || el === 'cmi.student_data' ? '201' : '403');
    throw new CmiError('201');
  }

  private setInteraction(n: number, field: string, v: string, el: string) {
    if (!this.isKnown(el)) throw new CmiError('201');
    const list = this.cmi.interactions;
    // Solo se puede escribir en un índice existente o en el siguiente (agregar)
    if (n > list.length) throw new CmiError('201');
    const validate = (): ((it: Interaction) => void) => {
      switch (field) {
        case 'id':
          if (!RE_IDENTIFIER.test(v)) throw new CmiError('405');
          return (it) => (it.id = v);
        case 'type':
          if (!INTERACTION_TYPES.includes(v)) throw new CmiError('405');
          return (it) => (it.type = v);
        case 'student_response':
          if (v.length > 255) throw new CmiError('405');
          return (it) => (it.student_response = v);
        case 'result':
          if (!RESULT_VOCAB.includes(v) && !RE_DECIMAL.test(v)) throw new CmiError('405');
          return (it) => (it.result = v);
        case 'weighting':
          if (!RE_DECIMAL.test(v)) throw new CmiError('405');
          return (it) => (it.weighting = v);
        case 'time':
          if (!RE_TIME.test(v)) throw new CmiError('405');
          return (it) => (it.time = v);
        case 'latency':
          if (!RE_TIMESPAN.test(v)) throw new CmiError('405');
          return (it) => (it.latency = v);
      }
      const sub = /^(objectives|correct_responses)\.(\d+)\.(id|pattern)$/.exec(field);
      if (sub) {
        const [, arr, idx, prop] = sub;
        if ((arr === 'objectives' && prop !== 'id') || (arr === 'correct_responses' && prop !== 'pattern')) throw new CmiError('201');
        if (arr === 'objectives' && !RE_IDENTIFIER.test(v)) throw new CmiError('405');
        if (v.length > 255) throw new CmiError('405');
        const m = +idx;
        return (it) => {
          const a = it[arr as 'objectives' | 'correct_responses'];
          if (m > a.length) throw new CmiError('201');
          a[m] = v;
        };
      }
      throw new CmiError('201');
    };
    const apply = validate();
    const it = list[n] || { id: '', type: '', student_response: '', result: '', weighting: '', time: '', latency: '', objectives: [], correct_responses: [] };
    apply(it);
    if (n === list.length) list.push(it);
  }
}

/** Avance (%) a partir de cmi.suspend_data del player EMA (clave "vi": rangos "0-4,7") */
export function visitedFromSuspend(suspend: string): { visited: number[]; parsed: any | null } {
  if (!suspend) return { visited: [], parsed: null };
  try {
    const p = JSON.parse(suspend);
    const vi: string = typeof p?.vi === 'string' ? p.vi : '';
    const visited = vi
      ? vi.split(',').flatMap((part) => {
          const [a, b] = part.split('-').map(Number);
          if (isNaN(a)) return [];
          if (b === undefined || isNaN(b)) return [a];
          return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
        })
      : [];
    return { visited: [...new Set(visited)], parsed: p };
  } catch {
    return { visited: [], parsed: null };
  }
}
