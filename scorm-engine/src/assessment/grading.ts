import type { Question, QuizConfig } from '../types';

export type Response =
  | { kind: 'choice'; selected: string[] }
  | { kind: 'order'; order: string[] }
  | { kind: 'match'; pairs: Record<string, string> }
  | { kind: 'fill'; values: string[] }
  | { kind: 'short'; value: string }
  | null;

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single: 'Opción múltiple',
  truefalse: 'Verdadero / Falso',
  multiple: 'Selección múltiple',
  order: 'Ordenar elementos',
  match: 'Relacionar conceptos',
  fill: 'Completar espacios',
  short: 'Respuesta corta',
};

const norm = (s: string, cs?: boolean) => {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  const base = cs ? t : t.toLowerCase();
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '');
};

/** Extrae los huecos de un texto "La función {{SUMA|SUM}} suma" → [["SUMA","SUM"]] */
export function parseBlanks(fillText = ''): { parts: string[]; answers: string[][] } {
  const parts: string[] = [];
  const answers: string[][] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fillText))) {
    parts.push(fillText.slice(last, m.index));
    answers.push(m[1].split('|').map((s) => s.trim()).filter(Boolean));
    last = m.index + m[0].length;
  }
  parts.push(fillText.slice(last));
  return { parts, answers };
}

export function gradeQuestion(q: Question, r: Response): { correct: boolean; score: number; maxScore: number; ratio: number } {
  const max = Number(q.points) || 1;
  let ratio = 0;
  if (r) {
    switch (q.type) {
      case 'single':
      case 'truefalse': {
        const correct = q.options.find((o) => o.correct)?.id;
        ratio = r.kind === 'choice' && r.selected.length === 1 && r.selected[0] === correct ? 1 : 0;
        break;
      }
      case 'multiple': {
        if (r.kind !== 'choice') break;
        const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
        const sel = new Set(r.selected);
        const hits = correctIds.filter((id) => sel.has(id)).length;
        const wrong = r.selected.filter((id) => !correctIds.includes(id)).length;
        const exact = hits === correctIds.length && wrong === 0;
        ratio = exact ? 1 : q.partialCredit ? Math.max(0, (hits - wrong) / Math.max(1, correctIds.length)) : 0;
        break;
      }
      case 'order': {
        if (r.kind !== 'order') break;
        const expected = q.options.map((o) => o.id);
        const okCount = expected.filter((id, i) => r.order[i] === id).length;
        ratio = okCount === expected.length ? 1 : q.partialCredit ? okCount / expected.length : 0;
        break;
      }
      case 'match': {
        if (r.kind !== 'match') break;
        const okCount = q.options.filter((o) => r.pairs[o.id] === o.id).length;
        ratio = okCount === q.options.length ? 1 : q.partialCredit ? okCount / q.options.length : 0;
        break;
      }
      case 'fill': {
        if (r.kind !== 'fill') break;
        const { answers } = parseBlanks(q.fillText);
        const okCount = answers.filter((acc, i) => acc.some((a) => norm(a, q.caseSensitive) === norm(r.values[i] || '', q.caseSensitive))).length;
        ratio = answers.length && okCount === answers.length ? 1 : q.partialCredit && answers.length ? okCount / answers.length : 0;
        break;
      }
      case 'short': {
        if (r.kind !== 'short') break;
        const v = norm(r.value, q.caseSensitive);
        ratio = (q.acceptedAnswers || []).some((a) => norm(a, q.caseSensitive) === v) ? 1 : 0;
        break;
      }
    }
  }
  return { correct: ratio >= 0.999, score: Math.round(ratio * max * 100) / 100, maxScore: max, ratio };
}

/** Respuesta correcta en texto legible (para revisión). */
export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'single':
    case 'truefalse':
    case 'multiple':
      return q.options.filter((o) => o.correct).map((o) => o.text).join(', ');
    case 'order':
      return q.options.map((o, i) => `${i + 1}. ${o.text}`).join('  ');
    case 'match':
      return q.options.map((o) => `${o.text} → ${o.match}`).join(' · ');
    case 'fill':
      return parseBlanks(q.fillText).answers.map((a) => a[0]).join(', ');
    case 'short':
      return (q.acceptedAnswers || [])[0] || '';
  }
  return '';
}

/** Representación compacta de la respuesta para cmi.interactions.n.student_response (máx 255) */
export function responseToString(q: Question, r: Response): string {
  if (!r) return '';
  let s = '';
  if (r.kind === 'choice') s = r.selected.map((id) => String(q.options.findIndex((o) => o.id === id) + 1)).join(',');
  else if (r.kind === 'order') s = r.order.map((id) => String(q.options.findIndex((o) => o.id === id) + 1)).join(',');
  else if (r.kind === 'match') s = Object.entries(r.pairs).map(([k, v]) => `${q.options.findIndex((o) => o.id === k) + 1}.${q.options.findIndex((o) => o.id === v) + 1}`).join(',');
  else if (r.kind === 'fill') s = r.values.join(',');
  else if (r.kind === 'short') s = r.value;
  return s.slice(0, 255);
}

export function scormInteractionType(t: Question['type']): string {
  return ({ single: 'choice', multiple: 'choice', truefalse: 'true-false', order: 'sequencing', match: 'matching', fill: 'fill-in', short: 'fill-in' } as any)[t] || 'choice';
}

/** Validación de una pregunta: devuelve lista de problemas (vacía = OK) */
export function validateQuestion(q: Question): string[] {
  const issues: string[] = [];
  if (!q.prompt || !String(q.prompt).replace(/<[^>]*>/g, '').trim()) issues.push('La pregunta no tiene enunciado');
  switch (q.type) {
    case 'single':
    case 'truefalse':
      if (q.options.length < 2) issues.push('Necesita al menos 2 opciones');
      if (q.options.filter((o) => o.correct).length !== 1) issues.push('Debe tener exactamente una respuesta correcta');
      break;
    case 'multiple':
      if (q.options.length < 2) issues.push('Necesita al menos 2 opciones');
      if (!q.options.some((o) => o.correct)) issues.push('No tiene respuestas correctas marcadas');
      break;
    case 'order':
      if (q.options.length < 2) issues.push('Necesita al menos 2 elementos para ordenar');
      break;
    case 'match':
      if (q.options.length < 2) issues.push('Necesita al menos 2 pares');
      if (q.options.some((o) => !o.match)) issues.push('Hay pares sin concepto relacionado');
      break;
    case 'fill':
      if (!parseBlanks(q.fillText).answers.length) issues.push('El texto no tiene espacios {{respuesta}}');
      break;
    case 'short':
      if (!(q.acceptedAnswers || []).filter(Boolean).length) issues.push('No tiene respuestas aceptadas');
      break;
  }
  if (q.options.some((o) => !String(o.text || '').trim()) && q.type !== 'fill' && q.type !== 'short') issues.push('Hay opciones vacías');
  return issues;
}

export function quizMaxScore(cfg: QuizConfig): number {
  const qs = cfg.drawCount > 0 ? cfg.questions.slice(0, cfg.drawCount) : cfg.questions;
  return qs.reduce((a, q) => a + (Number(q.points) || 1), 0);
}
