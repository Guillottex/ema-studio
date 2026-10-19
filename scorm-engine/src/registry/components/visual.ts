import { h } from '../../render/dom';
import { icon, ICON_NAMES } from '../../render/icons';
import type { ComponentDef } from '../types';

const iconOptions = ICON_NAMES.map((n) => ({ value: n, label: n }));
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgShape(shape: string, fill: string, stroke: string, sw: number): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'ema-shape-svg');
  let el: SVGElement;
  const s = sw / 2;
  switch (shape) {
    case 'circle':
      el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', '50'); el.setAttribute('cy', '50'); el.setAttribute('rx', String(50 - s)); el.setAttribute('ry', String(50 - s));
      break;
    case 'triangle':
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', `50,${s} ${100 - s},${100 - s} ${s},${100 - s}`);
      break;
    case 'diamond':
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', `50,${s} ${100 - s},50 50,${100 - s} ${s},50`);
      break;
    case 'arrow':
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', `${s},30 62,30 62,${s} ${100 - s},50 62,${100 - s} 62,70 ${s},70`);
      break;
    case 'star':
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', '50,3 61,38 98,38 68,60 79,95 50,73 21,95 32,60 2,38 39,38');
      break;
    default:
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', String(s)); el.setAttribute('y', String(s)); el.setAttribute('width', String(100 - sw)); el.setAttribute('height', String(100 - sw));
  }
  el.setAttribute('fill', fill || 'transparent');
  el.setAttribute('stroke', stroke || 'none');
  el.setAttribute('stroke-width', String(sw || 0));
  el.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(el);
  return svg;
}

export const variantOptions = [
  { value: 'primary', label: 'Primario' },
  { value: 'secondary', label: 'Secundario' },
  { value: 'outline', label: 'Contorno' },
  { value: 'ghost', label: 'Texto' },
];

