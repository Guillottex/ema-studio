import { h, shuffle } from '../../render/dom';
import { icon } from '../../render/icons';
import type { ComponentDef, RenderCtx } from '../types';
import type { ComponentData, Question, QuizConfig } from '../../types';
import { gradeQuestion, correctAnswerText, type Response } from '../../assessment/grading';
import { renderQuestionInput, renderMedia } from '../../assessment/questionView';
import { newQuestion, newQuiz } from '../../assessment/factory';

interface QState { attempts: number; done: boolean; correct: boolean; response: Response }

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderSingleQuestion(c: ComponentData, ctx: RenderCtx): HTMLElement {
  const q: Question = c.props.question;
  if (!q) return h('div', { class: 'ema-placeholder' }, 'Pregunta sin configurar');
  const st: QState = ctx.getCompState<QState>(c.id) || { attempts: 0, done: false, correct: false, response: null };
  const input = renderQuestionInput(q, ctx, { shuffle: q.shuffle });
  const feedback = h('div', { class: 'ema-q-feedback', 'aria-live': 'polite' });
  const submit = h('button', { type: 'button', class: 'ema-btn ema-btn-primary' }, icon('check', 18), h('span', null, c.props.submitText || 'Comprobar')) as HTMLButtonElement;
  const retry = h('button', { type: 'button', class: 'ema-btn ema-btn-outline', hidden: true }, icon('retry', 16), h('span', null, 'Reintentar')) as HTMLButtonElement;
  const timerEl = h('span', { class: 'ema-q-timer', hidden: true });
  const attemptsInfo = h('span', { class: 'ema-q-attempts' });
  const maxAttempts = q.attempts || 0;
  let timer: any = null;

  const updateAttempts = () => {
    attemptsInfo.textContent = maxAttempts ? `Intento ${Math.min(st.attempts + (st.done ? 0 : 1), maxAttempts)} de ${maxAttempts}` : '';
  };
  const showFeedback = (correct: boolean, final: boolean) => {
    feedback.innerHTML = '';
    feedback.className = 'ema-q-feedback ' + (correct ? 'is-correct' : 'is-wrong');
    feedback.append(...([
      h('div', { class: 'ema-q-fb-title' }, icon(correct ? 'check-circle' : 'alert', 20), h('strong', null, correct ? q.feedbackCorrect || '¡Correcto!' : q.feedbackIncorrect || 'Incorrecto')),
      !correct && final && c.props.showCorrect !== false ? h('p', null, h('b', null, 'Respuesta correcta: '), correctAnswerText(q)) : null,
      final && q.explanation ? h('p', { class: 'ema-q-expl' }, q.explanation) : null,
    ].filter(Boolean) as Node[]));
  };
  const startTimer = () => {
    if (!q.timeLimit || ctx.mode !== 'play' || st.done) return;
    let left = q.timeLimit;
    timerEl.hidden = false;
    timerEl.textContent = '⏱ ' + fmtTime(left);
    clearInterval(timer);
    timer = setInterval(() => {
      if (!timerEl.isConnected) return clearInterval(timer);
      left--;
      timerEl.textContent = '⏱ ' + fmtTime(Math.max(0, left));
      if (left <= 0) { clearInterval(timer); doSubmit(true); }
    }, 1000);
  };
  const doSubmit = (timeout = false) => {
    if (st.done) return;
    if (!timeout && !input.isAnswered()) {
      feedback.className = 'ema-q-feedback is-warn';
      feedback.textContent = 'Respondé antes de comprobar.';
      return;
    }
    clearInterval(timer);
    const r = input.getResponse();
    const res = gradeQuestion(q, r);
    st.attempts++;
    st.response = r;
    st.correct = res.correct;
    const final = res.correct || (maxAttempts > 0 && st.attempts >= maxAttempts);
    st.done = final;
    input.lock(true);
    input.reveal(final && c.props.showCorrect !== false);
    showFeedback(res.correct, final);
    ctx.setCompState(c.id, st);
    if (final) {
      submit.hidden = true;
      retry.hidden = true;
      ctx.reportQuestion(c.id, q, res);
      ctx.markComplete(c.id);
    } else {
      retry.hidden = false;
      submit.hidden = true;
    }
    updateAttempts();
  };
  submit.addEventListener('click', () => doSubmit());
  retry.addEventListener('click', () => {
    input.lock(false);
    feedback.innerHTML = '';
    feedback.className = 'ema-q-feedback';
    retry.hidden = true;
    submit.hidden = false;
    input.el.querySelectorAll('.is-correct,.is-wrong').forEach((e) => e.classList.remove('is-correct', 'is-wrong'));
    updateAttempts();
    startTimer();
  });

  if (st.done) {
    input.setResponse(st.response);
    input.lock(true);
    input.reveal(c.props.showCorrect !== false);
    showFeedback(st.correct, true);
    submit.hidden = true;
  } else startTimer();
  updateAttempts();

  return h(
    'div',
    { class: 'ema-question' },
    h('div', { class: 'ema-q-head' }, h('span', { class: 'ema-q-badge' }, icon('help', 16), 'Pregunta'), h('span', { class: 'ema-q-meta' }, attemptsInfo, timerEl)),
    renderMedia(q, ctx),
    h('div', { class: 'ema-q-prompt', html: q.prompt }),
    input.el,
    h('div', { class: 'ema-q-actions' }, submit, retry),
    feedback
  );
}

