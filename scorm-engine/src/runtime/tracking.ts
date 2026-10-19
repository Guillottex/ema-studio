import type { CourseDoc, FlatScreen, Question } from '../types';
import { ScormConnection, toCMITimespan } from './scorm12';
import { responseToString, scormInteractionType } from '../assessment/grading';

/** Límite de cmi.suspend_data en SCORM 1.2 */
export const SUSPEND_LIMIT = 4096;

export interface LearnerState {
  loc: number; // índice de pantalla actual
  locId: string;
  visited: Set<number>;
  done: Set<string>; // componentes completados
  comp: Record<string, any>; // estado por componente
  vars: Record<string, string>;
  final: { score: number; passed: boolean; attemptsExhausted: boolean } | null;
  scores: Record<string, [number, number]>; // puntaje por pregunta/evaluación (no finales)
}

export function emptyState(): LearnerState {
  return { loc: 0, locId: '', visited: new Set(), done: new Set(), comp: {}, vars: {}, final: null, scores: {} };
}

/** "0-4,7,9-10" */
export function encodeRanges(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const start = s[i];
    while (i + 1 < s.length && s[i + 1] === s[i] + 1) i++;
    out.push(start === s[i] ? String(start) : `${start}-${s[i]}`);
  }
  return out.join(',');
}

export function decodeRanges(str: string): number[] {
  if (!str) return [];
  return str.split(',').flatMap((p) => {
    const [a, b] = p.split('-').map(Number);
    if (isNaN(a)) return [];
    if (b === undefined || isNaN(b)) return [a];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
}

export function encodeSuspend(st: LearnerState, quizIds: Set<string>): string {
  const payload: any = {
    v: 1,
    l: st.loc,
    s: st.locId,
    vi: encodeRanges([...st.visited]),
    d: [...st.done],
    c: { ...st.comp },
    x: st.vars,
    f: st.final ? [Math.round(st.final.score * 100) / 100, st.final.passed ? 1 : 0, st.final.attemptsExhausted ? 1 : 0] : 0,
    q: st.scores,
  };
  let out = JSON.stringify(payload);
  if (out.length <= SUSPEND_LIMIT) return out;
  // Reducción progresiva: primero respuestas de preguntas, luego estados de componentes no evaluativos
  for (const k of Object.keys(payload.c)) {
    if (!quizIds.has(k) && payload.c[k] && typeof payload.c[k] === 'object' && 'response' in payload.c[k]) payload.c[k] = { ...payload.c[k], response: null };
  }
  out = JSON.stringify(payload);
  if (out.length <= SUSPEND_LIMIT) return out;
  for (const k of Object.keys(payload.c)) if (!quizIds.has(k)) delete payload.c[k];
  out = JSON.stringify(payload);
  if (out.length <= SUSPEND_LIMIT) return out;
  payload.q = {};
  payload.c = {};
  out = JSON.stringify(payload);
  return out.slice(0, SUSPEND_LIMIT);
}

export function decodeSuspend(raw: string): LearnerState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return null;
    return {
      loc: Number(p.l) || 0,
      locId: p.s || '',
      visited: new Set(decodeRanges(p.vi || '')),
      done: new Set(p.d || []),
      comp: p.c || {},
      vars: p.x || {},
      final: Array.isArray(p.f) ? { score: p.f[0], passed: !!p.f[1], attemptsExhausted: !!p.f[2] } : null,
      scores: p.q || {},
    };
  } catch {
    return null;
  }
}

/** Ubicación legible para cmi.core.lesson_location: "M2-L3-P7" */
export function locationLabel(f: FlatScreen): string {
  return `M${f.moduleIndex + 1}-L${f.lessonIndex + 1}-P${f.screenIndex + 1}`;
}

export function parseLocation(loc: string, flat: FlatScreen[]): number {
  const m = /^M(\d+)-L(\d+)-P(\d+)$/.exec(loc || '');
  if (!m) return -1;
  return flat.findIndex((f) => f.moduleIndex === +m[1] - 1 && f.lessonIndex === +m[2] - 1 && f.screenIndex === +m[3] - 1);
}

export type LessonStatus = 'passed' | 'completed' | 'failed' | 'incomplete' | 'browsed' | 'not attempted';

export class Tracker {
  conn: ScormConnection;
  state: LearnerState = emptyState();
  status: LessonStatus = 'not attempted';
  private sessionStart = Date.now();
  private interactionCount = 0;
  hasFinalQuiz: boolean;
  quizIds = new Set<string>();
  resumed = false;

  constructor(private doc: CourseDoc, private flat: FlatScreen[], log?: (m: string) => void) {
    this.conn = new ScormConnection(doc.id, log);
    let final = false;
    flat.forEach((f) =>
      f.screen.components.forEach((c) => {
        if (c.type === 'quiz') {
          this.quizIds.add(c.id);
          if (c.props.isFinal) final = true;
        }
      })
    );
    this.hasFinalQuiz = final;
  }