export const visualComponents: ComponentDef[] = [
  {
    type: 'line',
    label: 'Línea',
    category: 'visual',
    icon: 'minus',
    defaultSize: { w: 600, h: 12 },
    defaultProps: () => ({ orientation: 'horizontal', thickness: 3, color: '', lineStyle: 'solid' }),
    fields: [
      { key: 'orientation', label: 'Orientación', type: 'select', options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] },
      { key: 'thickness', label: 'Grosor', type: 'number', min: 1, max: 30 },
      { key: 'color', label: 'Color (vacío = primario)', type: 'color' },
      { key: 'lineStyle', label: 'Trazo', type: 'select', options: [{ value: 'solid', label: 'Continuo' }, { value: 'dashed', label: 'Guiones' }, { value: 'dotted', label: 'Puntos' }] },
    ],
    flow: 'fixed',
    render(c) {
      const vertical = c.props.orientation === 'vertical';
      const border = `${c.props.thickness || 2}px ${c.props.lineStyle || 'solid'} ${c.props.color || 'var(--ema-primary)'}`;
      return h('div', { class: 'ema-line' + (vertical ? ' is-vertical' : '') }, h('div', { style: vertical ? { borderLeft: border, height: '100%' } : { borderTop: border, width: '100%' } }));
    },
  },
  {
    type: 'divider',
    label: 'Separador',
    category: 'visual',
    icon: 'separator-horizontal',
    defaultSize: { w: 800, h: 40 },
    defaultProps: () => ({ label: '', variant: 'line' }),
    fields: [
      { key: 'label', label: 'Texto central (opcional)', type: 'text' },
      { key: 'variant', label: 'Estilo', type: 'select', options: [{ value: 'line', label: 'Línea' }, { value: 'dots', label: 'Puntos' }, { value: 'gradient', label: 'Degradé' }] },
    ],
    flow: 'fixed',
    render(c) {
      return h('div', { class: `ema-divider ema-divider-${c.props.variant || 'line'}` }, h('span', { class: 'ema-divider-line' }), c.props.label ? h('span', { class: 'ema-divider-label' }, c.props.label) : null, c.props.label ? h('span', { class: 'ema-divider-line' }) : null);
    },
  },
  {
    type: 'icon',
    label: 'Ícono',
    category: 'visual',
    icon: 'smile',
    defaultSize: { w: 80, h: 80 },
    defaultProps: () => ({ icon: 'lightbulb', color: '', bg: true }),
    fields: [
      { key: 'icon', label: 'Ícono', type: 'icon', options: iconOptions },
      { key: 'color', label: 'Color (vacío = primario)', type: 'color' },
      { key: 'bg', label: 'Fondo circular', type: 'boolean' },
    ],
    flow: 'fixed',
    clickable: true,
    render(c) {
      const el = h('div', { class: 'ema-icon-box' + (c.props.bg ? ' has-bg' : ''), style: { color: c.props.color || 'var(--ema-primary)' } });
      const svg = icon(c.props.icon || 'info', 24);
      svg.setAttribute('width', '60%');
      svg.setAttribute('height', '60%');
      el.appendChild(svg);
      return el;
    },
  },
  {
    type: 'shape',
    label: 'Forma',
    category: 'visual',
    icon: 'shapes',
    defaultSize: { w: 200, h: 200 },
    defaultProps: () => ({ shape: 'rect', fill: '', stroke: '', strokeWidth: 0, text: '' }),
    fields: [
      { key: 'shape', label: 'Forma', type: 'select', options: [
        { value: 'rect', label: 'Rectángulo' }, { value: 'circle', label: 'Círculo / elipse' }, { value: 'triangle', label: 'Triángulo' },
        { value: 'diamond', label: 'Rombo' }, { value: 'arrow', label: 'Flecha' }, { value: 'star', label: 'Estrella' }] },
      { key: 'fill', label: 'Relleno (vacío = primario)', type: 'color' },
      { key: 'stroke', label: 'Borde', type: 'color' },
      { key: 'strokeWidth', label: 'Grosor de borde', type: 'number', min: 0, max: 20 },
      { key: 'text', label: 'Texto interior', type: 'text' },
    ],
    flow: 'ratio',
    clickable: true,
    render(c) {
      const fill = c.props.fill || 'var(--ema-primary)';
      const wrap = h('div', { class: 'ema-shape' });
      const svg = svgShape(c.props.shape, '', c.props.stroke, c.props.strokeWidth || 0);
      (svg.firstChild as SVGElement).setAttribute('style', `fill:${fill}`);
      wrap.appendChild(svg);
      if (c.props.text) wrap.appendChild(h('span', { class: 'ema-shape-text' }, c.props.text));
      return wrap;
    },
  },
  {
    type: 'background',
    label: 'Fondo',
    category: 'visual',
    icon: 'wallpaper',
    defaultSize: { w: 1200, h: 675 },
    defaultProps: () => ({ color: '', image: '', overlay: 'rgba(0,0,0,0.35)', gradient: false }),
    fields: [
      { key: 'image', label: 'Imagen de fondo', type: 'media', accept: 'image' },
      { key: 'color', label: 'Color (vacío = primario)', type: 'color' },
      { key: 'gradient', label: 'Degradé primario → secundario', type: 'boolean' },
      { key: 'overlay', label: 'Capa superpuesta (rgba)', type: 'text', placeholder: 'rgba(0,0,0,0.35)' },
    ],
    flow: 'ratio',
    render(c, ctx) {
      const bg: Record<string, string> = {};
      if (c.props.gradient) bg.backgroundImage = 'linear-gradient(135deg, var(--ema-primary), var(--ema-secondary))';
      else bg.backgroundColor = c.props.color || 'var(--ema-primary)';
      if (c.props.image) {
        bg.backgroundImage = `url("${ctx.asset(c.props.image)}")`;
        bg.backgroundSize = 'cover';
        bg.backgroundPosition = 'center';
      }
      return h('div', { class: 'ema-background', style: bg }, c.props.image && c.props.overlay ? h('div', { class: 'ema-overlay', style: { background: c.props.overlay } }) : null);
    },
  },
  {
    type: 'button',
    label: 'Botón',
    category: 'visual',
    icon: 'mouse-pointer-click',
    defaultSize: { w: 220, h: 52 },
    defaultProps: () => ({ text: 'Botón', variant: 'primary', icon: '', iconRight: false }),
    fields: [
      { key: 'text', label: 'Texto', type: 'text' },
      { key: 'variant', label: 'Estilo', type: 'select', options: variantOptions },
      { key: 'icon', label: 'Ícono', type: 'icon', options: [{ value: '', label: '(ninguno)' }, ...iconOptions] },
      { key: 'iconRight', label: 'Ícono a la derecha', type: 'boolean' },
    ],
    inline: 'text',
    flow: 'auto',
    clickable: true,
    render(c) {
      const ic = c.props.icon ? icon(c.props.icon, 18) : null;
      return h('button', { type: 'button', class: `ema-btn ema-btn-${c.props.variant || 'primary'} ema-btn-block` }, !c.props.iconRight ? ic : null, h('span', { 'data-inline': 'text' }, c.props.text || ''), c.props.iconRight ? ic : null);
    },
  },
  {
    type: 'banner',
    label: 'Banner',
    category: 'visual',
    icon: 'panel-top',
    defaultSize: { w: 900, h: 120 },
    defaultProps: () => ({ title: 'Importante', text: 'Recordá guardar tu trabajo con frecuencia.', icon: 'info', variant: 'info' }),
    fields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'icon', label: 'Ícono', type: 'icon', options: iconOptions },
      { key: 'variant', label: 'Tipo', type: 'select', options: [
        { value: 'info', label: 'Información' }, { value: 'success', label: 'Éxito' }, { value: 'warning', label: 'Advertencia' },
        { value: 'danger', label: 'Peligro' }, { value: 'primary', label: 'Destacado' }] },
    ],
    flow: 'auto',
    clickable: true,
    render(c) {
      return h('div', { class: `ema-banner ema-banner-${c.props.variant || 'info'}` }, h('div', { class: 'ema-banner-icon' }, icon(c.props.icon || 'info', 26)), h('div', null, c.props.title ? h('strong', null, c.props.title) : null, h('p', null, c.props.text || '')));
    },
  },
  {
    type: 'card',
    label: 'Tarjeta',
    category: 'visual',
    icon: 'square-stack',
    defaultSize: { w: 340, h: 360 },
    defaultProps: () => ({ image: '', icon: '', title: 'Título de tarjeta', text: 'Descripción breve del contenido de la tarjeta.', buttonText: '' }),
    fields: [
      { key: 'image', label: 'Imagen', type: 'media', accept: 'image' },
      { key: 'icon', label: 'Ícono (si no hay imagen)', type: 'icon', options: [{ value: '', label: '(ninguno)' }, ...iconOptions] },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'buttonText', label: 'Texto de botón (usa los eventos del componente)', type: 'text' },
    ],
    flow: 'auto',
    clickable: true,
    render(c, ctx) {
      return h(
        'div',
        { class: 'ema-card' },
        c.props.image ? h('div', { class: 'ema-card-img' }, h('img', { src: ctx.asset(c.props.image), alt: '', loading: 'lazy' })) : null,
        !c.props.image && c.props.icon ? h('div', { class: 'ema-card-icon' }, icon(c.props.icon, 28)) : null,
        h('div', { class: 'ema-card-body' }, h('h3', null, c.props.title || ''), h('p', null, c.props.text || ''), c.props.buttonText ? h('span', { class: 'ema-btn ema-btn-outline ema-btn-sm' }, c.props.buttonText) : null)
      );
    },
  },
  {
    type: 'badge',
    label: 'Badge',
    category: 'visual',
    icon: 'badge-check',
    defaultSize: { w: 200, h: 44 },
    defaultProps: () => ({ text: 'Nuevo', icon: 'star', color: '' }),
    fields: [
      { key: 'text', label: 'Texto', type: 'text' },
      { key: 'icon', label: 'Ícono', type: 'icon', options: [{ value: '', label: '(ninguno)' }, ...iconOptions] },
      { key: 'color', label: 'Color (vacío = acento)', type: 'color' },
    ],
    flow: 'auto',
    render(c) {
      const color = c.props.color || 'var(--ema-accent)';
      return h('div', { class: 'ema-badge-wrap' }, h('span', { class: 'ema-badge', style: { background: color } }, c.props.icon ? icon(c.props.icon, 16) : null, h('span', null, c.props.text || '')));
    },
  },
];
