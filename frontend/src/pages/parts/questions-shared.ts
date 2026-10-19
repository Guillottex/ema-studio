import type { Question } from '@engine';

export type BankQuestion = Question & { categoryId: number | null; category?: string | null; createdAt?: string };

export interface Category { id: number; name: string; description: string | null; color: string; courses: number; questions: number; created_at?: string }

export interface QuizSettings {
  passingScore: number; attempts: number; timeLimit: number; drawCount: number; randomize: boolean;
  showAnswers: boolean; showResult: boolean; passMessage: string; failMessage: string;
}

export interface QuizRow {
  id: string; title: string; description: string; settings: Partial<QuizSettings>; questions: number;
  created_at: string; updated_at: string; created_by_name?: string | null;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  passingScore: 70, attempts: 2, timeLimit: 0, drawCount: 0, randomize: false, showAnswers: true, showResult: true,
  passMessage: '¡Felicitaciones! Aprobaste la evaluación.', failMessage: 'No alcanzaste el puntaje mínimo.',
};

const TYPE_COLORS: Record<string, 'blue' | 'violet' | 'green' | 'amber' | 'slate' | 'red'> = {
  single: 'blue', truefalse: 'green', multiple: 'violet', order: 'amber', match: 'amber', fill: 'slate', short: 'slate',
};
export const typeColor = (t: string) => TYPE_COLORS[t] || 'slate';

/** Cuerpo que acepta POST/PUT /questions (sin nulls donde el backend espera opcionales) */
export function questionPayload(q: Question, categoryId: number | null) {
  return {
    type: q.type,
    prompt: q.prompt,
    media: q.media && q.media.src ? q.media : null,
    options: (q.options || []).map((o) => ({
      id: o.id, text: o.text ?? '', correct: !!o.correct,
      ...(o.match != null ? { match: o.match } : {}),
      ...(o.feedback != null ? { feedback: o.feedback } : {}),
    })),
    ...(q.fillText != null ? { fillText: q.fillText } : {}),
    ...(q.acceptedAnswers ? { acceptedAnswers: q.acceptedAnswers.map((s) => s.trim()).filter(Boolean) } : {}),
    caseSensitive: !!q.caseSensitive,
    partialCredit: !!q.partialCredit,
    points: Number(q.points) || 0,
    feedbackCorrect: q.feedbackCorrect ?? '',
    feedbackIncorrect: q.feedbackIncorrect ?? '',
    explanation: q.explanation ?? '',
    attempts: Number(q.attempts) || 0,
    shuffle: !!q.shuffle,
    timeLimit: Number(q.timeLimit) || 0,
    categoryId,
  };
}

/** Cantidad de "elementos" de la pregunta, según tipo */
export function optionsSummary(q: Question): string {
  if (q.type === 'fill') {
    const n = (String(q.fillText || '').match(/\{\{[^}]+\}\}/g) || []).length;
    return `${n} espacio${n === 1 ? '' : 's'}`;
  }
  if (q.type === 'short') {
    const n = (q.acceptedAnswers || []).filter(Boolean).length;
    return `${n} respuesta${n === 1 ? '' : 's'}`;
  }
  const n = q.options?.length || 0;
  const noun = q.type === 'match' ? 'par' : q.type === 'order' ? 'elemento' : 'opción';
  const plural = q.type === 'match' ? 'pares' : q.type === 'order' ? 'elementos' : 'opciones';
  return `${n} ${n === 1 ? noun : plural}`;
}
