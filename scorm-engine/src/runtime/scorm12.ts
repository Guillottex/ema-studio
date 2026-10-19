/**
 * Adaptador SCORM 1.2 (RTE). Busca el objeto API provisto por el LMS en la cadena de ventanas
 * (parent/opener) según la especificación ADL. Si no lo encuentra, funciona en modo local
 * (localStorage) para que el curso también pueda probarse abriendo index.html directamente.
 */

export interface Scorm12API {
  LMSInitialize(arg: ''): string;
  LMSFinish(arg: ''): string;
  LMSGetValue(el: string): string;
  LMSSetValue(el: string, v: string): string;
  LMSCommit(arg: ''): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
}

function scan(win: Window): Scorm12API | null {
  let tries = 0;
  let w: any = win;
  while (w && !w.API && w.parent && w.parent !== w && tries < 10) {
    tries++;
    try {
      w = w.parent;
    } catch {
      return null;
    }
  }
  try {
    return w && w.API ? (w.API as Scorm12API) : null;
  } catch {
    return null;
  }
}

export function findAPI(): Scorm12API | null {
  try {
    let api = scan(window);
    if (!api && window.opener) api = scan(window.opener);
    if (!api && window.top && window.top.opener) api = scan(window.top.opener);
    return api;
  } catch {
    return null;
  }
}

/** API local de respaldo (sin LMS). Persiste en localStorage. */
export class LocalAPI implements Scorm12API {
  private data: Record<string, string>;
  private key: string;
  private err = '0';
  constructor(courseId: string) {
    this.key = 'ema-scorm-local:' + courseId;
    let stored: Record<string, string> = {};
    try {
      stored = JSON.parse(localStorage.getItem(this.key) || '{}');
    } catch {
      /* sin storage */
    }
    this.data = {
      'cmi.core.student_id': 'local',
      'cmi.core.student_name': 'Alumno, Local',
      'cmi.core.lesson_status': 'not attempted',
      'cmi.core.entry': stored['cmi.suspend_data'] ? 'resume' : 'ab-initio',
      'cmi.core.lesson_location': '',
      'cmi.core.score.raw': '',
      'cmi.core.total_time': '0000:00:00.00',
      'cmi.suspend_data': '',
      'cmi.launch_data': '',
      ...stored,
    };
  }
  private persist() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }
  LMSInitialize() { return 'true'; }
  LMSFinish() { this.persist(); return 'true'; }
  LMSGetValue(el: string) { this.err = '0'; return this.data[el] ?? ''; }
  LMSSetValue(el: string, v: string) { this.err = '0'; this.data[el] = String(v); return 'true'; }
  LMSCommit() { this.persist(); return 'true'; }
  LMSGetLastError() { return this.err; }
  LMSGetErrorString(code: string) { return code === '0' ? 'No error' : 'Error'; }
  LMSGetDiagnostic(code: string) { return this.LMSGetErrorString(code); }
}

/** Convierte milisegundos al formato CMITimespan HHHH:MM:SS.SS */
export function toCMITimespan(ms: number): string {
  const totalCs = Math.max(0, Math.round(ms / 10));
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const hh = Math.min(9999, Math.floor(totalS / 3600));
  return `${String(hh).padStart(4, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function parseCMITimespan(t: string): number {
  const m = /^(\d{2,4}):(\d{2}):(\d{2})(\.\d{1,2})?$/.exec(t || '');
  if (!m) return 0;
  return ((+m[1] * 60 + +m[2]) * 60 + +m[3] + (m[4] ? parseFloat(m[4]) : 0)) * 1000;
}

export class ScormConnection {
  api: Scorm12API;
  readonly lms: boolean;
  private initialized = false;
  private finished = false;
  log: (msg: string) => void;

  constructor(courseId: string, log: (msg: string) => void = () => undefined) {
    const found = findAPI();
    this.lms = !!found;
    this.api = found || new LocalAPI(courseId);
    this.log = log;
  }

  init(): boolean {
    if (this.initialized) return true;
    const ok = String(this.api.LMSInitialize('')) === 'true';
    this.initialized = ok;
    if (!ok) this.log('LMSInitialize falló: ' + this.lastError());
    return ok;
  }

  get(el: string): string {
    if (!this.initialized || this.finished) return '';
    const v = this.api.LMSGetValue(el);
    return v == null ? '' : String(v);
  }

  set(el: string, v: string | number): boolean {
    if (!this.initialized || this.finished) return false;
    const ok = String(this.api.LMSSetValue(el, String(v))) === 'true';
    if (!ok) this.log(`LMSSetValue(${el}) falló: ${this.lastError()}`);
    return ok;
  }

  commit(): boolean {
    if (!this.initialized || this.finished) return false;
    return String(this.api.LMSCommit('')) === 'true';
  }

  finish(): boolean {
    if (!this.initialized || this.finished) return false;
    this.finished = true;
    return String(this.api.LMSFinish('')) === 'true';
  }

  lastError(): string {
    try {
      const code = this.api.LMSGetLastError();
      return `${code} ${this.api.LMSGetErrorString(code)}`;
    } catch {
      return 'desconocido';
    }
  }

  get isActive() {
    return this.initialized && !this.finished;
  }
}
