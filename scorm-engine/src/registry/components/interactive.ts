import { h } from '../../render/dom';
import { icon, ICON_NAMES } from '../../render/icons';
import type { ComponentDef, RenderCtx } from '../types';
import type { ComponentData } from '../../types';
import { variantOptions } from './visual';

const iconOptions = ICON_NAMES.map((n) => ({ value: n, label: n }));

/** Lleva la cuenta de ítems vistos y marca el componente como completado al ver todos. */
function visitTracker(c: ComponentData, ctx: RenderCtx, total: number) {
  const done = ctx.isComplete(c.id);
  const seen = new Set<number>(done ? Array.from({ length: total }, (_, i) => i) : ctx.getCompState<number[]>(c.id) || []);
  return {
    done,
    seen,
    visit(i: number) {
      if (ctx.mode !== 'play') return;
      seen.add(i);
      ctx.setCompState(c.id, [...seen]);
      if (seen.size >= total) ctx.markComplete(c.id);
    },
  };
}


/**
 * Mantiene una capa (imagen + marcadores) con la proporción de la imagen, centrada y contenida
 * dentro del contenedor, para que los marcadores en % coincidan siempre con la imagen.
 */
function fitLayer(container: HTMLElement, layer: HTMLElement, img: HTMLImageElement | null) {
  const fit = () => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img?.naturalWidth || 16;
    const ih = img?.naturalHeight || 9;
    if (!cw) return;
    let w = cw;
    let hh = (cw * ih) / iw;
    if (ch && hh > ch) { hh = ch; w = (ch * iw) / ih; }
    layer.style.width = w + 'px';
    layer.style.height = hh + 'px';
  };
  if (img) img.addEventListener('load', fit);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { if (!container.isConnected) ro.disconnect(); else fit(); });
    ro.observe(container);
  }
  setTimeout(fit, 0);
}

const itemContentFields = [
  { key: 'title', label: 'Título', type: 'text' as const },
  { key: 'content', label: 'Contenido', type: 'richtext' as const },
];

