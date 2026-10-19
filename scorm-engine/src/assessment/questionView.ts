import { h, shuffle } from '../render/dom';
import { icon } from '../render/icons';
import type { Question } from '../types';
import type { RenderCtx } from '../registry/types';
import { parseBlanks, type Response } from './grading';

export interface QuestionInput {
  el: HTMLElement;
  getResponse(): Response;
  isAnswered(): boolean;
  setResponse(r: Response): void;
  lock(locked: boolean): void;
  /** Marca visualmente correctas/incorrectas */
  reveal(showCorrect: boolean): void;
  onChange(cb: () => void): void;
}

let groupSeq = 0;

export function renderMedia(q: Question, ctx: RenderCtx): HTMLElement | null {
  if (!q.media || !q.media.src) return null;
  const src = ctx.asset(q.media.src);
  if (q.media.kind === 'image') return h('div', { class: 'ema-q-media' }, h('img', { src, alt: '', loading: 'lazy' }));
  if (q.media.kind === 'audio') return h('div', { class: 'ema-q-media' }, h('audio', { src, controls: true, preload: 'none' }));
  return h('div', { class: 'ema-q-media' }, h('video', { src, controls: true, preload: 'none', playsinline: true }));
}

export function renderQuestionInput(q: Question, ctx: RenderCtx, opts: { shuffle?: boolean } = {}): QuestionInput {
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach((l) => l());
  const group = `q${++groupSeq}`;
  let locked = false;

  if (q.type === 'single' || q.type === 'truefalse' || q.type === 'multiple') {
    const multi = q.type === 'multiple';
    const opts2 = opts.shuffle && q.type !== 'truefalse' ? shuffle(q.options) : q.options;
    const root = h('div', { class: 'ema-q-options', role: multi ? 'group' : 'radiogroup' });
    const inputs: HTMLInputElement[] = [];
    opts2.forEach((o) => {
      const inp = h('input', { type: multi ? 'checkbox' : 'radio', name: group, value: o.id }) as HTMLInputElement;
      inp.addEventListener('change', () => {
        root.querySelectorAll('.ema-q-option').forEach((l) => l.classList.toggle('is-selected', (l.querySelector('input') as HTMLInputElement).checked));
        changed();
      });
      inputs.push(inp);
      root.appendChild(h('label', { class: 'ema-q-option', 'data-id': o.id }, inp, h('span', { class: 'ema-q-mark' }), h('span', { class: 'ema-q-text' }, o.text)));
    });
    if (multi) root.prepend(h('p', { class: 'ema-q-hint' }, 'Seleccioná todas las opciones correctas.'));
    return {
      el: root,
      getResponse: () => ({ kind: 'choice', selected: inputs.filter((i) => i.checked).map((i) => i.value) }),
      isAnswered: () => inputs.some((i) => i.checked),
      setResponse(r) {
        if (r?.kind !== 'choice') return;
        inputs.forEach((i) => (i.checked = r.selected.includes(i.value)));
        root.querySelectorAll('.ema-q-option').forEach((l) => l.classList.toggle('is-selected', (l.querySelector('input') as HTMLInputElement).checked));
      },
      lock(l) { locked = l; inputs.forEach((i) => (i.disabled = l)); },
      reveal(showCorrect) {
        root.querySelectorAll<HTMLElement>('.ema-q-option').forEach((l) => {
          const o = q.options.find((x) => x.id === l.dataset.id)!;
          const sel = (l.querySelector('input') as HTMLInputElement).checked;
          l.classList.toggle('is-correct', !!o.correct && (showCorrect || sel));
          l.classList.toggle('is-wrong', sel && !o.correct);
        });
      },
      onChange: (cb) => listeners.push(cb),
    };
  }

  if (q.type === 'order') {
    let order = shuffle(q.options.map((o) => o.id));
    if (order.every((id, i) => id === q.options[i].id) && order.length > 1) order = order.slice().reverse();
    const list = h('ol', { class: 'ema-q-order' });
    let dragId: string | null = null;
    const draw = () => {
      list.innerHTML = '';
      order.forEach((id, i) => {
        const o = q.options.find((x) => x.id === id)!;
        const up = h('button', { type: 'button', class: 'ema-q-mv', 'aria-label': 'Subir', disabled: i === 0 || locked }, '▲');
        const down = h('button', { type: 'button', class: 'ema-q-mv', 'aria-label': 'Bajar', disabled: i === order.length - 1 || locked }, '▼');
        up.addEventListener('click', () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); changed(); });
        down.addEventListener('click', () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); changed(); });
        const li = h('li', { class: 'ema-q-order-item', draggable: !locked ? 'true' : 'false', 'data-id': id }, h('span', { class: 'ema-q-grip' }, '⋮⋮'), h('span', { class: 'ema-q-text' }, o.text), h('span', { class: 'ema-q-mvs' }, up, down));
        li.addEventListener('dragstart', (e) => { dragId = id; li.classList.add('is-drag'); e.dataTransfer?.setData('text/plain', id); });
        li.addEventListener('dragend', () => li.classList.remove('is-drag'));
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          if (!dragId || dragId === id || locked) return;
          const from = order.indexOf(dragId);
          order.splice(from, 1);
          order.splice(order.indexOf(id) + (from <= i ? 1 : 0), 0, dragId);
          draw();
          changed();
        });
        list.appendChild(li);
      });
    };
    draw();
    return {
      el: h('div', null, h('p', { class: 'ema-q-hint' }, 'Arrastrá o usá las flechas para ordenar.'), list),
      getResponse: () => ({ kind: 'order', order: order.slice() }),
      isAnswered: () => true,
      setResponse(r) { if (r?.kind === 'order') { order = r.order.slice(); draw(); } },
      lock(l) { locked = l; draw(); },
      reveal() {
        list.querySelectorAll<HTMLElement>('li').forEach((li, i) => {
          const ok = q.options[i]?.id === li.dataset.id;
          li.classList.toggle('is-correct', ok);
          li.classList.toggle('is-wrong', !ok);
        });
      },
      onChange: (cb) => listeners.push(cb),
    };
  }

  if (q.type === 'match') {
    const rights = shuffle(q.options.map((o) => ({ id: o.id, text: o.match || '' })));
    const selects: HTMLSelectElement[] = [];
    const root = h('div', { class: 'ema-q-match' });
    q.options.forEach((o) => {
      const sel = h('select', { 'data-id': o.id }, h('option', { value: '' }, 'Elegí…'), rights.map((r) => h('option', { value: r.id }, r.text))) as HTMLSelectElement;
      sel.addEventListener('change', changed);
      selects.push(sel);
      root.appendChild(h('div', { class: 'ema-q-match-row', 'data-id': o.id }, h('span', { class: 'ema-q-match-left' }, o.text), icon('arrow-right', 16), sel));
    });
    return {
      el: root,
      getResponse: () => ({ kind: 'match', pairs: Object.fromEntries(selects.map((s) => [s.dataset.id!, s.value])) }),
      isAnswered: () => selects.every((s) => s.value),
      setResponse(r) { if (r?.kind === 'match') selects.forEach((s) => (s.value = r.pairs[s.dataset.id!] || '')); },
      lock(l) { selects.forEach((s) => (s.disabled = l)); },
      reveal(showCorrect) {
        root.querySelectorAll<HTMLElement>('.ema-q-match-row').forEach((row) => {
          const s = row.querySelector('select')!;
          const ok = s.value === row.dataset.id;
          row.classList.toggle('is-correct', ok);
          row.classList.toggle('is-wrong', !ok);
          row.querySelector('.ema-q-correct')?.remove();
          if (!ok && showCorrect) row.appendChild(h('span', { class: 'ema-q-correct' }, '✓ ' + (q.options.find((o) => o.id === row.dataset.id)?.match || '')));
        });
      },
      onChange: (cb) => listeners.push(cb),
    };
  }

  if (q.type === 'fill') {
    const { parts, answers } = parseBlanks(q.fillText);
    const inputs: HTMLInputElement[] = [];
    const p = h('p', { class: 'ema-q-fill' });
    parts.forEach((txt, i) => {
      p.appendChild(document.createTextNode(txt));
      if (i < answers.length) {
        const inp = h('input', { type: 'text', class: 'ema-q-blank', 'aria-label': `Espacio ${i + 1}`, autocomplete: 'off', size: Math.max(6, (answers[i][0] || '').length + 2) }) as HTMLInputElement;
        inp.addEventListener('input', changed);
        inputs.push(inp);
        p.appendChild(inp);
      }
    });
    return {
      el: p,
      getResponse: () => ({ kind: 'fill', values: inputs.map((i) => i.value) }),
      isAnswered: () => inputs.every((i) => i.value.trim()),
      setResponse(r) { if (r?.kind === 'fill') inputs.forEach((i, j) => (i.value = r.values[j] || '')); },
      lock(l) { inputs.forEach((i) => (i.disabled = l)); },
      reveal(showCorrect) {
        const n = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        inputs.forEach((inp, i) => {
          const ok = answers[i].some((a) => (q.caseSensitive ? a.trim() === inp.value.trim() : n(a) === n(inp.value)));
          inp.classList.toggle('is-correct', ok);
          inp.classList.toggle('is-wrong', !ok);
          if (!ok && showCorrect) inp.title = 'Correcto: ' + answers[i][0];
        });
      },
      onChange: (cb) => listeners.push(cb),
    };
  }

  // short
  const inp = h('input', { type: 'text', class: 'ema-q-short', placeholder: 'Escribí tu respuesta', autocomplete: 'off' }) as HTMLInputElement;
  inp.addEventListener('input', changed);
  return {
    el: h('div', null, inp),
    getResponse: () => ({ kind: 'short', value: inp.value }),
    isAnswered: () => !!inp.value.trim(),
    setResponse(r) { if (r?.kind === 'short') inp.value = r.value; },
    lock(l) { inp.disabled = l; },
    reveal() { /* el feedback textual indica la respuesta */ },
    onChange: (cb) => listeners.push(cb),
  };
}