  /** Inicializa la sesión y devuelve el estado previo (si existe) para reanudar */
  start(): { saved: LearnerState | null; entry: string } {
    this.conn.init();
    const st = this.conn.get('cmi.core.lesson_status') as LessonStatus;
    this.status = st || 'not attempted';
    if (this.status === 'not attempted' || !this.status) {
      this.status = 'incomplete';
      this.conn.set('cmi.core.lesson_status', 'incomplete');
    }
    const entry = this.conn.get('cmi.core.entry');
    let saved = decodeSuspend(this.conn.get('cmi.suspend_data'));
    const locIdx = parseLocation(this.conn.get('cmi.core.lesson_location'), this.flat);
    if (!saved && locIdx >= 0) {
      saved = emptyState();
      saved.loc = locIdx;
      for (let i = 0; i <= locIdx; i++) saved.visited.add(i);
    }
    if (saved) {
      // validar que la ubicación siga existiendo (el curso pudo cambiar entre versiones)
      const byId = this.flat.findIndex((f) => f.screen.id === saved!.locId);
      if (byId >= 0) saved.loc = byId;
      else if (locIdx >= 0) saved.loc = locIdx;
      if (saved.loc >= this.flat.length) saved.loc = 0;
    }
    this.conn.set('cmi.core.score.min', '0');
    this.conn.set('cmi.core.score.max', '100');
    this.conn.set('cmi.core.exit', 'suspend');
    try {
      this.interactionCount = parseInt(this.conn.get('cmi.interactions._count') || '0', 10) || 0;
    } catch {
      this.interactionCount = 0;
    }
    return { saved, entry };
  }

  learnerName(): string {
    const raw = this.conn.get('cmi.core.student_name');
    if (!raw) return '';
    const [last, first] = raw.split(',').map((s) => s.trim());
    return first ? `${first} ${last}` : last;
  }

  visitedPct(): number {
    return this.flat.length ? (this.state.visited.size / this.flat.length) * 100 : 0;
  }

  /** Puntaje del curso (0-100) o null */
  courseScore(): number | null {
    if (this.state.final) return this.state.final.score;
    const vals = Object.values(this.state.scores);
    if (!vals.length) return null;
    const [s, m] = vals.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    return m ? (s / m) * 100 : null;
  }

  computeStatus(): LessonStatus {
    const crit = this.doc.settings.completion?.criteria || 'visited';
    const visitedOk = this.visitedPct() >= (this.doc.settings.completion?.visitedPercent ?? 100) - 0.001;
    const useQuiz = (crit === 'quiz' || crit === 'both') && this.hasFinalQuiz;
    let next: LessonStatus = this.status === 'not attempted' ? 'incomplete' : this.status;
    if (useQuiz) {
      const f = this.state.final;
      if (f?.passed && (crit === 'quiz' || visitedOk)) next = 'passed';
      else if (f && !f.passed && f.attemptsExhausted) next = 'failed';
      else if (this.status !== 'passed') next = this.status === 'failed' && !f?.passed ? 'failed' : 'incomplete';
    } else if (visitedOk) {
      next = this.state.final ? (this.state.final.passed ? 'passed' : this.state.final.attemptsExhausted ? 'failed' : 'completed') : 'completed';
    }
    // nunca degradar un estado final
    if ((this.status === 'passed' || this.status === 'completed') && (next === 'incomplete' || next === 'failed')) return this.status;
    return next;
  }

  save(commit = true) {
    if (!this.conn.isActive) return;
    const f = this.flat[this.state.loc];
    if (f) this.conn.set('cmi.core.lesson_location', locationLabel(f));
    this.state.locId = f?.screen.id || '';
    this.conn.set('cmi.suspend_data', encodeSuspend(this.state, this.quizIds));
    const score = this.courseScore();
    if (score !== null) this.conn.set('cmi.core.score.raw', String(Math.round(score * 100) / 100));
    const st = this.computeStatus();
    if (st !== this.status) {
      this.status = st;
      this.conn.set('cmi.core.lesson_status', st);
    }
    if (commit) this.conn.commit();
  }

  recordInteraction(id: string, q: Question, response: any, correct: boolean) {
    if (!this.conn.isActive) return;
    const n = this.interactionCount++;
    const pre = `cmi.interactions.${n}.`;
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 250);
    this.conn.set(pre + 'id', safeId);
    this.conn.set(pre + 'type', scormInteractionType(q.type));
    const r = responseToString(q, response);
    if (r) this.conn.set(pre + 'student_response', r);
    this.conn.set(pre + 'result', correct ? 'correct' : 'wrong');
    this.conn.set(pre + 'weighting', String(q.points || 1));
  }

  finish() {
    if (!this.conn.isActive) return;
    this.save(false);
    this.conn.set('cmi.core.session_time', toCMITimespan(Date.now() - this.sessionStart));
    this.conn.set('cmi.core.exit', 'suspend');
    this.conn.commit();
    this.conn.finish();
  }
}