export const interactiveComponents: ComponentDef[] = [
  {
    type: 'accordion',
    label: 'Acordeón',
    category: 'interactive',
    icon: 'chevrons-up-down',
    defaultSize: { w: 760, h: 320 },
    defaultProps: () => ({
      allowMultiple: false,
      items: [
        { title: '¿Qué es una celda?', content: '<p>Es la intersección entre una fila y una columna.</p>' },
        { title: '¿Qué es un rango?', content: '<p>Un conjunto de celdas contiguas, por ejemplo A1:B5.</p>' },
        { title: '¿Qué es una hoja?', content: '<p>Cada una de las pestañas de un libro de trabajo.</p>' },
      ],
    }),
    fields: [
      { key: 'allowMultiple', label: 'Permitir varios abiertos', type: 'boolean' },
      { key: 'items', label: 'Secciones', type: 'list', itemFields: itemContentFields, itemLabel: 'title', newItem: () => ({ title: 'Nueva sección', content: '<p>Contenido</p>' }) },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const items = c.props.items || [];
      const tr = visitTracker(c, ctx, items.length);
      const root = h('div', { class: 'ema-accordion' });
      items.forEach((it: any, i: number) => {
        const body = h('div', { class: 'ema-acc-body', html: it.content || '' });
        const head = h('button', { type: 'button', class: 'ema-acc-head', 'aria-expanded': 'false' }, h('span', null, it.title), icon('chevron-down', 18, 'ema-acc-chevron'));
        const item = h('div', { class: 'ema-acc-item' + (tr.seen.has(i) ? ' is-seen' : '') }, head, body);
        if (ctx.mode === 'edit' && i === 0) item.classList.add('is-open');
        head.addEventListener('click', () => {
          const open = !item.classList.contains('is-open');
          if (!c.props.allowMultiple) root.querySelectorAll('.ema-acc-item.is-open').forEach((x) => { x.classList.remove('is-open'); x.querySelector('.ema-acc-head')?.setAttribute('aria-expanded', 'false'); });
          item.classList.toggle('is-open', open);
          head.setAttribute('aria-expanded', String(open));
          if (open) { item.classList.add('is-seen'); tr.visit(i); }
        });
        root.appendChild(item);
      });
      return root;
    },
  },
  {
    type: 'tabs',
    label: 'Pestañas',
    category: 'interactive',
    icon: 'folder-open',
    defaultSize: { w: 820, h: 320 },
    defaultProps: () => ({
      variant: 'underline',
      items: [
        { title: 'Pestaña 1', content: '<p>Contenido de la primera pestaña.</p>' },
        { title: 'Pestaña 2', content: '<p>Contenido de la segunda pestaña.</p>' },
        { title: 'Pestaña 3', content: '<p>Contenido de la tercera pestaña.</p>' },
      ],
    }),
    fields: [
      { key: 'variant', label: 'Estilo', type: 'select', options: [{ value: 'underline', label: 'Subrayado' }, { value: 'pills', label: 'Píldoras' }] },
      { key: 'items', label: 'Pestañas', type: 'list', itemFields: itemContentFields, itemLabel: 'title', newItem: () => ({ title: 'Nueva pestaña', content: '<p>Contenido</p>' }) },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const items = c.props.items || [];
      const tr = visitTracker(c, ctx, items.length);
      const nav = h('div', { class: 'ema-tabs-nav', role: 'tablist' });
      const panel = h('div', { class: 'ema-tabs-panel', role: 'tabpanel' });
      const select = (i: number) => {
        nav.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('is-active', i === j); b.setAttribute('aria-selected', String(i === j)); });
        panel.innerHTML = items[i]?.content || '';
        tr.visit(i);
      };
      items.forEach((it: any, i: number) => {
        const b = h('button', { type: 'button', role: 'tab' }, it.title);
        b.addEventListener('click', () => select(i));
        nav.appendChild(b);
      });
      if (items.length) select(0);
      return h('div', { class: `ema-tabs ema-tabs-${c.props.variant || 'underline'}` }, nav, panel);
    },
  },
  {
    type: 'hotspots',
    label: 'Hotspots',
    category: 'interactive',
    icon: 'locate-fixed',
    defaultSize: { w: 800, h: 450 },
    defaultProps: () => ({
      image: '',
      spots: [
        { x: 25, y: 30, title: 'Punto 1', content: 'Descripción del primer punto.' },
        { x: 65, y: 60, title: 'Punto 2', content: 'Descripción del segundo punto.' },
      ],
    }),
    fields: [
      { key: 'image', label: 'Imagen base', type: 'media', accept: 'image' },
      {
        key: 'spots', label: 'Puntos', type: 'list', itemLabel: 'title',
        itemFields: [
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'content', label: 'Descripción', type: 'textarea' },
          { key: 'x', label: 'Posición X (%)', type: 'number', min: 0, max: 100 },
          { key: 'y', label: 'Posición Y (%)', type: 'number', min: 0, max: 100 },
        ],
        newItem: () => ({ x: 50, y: 50, title: 'Nuevo punto', content: 'Descripción' }),
      },
    ],
    flow: 'ratio',
    trackable: true,
    render(c, ctx) {
      const spots = c.props.spots || [];
      const tr = visitTracker(c, ctx, spots.length);
      const outer = h('div', { class: 'ema-hotspots-outer' });
      const root = h('div', { class: 'ema-hotspots' });
      outer.appendChild(root);
      const himg = c.props.image ? (h('img', { src: ctx.asset(c.props.image), alt: '' }) as HTMLImageElement) : null;
      if (himg) root.appendChild(himg);
      else root.appendChild(h('div', { class: 'ema-placeholder' }, icon('pin', 36), h('span', null, 'Imagen base')));
      fitLayer(outer, root, himg);
      const pop = h('div', { class: 'ema-hotspot-pop', hidden: true });
      spots.forEach((s: any, i: number) => {
        const b = h('button', { type: 'button', class: 'ema-hotspot' + (tr.seen.has(i) ? ' is-seen' : ''), style: { left: `${s.x}%`, top: `${s.y}%` }, 'aria-label': s.title }, String(i + 1));
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          pop.hidden = false;
          pop.innerHTML = '';
          pop.append(h('button', { type: 'button', class: 'ema-pop-close', 'aria-label': 'Cerrar', onclick: () => (pop.hidden = true) }, icon('x', 16)), h('strong', null, s.title), h('p', null, s.content));
          pop.style.left = `${Math.min(Math.max(s.x, 18), 82)}%`;
          pop.style.top = `${s.y > 55 ? s.y - 4 : s.y + 6}%`;
          pop.classList.toggle('is-above', s.y > 55);
          b.classList.add('is-seen');
          tr.visit(i);
        });
        root.appendChild(b);
      });
      root.appendChild(pop);
      return outer;
    },
  },
  {
    type: 'timeline',
    label: 'Línea de tiempo',
    category: 'interactive',
    icon: 'git-commit-horizontal',
    defaultSize: { w: 1000, h: 300 },
    defaultProps: () => ({
      orientation: 'horizontal',
      interactive: true,
      items: [
        { date: '1985', title: 'Excel 1.0', content: 'Primera versión para Macintosh.' },
        { date: '1987', title: 'Excel 2.0', content: 'Primera versión para Windows.' },
        { date: '2007', title: 'Cinta de opciones', content: 'Nueva interfaz con Ribbon.' },
        { date: 'Hoy', title: 'Microsoft 365', content: 'Colaboración en la nube.' },
      ],
    }),
    fields: [
      { key: 'orientation', label: 'Orientación', type: 'select', options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] },
      { key: 'interactive', label: 'Revelar contenido al hacer clic', type: 'boolean' },
      {
        key: 'items', label: 'Hitos', type: 'list', itemLabel: 'title',
        itemFields: [{ key: 'date', label: 'Fecha / etapa', type: 'text' }, { key: 'title', label: 'Título', type: 'text' }, { key: 'content', label: 'Descripción', type: 'textarea' }],
        newItem: () => ({ date: '2025', title: 'Nuevo hito', content: 'Descripción' }),
      },
    ],
    flow: 'auto',
    trackable: (c) => !!c.props.interactive,
    render(c, ctx) {
      const items = c.props.items || [];
      const interactive = !!c.props.interactive;
      const tr = visitTracker(c, ctx, items.length);
      if (!interactive && ctx.mode === 'play') setTimeout(() => ctx.markComplete(c.id), 0);
      const root = h('div', { class: `ema-timeline ema-timeline-${c.props.orientation || 'horizontal'}` });
      const detail = h('div', { class: 'ema-timeline-detail' });
      items.forEach((it: any, i: number) => {
        const node = h('button', { type: 'button', class: 'ema-tl-item' + (tr.seen.has(i) || !interactive ? ' is-seen' : '') }, h('span', { class: 'ema-tl-dot' }), h('span', { class: 'ema-tl-date' }, it.date), h('span', { class: 'ema-tl-title' }, it.title), !interactive || c.props.orientation === 'vertical' ? h('span', { class: 'ema-tl-content' }, it.content) : null);
        if (interactive) {
          node.addEventListener('click', () => {
            root.querySelectorAll('.ema-tl-item').forEach((n) => n.classList.remove('is-active'));
            node.classList.add('is-active', 'is-seen');
            if (c.props.orientation !== 'vertical') { detail.innerHTML = ''; detail.append(h('strong', null, `${it.date} · ${it.title}`), h('p', null, it.content)); }
            tr.visit(i);
          });
        } else node.setAttribute('tabindex', '-1');
        root.appendChild(node);
      });
      const wrap = h('div', { class: 'ema-timeline-wrap' }, root);
      if (interactive && c.props.orientation !== 'vertical') {
        detail.append(h('p', { class: 'ema-muted' }, 'Hacé clic en cada hito para ver el detalle.'));
        wrap.appendChild(detail);
      }
      return wrap;
    },
  },
  {
    type: 'flipcards',
    label: 'Flip cards',
    category: 'interactive',
    icon: 'rotate-3d',
    defaultSize: { w: 900, h: 260 },
    defaultProps: () => ({
      columns: 3,
      cards: [
        { front: 'Ctrl + C', frontImage: '', back: 'Copiar la selección' },
        { front: 'Ctrl + V', frontImage: '', back: 'Pegar' },
        { front: 'Ctrl + Z', frontImage: '', back: 'Deshacer la última acción' },
      ],
    }),
    fields: [
      { key: 'columns', label: 'Columnas', type: 'number', min: 1, max: 6 },
      {
        key: 'cards', label: 'Tarjetas', type: 'list', itemLabel: 'front',
        itemFields: [{ key: 'front', label: 'Frente', type: 'text' }, { key: 'frontImage', label: 'Imagen de frente', type: 'media', accept: 'image' }, { key: 'back', label: 'Dorso', type: 'textarea' }],
        newItem: () => ({ front: 'Frente', frontImage: '', back: 'Dorso' }),
      },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const cards = c.props.cards || [];
      const tr = visitTracker(c, ctx, cards.length);
      return h(
        'div',
        { class: 'ema-flipcards', style: { gridTemplateColumns: `repeat(${c.props.columns || 3}, 1fr)` } },
        cards.map((card: any, i: number) => {
          const el = h(
            'button',
            { type: 'button', class: 'ema-flip', 'aria-label': 'Girar tarjeta' },
            h('span', { class: 'ema-flip-inner' },
              h('span', { class: 'ema-flip-front' }, card.frontImage ? h('img', { src: ctx.asset(card.frontImage), alt: '' }) : null, h('span', null, card.front), h('small', null, icon('retry', 14), ' Girar')),
              h('span', { class: 'ema-flip-back' }, h('span', null, card.back)))
          );
          el.addEventListener('click', () => { el.classList.toggle('is-flipped'); tr.visit(i); });
          return el;
        })
      );
    },
  },
  {
    type: 'carousel',
    label: 'Carrusel',
    category: 'interactive',
    icon: 'gallery-horizontal',
    defaultSize: { w: 820, h: 440 },
    defaultProps: () => ({
      autoplay: false,
      interval: 5,
      slides: [
        { image: '', title: 'Diapositiva 1', text: 'Texto de la diapositiva.' },
        { image: '', title: 'Diapositiva 2', text: 'Texto de la diapositiva.' },
        { image: '', title: 'Diapositiva 3', text: 'Texto de la diapositiva.' },
      ],
    }),
    fields: [
      { key: 'autoplay', label: 'Avance automático', type: 'boolean' },
      { key: 'interval', label: 'Segundos por diapositiva', type: 'number', min: 2, max: 30 },
      {
        key: 'slides', label: 'Diapositivas', type: 'list', itemLabel: 'title',
        itemFields: [{ key: 'image', label: 'Imagen', type: 'media', accept: 'image' }, { key: 'title', label: 'Título', type: 'text' }, { key: 'text', label: 'Texto', type: 'textarea' }],
        newItem: () => ({ image: '', title: 'Nueva diapositiva', text: '' }),
      },
    ],
    flow: 'ratio',
    trackable: true,
    render(c, ctx) {
      const slides = c.props.slides || [];
      const tr = visitTracker(c, ctx, slides.length);
      let idx = 0;
      const track = h('div', { class: 'ema-car-track' },
        slides.map((s: any) => h('div', { class: 'ema-car-slide' },
          s.image ? h('img', { src: ctx.asset(s.image), alt: '', loading: 'lazy' }) : h('div', { class: 'ema-car-noimg' }),
          s.title || s.text ? h('div', { class: 'ema-car-caption' }, s.title ? h('strong', null, s.title) : null, s.text ? h('p', null, s.text) : null) : null)));
      const dots = h('div', { class: 'ema-car-dots' });
      const go = (i: number) => {
        idx = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${idx * 100}%)`;
        dots.querySelectorAll('button').forEach((d, j) => d.classList.toggle('is-active', j === idx));
        tr.visit(idx);
      };
      slides.forEach((_: any, i: number) => dots.appendChild(h('button', { type: 'button', 'aria-label': `Ir a ${i + 1}`, onclick: () => go(i) })));
      const root = h('div', { class: 'ema-carousel' }, h('div', { class: 'ema-car-viewport' }, track),
        h('button', { type: 'button', class: 'ema-car-prev', 'aria-label': 'Anterior', onclick: () => go(idx - 1) }, icon('chevron-left', 22)),
        h('button', { type: 'button', class: 'ema-car-next', 'aria-label': 'Siguiente', onclick: () => go(idx + 1) }, icon('chevron-right', 22)),
        dots);
      if (slides.length) go(0);
      if (c.props.autoplay && ctx.mode === 'play' && slides.length > 1) {
        const t = setInterval(() => { if (!root.isConnected) clearInterval(t); else go(idx + 1); }, Math.max(2, c.props.interval || 5) * 1000);
      }
      return root;
    },
  },
  {
    type: 'interactiveImage',
    label: 'Imagen interactiva',
    category: 'interactive',
    icon: 'scan-search',
    defaultSize: { w: 1000, h: 450 },
    defaultProps: () => ({
      image: '',
      markers: [
        { x: 20, y: 25, label: 'A', title: 'Barra de fórmulas', content: '<p>Muestra el contenido de la celda activa.</p>' },
        { x: 55, y: 55, label: 'B', title: 'Celda activa', content: '<p>La celda seleccionada, resaltada con borde verde.</p>' },
      ],
    }),
    fields: [
      { key: 'image', label: 'Imagen', type: 'media', accept: 'image' },
      {
        key: 'markers', label: 'Marcadores', type: 'list', itemLabel: 'title',
        itemFields: [
          { key: 'label', label: 'Etiqueta (1-2 caracteres)', type: 'text' },
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'content', label: 'Contenido', type: 'richtext' },
          { key: 'x', label: 'X (%)', type: 'number', min: 0, max: 100 },
          { key: 'y', label: 'Y (%)', type: 'number', min: 0, max: 100 },
        ],
        newItem: () => ({ x: 50, y: 50, label: '+', title: 'Nuevo marcador', content: '<p>Contenido</p>' }),
      },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const markers = c.props.markers || [];
      const tr = visitTracker(c, ctx, markers.length);
      const panel = h('div', { class: 'ema-ii-panel' }, h('p', { class: 'ema-muted' }, 'Seleccioná un marcador de la imagen para ver su descripción.'));
      const iimg = c.props.image ? (h('img', { src: ctx.asset(c.props.image), alt: '' }) as HTMLImageElement) : null;
      const stage = h('div', { class: 'ema-ii-layer' }, iimg || h('div', { class: 'ema-placeholder' }, icon('search', 36), h('span', null, 'Imagen')));
      const stageOuter = h('div', { class: 'ema-ii-stage' }, stage);
      fitLayer(stageOuter, stage, iimg);
      markers.forEach((m: any, i: number) => {
        const b = h('button', { type: 'button', class: 'ema-ii-marker' + (tr.seen.has(i) ? ' is-seen' : ''), style: { left: `${m.x}%`, top: `${m.y}%` } }, m.label || String(i + 1));
        b.addEventListener('click', () => {
          stage.querySelectorAll('.ema-ii-marker').forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active', 'is-seen');
          panel.innerHTML = '';
          panel.append(h('h3', null, m.title), h('div', { html: m.content || '' }));
          tr.visit(i);
        });
        stage.appendChild(b);
      });
      return h('div', { class: 'ema-ii' }, stageOuter, panel);
    },
  },
  {
    type: 'tooltip',
    label: 'Tooltip',
    category: 'interactive',
    icon: 'message-square-more',
    defaultSize: { w: 420, h: 50 },
    defaultProps: () => ({ text: 'Pasá el cursor sobre la palabra', term: 'celda', tip: 'Intersección entre una fila y una columna.' }),
    defaultStyle: () => ({ fontSize: 18 }),
    fields: [
      { key: 'text', label: 'Texto previo', type: 'text' },
      { key: 'term', label: 'Término con tooltip', type: 'text' },
      { key: 'tip', label: 'Texto del tooltip', type: 'textarea' },
    ],
    flow: 'auto',
    render(c, ctx) {
      const tip = h('span', { class: 'ema-tip-bubble', role: 'tooltip' }, c.props.tip || '');
      const term = h('button', { type: 'button', class: 'ema-tip-term' }, c.props.term || '', icon('info', 14), tip);
      term.addEventListener('click', () => term.classList.toggle('is-open'));
      term.addEventListener('mouseenter', () => ctx.markComplete(c.id));
      return h('p', { class: 'ema-tooltip' }, c.props.text ? c.props.text + ' ' : '', term);
    },
  },
  {
    type: 'modal',
    label: 'Ventana modal',
    category: 'interactive',
    icon: 'app-window',
    defaultSize: { w: 260, h: 52 },
    defaultProps: () => ({ buttonText: 'Ver más información', variant: 'outline', title: 'Información adicional', content: '<p>Contenido de la ventana modal.</p>', size: 'md' }),
    fields: [
      { key: 'buttonText', label: 'Texto del botón', type: 'text' },
      { key: 'variant', label: 'Estilo del botón', type: 'select', options: variantOptions },
      { key: 'title', label: 'Título de la ventana', type: 'text' },
      { key: 'content', label: 'Contenido', type: 'richtext' },
      { key: 'size', label: 'Tamaño', type: 'select', options: [{ value: 'sm', label: 'Chico' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }] },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const b = h('button', { type: 'button', class: `ema-btn ema-btn-${c.props.variant || 'outline'} ema-btn-block` }, icon('maximize', 16), h('span', null, c.props.buttonText || 'Abrir'));
      b.addEventListener('click', () => {
        ctx.openDialog({ title: c.props.title, html: c.props.content, size: c.props.size });
        ctx.markComplete(c.id);
      });
      return b;
    },
  },
  {
    type: 'reveal',
    label: 'Mostrar/ocultar',
    category: 'interactive',
    icon: 'eye',
    defaultSize: { w: 700, h: 200 },
    defaultProps: () => ({ buttonText: 'Mostrar respuesta', hideText: 'Ocultar', content: '<p>Contenido oculto que se revela al hacer clic.</p>', open: false }),
    fields: [
      { key: 'buttonText', label: 'Texto para mostrar', type: 'text' },
      { key: 'hideText', label: 'Texto para ocultar', type: 'text' },
      { key: 'content', label: 'Contenido', type: 'richtext' },
      { key: 'open', label: 'Visible al inicio', type: 'boolean' },
    ],
    flow: 'auto',
    trackable: true,
    render(c, ctx) {
      const body = h('div', { class: 'ema-reveal-body', html: c.props.content || '' });
      const label = h('span', null, '');
      const btn = h('button', { type: 'button', class: 'ema-btn ema-btn-secondary' }, icon('eye', 16), label);
      const root = h('div', { class: 'ema-reveal' }, btn, body);
      const set = (open: boolean) => {
        root.classList.toggle('is-open', open);
        label.textContent = open ? c.props.hideText || 'Ocultar' : c.props.buttonText || 'Mostrar';
        if (open) ctx.markComplete(c.id);
      };
      set(!!c.props.open || ctx.mode === 'edit');
      btn.addEventListener('click', () => set(!root.classList.contains('is-open')));
      return root;
    },
  },
];

export { iconOptions };