interface QuizState {
  attempts: number;
  best: number;
  last: number;
  passed: boolean;
  finished: boolean;
  review?: { qid: string; correct: boolean }[];
}

function renderQuiz(c: ComponentData, ctx: RenderCtx): HTMLElement {
  const cfg: QuizConfig = { ...newQuiz(), ...(c.props as any) };
  const root = h('div', { class: 'ema-quiz' });
  const st: QuizState = ctx.getCompState<QuizState>(c.id) || { attempts: 0, best: 0, last: 0, passed: false, finished: false };
  let timer: any = null;
  const save = () => ctx.setCompState(c.id, st);
  const attemptsLeft = () => (cfg.attempts > 0 ? cfg.attempts - st.attempts : Infinity);

  const intro = () => {
    clearInterval(timer);
    root.innerHTML = '';
    const total = cfg.drawCount > 0 ? Math.min(cfg.drawCount, cfg.questions.length) : cfg.questions.length;
    const info = h('ul', { class: 'ema-quiz-info' },
      h('li', null, icon('help', 18), `${total} preguntas`),
      h('li', null, icon('target', 18), `Puntaje mínimo: ${cfg.passingScore}%`),
      h('li', null, icon('retry', 18), cfg.attempts > 0 ? `Intentos: ${st.attempts} de ${cfg.attempts}` : 'Intentos ilimitados'),
      cfg.timeLimit > 0 ? h('li', null, icon('clock', 18), `Tiempo: ${cfg.timeLimit} min`) : null);
    const start = h('button', { type: 'button', class: 'ema-btn ema-btn-primary ema-btn-lg' }, icon('play', 18), h('span', null, st.attempts ? 'Reintentar evaluación' : 'Comenzar evaluación'));
    start.addEventListener('click', () => run());
    if (ctx.mode === 'edit') start.setAttribute('tabindex', '-1');
    root.append(
      h('div', { class: 'ema-quiz-card' },
        h('div', { class: 'ema-quiz-icon' }, icon(cfg.isFinal ? 'award' : 'check-circle', 34)),
        h('h2', null, cfg.title),
        cfg.intro ? h('p', { class: 'ema-muted' }, cfg.intro) : null,
        info,
        attemptsLeft() > 0 ? start : h('p', { class: 'ema-q-feedback is-wrong' }, 'No quedan intentos disponibles.'))
    );
  };

  const result = (pct: number, review: { q: Question; r: Response; correct: boolean }[] | null) => {
    clearInterval(timer);
    root.innerHTML = '';
    const passed = st.passed;
    const card = h('div', { class: 'ema-quiz-card ema-quiz-result ' + (passed ? 'is-passed' : 'is-failed') },
      h('div', { class: 'ema-quiz-icon' }, icon(passed ? 'trophy' : 'alert', 38)),
      h('h2', null, passed ? 'Evaluación aprobada' : 'Evaluación no aprobada'),
      cfg.showResult ? h('div', { class: 'ema-quiz-score' }, h('strong', null, `${Math.round(pct)}%`), h('span', null, `Mínimo requerido: ${cfg.passingScore}%`)) : null,
      h('p', null, passed ? cfg.passMessage : cfg.failMessage));
    const actions = h('div', { class: 'ema-q-actions' });
    if (!passed && attemptsLeft() > 0) {
      actions.appendChild(h('button', { type: 'button', class: 'ema-btn ema-btn-primary', onclick: () => run() }, icon('retry', 16), h('span', null, `Reintentar (${attemptsLeft() === Infinity ? 'ilimitado' : attemptsLeft() + ' restantes'})`)));
    }
    const nextScreen = passed ? cfg.passScreen : cfg.failScreen;
    const finalFail = !passed && attemptsLeft() <= 0;
    if (nextScreen && (passed || finalFail)) {
      actions.appendChild(h('button', { type: 'button', class: 'ema-btn ema-btn-secondary', onclick: () => ctx.navigate('screen', nextScreen) }, h('span', null, 'Continuar'), icon('arrow-right', 16)));
    }
    card.appendChild(actions);
    if (review && cfg.showAnswers) {
      card.appendChild(h('h3', { class: 'ema-quiz-review-title' }, 'Revisión de respuestas'));
      card.appendChild(h('ol', { class: 'ema-quiz-review' }, review.map(({ q, correct }) =>
        h('li', { class: correct ? 'is-correct' : 'is-wrong' },
          h('div', { html: q.prompt }),
          h('small', null, correct ? '✓ Correcta' : '✗ Incorrecta · Respuesta correcta: ' + correctAnswerText(q)),
          q.explanation ? h('small', { class: 'ema-muted' }, q.explanation) : null))));
    }
    root.appendChild(card);
  };

  const run = () => {
    if (ctx.mode === 'edit') return;
    let qs = cfg.randomize ? shuffle(cfg.questions) : cfg.questions.slice();
    if (cfg.drawCount > 0) qs = qs.slice(0, cfg.drawCount);
    const responses: Response[] = qs.map(() => null);
    let i = 0;
    let secondsLeft = cfg.timeLimit > 0 ? cfg.timeLimit * 60 : 0;
    const timerEl = h('span', { class: 'ema-q-timer' });
    const finish = () => {
      clearInterval(timer);
      let raw = 0;
      let max = 0;
      const review = qs.map((q, j) => {
        const g = gradeQuestion(q, responses[j]);
        raw += g.score;
        max += g.maxScore;
        ctx.reportQuestion(c.id + ':' + q.id, q, g);
        return { q, r: responses[j], correct: g.correct };
      });
      const pct = max ? (raw / max) * 100 : 0;
      st.attempts++;
      st.last = Math.round(pct);
      st.best = Math.max(st.best, st.last);
      st.passed = st.passed || pct >= cfg.passingScore;
      st.finished = true;
      st.review = review.map((x) => ({ qid: x.q.id, correct: x.correct }));
      save();
      ctx.reportQuiz(c.id, !!cfg.isFinal, { scorePct: pct, passed: pct >= cfg.passingScore, raw, max });
      if (st.passed || attemptsLeft() <= 0) ctx.markComplete(c.id);
      result(pct, review);
    };
    if (secondsLeft) {
      timerEl.textContent = '⏱ ' + fmtTime(secondsLeft);
      clearInterval(timer);
      timer = setInterval(() => {
        if (!root.isConnected) return clearInterval(timer);
        secondsLeft--;
        timerEl.textContent = '⏱ ' + fmtTime(Math.max(0, secondsLeft));
        if (secondsLeft <= 0) finish();
      }, 1000);
    }
    const show = () => {
      root.innerHTML = '';
      const q = qs[i];
      const input = renderQuestionInput(q, ctx, { shuffle: q.shuffle });
      if (responses[i]) input.setResponse(responses[i]);
      const warn = h('div', { class: 'ema-q-feedback' });
      const prev = h('button', { type: 'button', class: 'ema-btn ema-btn-ghost', disabled: i === 0 }, icon('chevron-left', 16), h('span', null, 'Anterior'));
      const last = i === qs.length - 1;
      const next = h('button', { type: 'button', class: 'ema-btn ema-btn-primary' }, h('span', null, last ? 'Finalizar' : 'Siguiente'), icon(last ? 'check' : 'chevron-right', 16));
      prev.addEventListener('click', () => { responses[i] = input.getResponse(); i--; show(); });
      next.addEventListener('click', () => {
        if (!input.isAnswered()) { warn.className = 'ema-q-feedback is-warn'; warn.textContent = 'Respondé la pregunta para continuar.'; return; }
        responses[i] = input.getResponse();
        if (last) finish();
        else { i++; show(); }
      });
      const pct = Math.round((i / qs.length) * 100);
      root.append(h('div', { class: 'ema-quiz-card ema-quiz-q' },
        h('div', { class: 'ema-quiz-top' }, h('span', null, `Pregunta ${i + 1} de ${qs.length}`), timerEl),
        h('div', { class: 'ema-quiz-progress' }, h('span', { style: { width: pct + '%' } })),
        renderMedia(q, ctx),
        h('div', { class: 'ema-q-prompt', html: q.prompt }),
        input.el,
        warn,
        h('div', { class: 'ema-q-actions ema-q-actions-split' }, prev, next)));
    };
    show();
  };

  if (st.finished && ctx.mode === 'play') {
    result(st.last, null);
  } else intro();
  return root;
}

export const assessmentComponents: ComponentDef[] = [
  {
    type: 'question',
    label: 'Pregunta',
    category: 'assessment',
    icon: 'circle-help',
    defaultSize: { w: 820, h: 420 },
    defaultProps: () => ({ question: newQuestion('single'), submitText: 'Comprobar', showCorrect: true }),
    fields: [
      { key: 'question', label: 'Pregunta', type: 'question' },
      { key: 'submitText', label: 'Texto del botón', type: 'text' },
      { key: 'showCorrect', label: 'Mostrar respuesta correcta al finalizar', type: 'boolean' },
    ],
    flow: 'auto',
    trackable: true,
    render: renderSingleQuestion,
  },
  {
    type: 'quiz',
    label: 'Evaluación',
    category: 'assessment',
    icon: 'clipboard-check',
    defaultSize: { w: 860, h: 560 },
    defaultProps: () => newQuiz() as any,
    fields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'intro', label: 'Introducción', type: 'textarea' },
      { key: 'isFinal', label: 'Evaluación final del curso (reporta puntaje al LMS)', type: 'boolean' },
      { key: 'questions', label: 'Preguntas', type: 'questions' },
      { key: 'drawCount', label: 'Cantidad de preguntas a mostrar (0 = todas)', type: 'number', min: 0 },
      { key: 'randomize', label: 'Preguntas en orden aleatorio', type: 'boolean' },
      { key: 'passingScore', label: 'Puntaje mínimo para aprobar (%)', type: 'number', min: 0, max: 100 },
      { key: 'attempts', label: 'Cantidad de intentos (0 = ilimitados)', type: 'number', min: 0 },
      { key: 'timeLimit', label: 'Tiempo máximo (minutos, 0 = sin límite)', type: 'number', min: 0 },
      { key: 'showResult', label: 'Mostrar resultado', type: 'boolean' },
      { key: 'showAnswers', label: 'Mostrar respuestas al finalizar', type: 'boolean' },
      { key: 'passMessage', label: 'Mensaje de aprobación', type: 'textarea' },
      { key: 'failMessage', label: 'Mensaje de desaprobación', type: 'textarea' },
      { key: 'passScreen', label: 'Ir a pantalla al aprobar', type: 'screen' },
      { key: 'failScreen', label: 'Ir a pantalla al desaprobar (sin intentos)', type: 'screen' },
    ],
    flow: 'auto',
    trackable: true,
    render: renderQuiz,
  },
  {
    type: 'score',
    label: 'Resultado del curso',
    category: 'assessment',
    icon: 'trophy',
    defaultSize: { w: 600, h: 220 },
    defaultProps: () => ({ title: 'Tu resultado', text: 'Obtuviste {score}% en la evaluación final. Estado: {status}.', showIcon: true }),
    fields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Texto ({score}, {status})', type: 'textarea' },
      { key: 'showIcon', label: 'Mostrar ícono', type: 'boolean' },
    ],
    flow: 'auto',
    render(c, ctx) {
      const r = ctx.getFinalResult();
      const statusLabel = r ? (r.passed ? 'Aprobado' : 'No aprobado') : 'Pendiente';
      const text = String(c.props.text || '').replace(/\{score\}/g, r ? String(Math.round(r.score)) : '—').replace(/\{status\}/g, statusLabel);
      return h('div', { class: 'ema-score ' + (r ? (r.passed ? 'is-passed' : 'is-failed') : '') },
        c.props.showIcon ? h('div', { class: 'ema-quiz-icon' }, icon(r?.passed ? 'trophy' : r ? 'alert' : 'clock', 34)) : null,
        h('h3', null, c.props.title || ''),
        h('p', null, text));
    },
  },
];
