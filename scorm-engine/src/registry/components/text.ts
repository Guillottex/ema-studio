import { h } from '../../render/dom';
import { icon } from '../../render/icons';
import type { ComponentDef } from '../types';

const listItemFields = [{ key: 'text', label: 'Texto', type: 'text' as const }];

export const textComponents: ComponentDef[] = [
  {
    type: 'heading',
    label: 'Título',
    category: 'text',
    icon: 'heading-1',
    defaultSize: { w: 900, h: 70 },
    defaultProps: () => ({ text: 'Título de la pantalla' }),
    defaultStyle: () => ({ fontSize: 40 }),
    fields: [{ key: 'text', label: 'Texto', type: 'textarea' }],
    inline: 'text',
    flow: 'auto',
    render(c) {
      return h('h1', { class: 'ema-heading', 'data-inline': 'text' }, c.props.text || '');
    },
  },
  {
    type: 'subheading',
    label: 'Subtítulo',
    category: 'text',
    icon: 'heading-2',
    defaultSize: { w: 800, h: 50 },
    defaultProps: () => ({ text: 'Subtítulo' }),
    defaultStyle: () => ({ fontSize: 26 }),
    fields: [{ key: 'text', label: 'Texto', type: 'textarea' }],
    inline: 'text',
    flow: 'auto',
    render(c) {
      return h('h2', { class: 'ema-subheading', 'data-inline': 'text' }, c.props.text || '');
    },
  },
  {
    type: 'text',
    label: 'Texto',
    category: 'text',
    icon: 'type',
    defaultSize: { w: 600, h: 120 },
    defaultProps: () => ({ text: 'Escribí aquí el contenido del párrafo.' }),
    defaultStyle: () => ({ fontSize: 18 }),
    fields: [{ key: 'text', label: 'Texto', type: 'textarea' }],
    inline: 'text',
    flow: 'auto',
    render(c) {
      return h('p', { class: 'ema-text', 'data-inline': 'text' }, c.props.text || '');
    },
  },
  {
    type: 'richtext',
    label: 'Texto enriquecido',
    category: 'text',
    icon: 'pilcrow',
    defaultSize: { w: 600, h: 180 },
    defaultProps: () => ({
      html: '<p>Texto con <strong>formato</strong>, <em>énfasis</em> y <a href="https://example.com" target="_blank">enlaces</a>.</p>',
    }),
    defaultStyle: () => ({ fontSize: 18 }),
    fields: [{ key: 'html', label: 'Contenido', type: 'richtext' }],
    inline: 'html',
    flow: 'auto',
    render(c) {
      return h('div', { class: 'ema-richtext', 'data-inline': 'html', html: c.props.html || '' });
    },
  },
  {
    type: 'list',
    label: 'Lista',
    category: 'text',
    icon: 'list',
    defaultSize: { w: 560, h: 160 },
    defaultProps: () => ({
      ordered: false,
      marker: 'check',
      items: [{ text: 'Primer punto' }, { text: 'Segundo punto' }, { text: 'Tercer punto' }],
    }),
    defaultStyle: () => ({ fontSize: 18 }),
    fields: [
      { key: 'ordered', label: 'Numerada', type: 'boolean' },
      {
        key: 'marker',
        label: 'Viñeta',
        type: 'select',
        options: [
          { value: 'disc', label: 'Punto' },
          { value: 'check', label: 'Check' },
          { value: 'arrow', label: 'Flecha' },
        ],
        showIf: (p) => !p.ordered,
      },
      { key: 'items', label: 'Elementos', type: 'list', itemFields: listItemFields, itemLabel: 'text', newItem: () => ({ text: 'Nuevo elemento' }) },
    ],
    flow: 'auto',
    render(c) {
      const items = (c.props.items || []) as { text: string }[];
      if (c.props.ordered) {
        return h('ol', { class: 'ema-list ema-list-ordered' }, items.map((it, i) => h('li', null, h('span', { class: 'ema-list-num' }, String(i + 1)), h('span', null, it.text))));
      }
      const marker = c.props.marker || 'disc';
      return h(
        'ul',
        { class: `ema-list ema-list-${marker}` },
        items.map((it) =>
          h('li', null, marker === 'disc' ? h('span', { class: 'ema-list-dot' }) : icon(marker === 'check' ? 'check-circle' : 'chevron-right', 18, 'ema-list-icon'), h('span', null, it.text))
        )
      );
    },
  },
  {
    type: 'quote',
    label: 'Cita',
    category: 'text',
    icon: 'quote',
    defaultSize: { w: 700, h: 150 },
    defaultProps: () => ({ text: 'La mejor forma de aprender es haciendo.', author: 'Autor' }),
    defaultStyle: () => ({ fontSize: 22 }),
    fields: [
      { key: 'text', label: 'Cita', type: 'textarea' },
      { key: 'author', label: 'Autor', type: 'text' },
    ],
    flow: 'auto',
    render(c) {
      return h('blockquote', { class: 'ema-quote' }, h('p', { 'data-inline': 'text' }, c.props.text || ''), c.props.author ? h('cite', null, '— ' + c.props.author) : null);
    },
  },
  {
    type: 'label',
    label: 'Etiqueta',
    category: 'text',
    icon: 'tag',
    defaultSize: { w: 180, h: 36 },
    defaultProps: () => ({ text: 'MÓDULO 1', variant: 'primary' }),
    defaultStyle: () => ({ fontSize: 13 }),
    fields: [
      { key: 'text', label: 'Texto', type: 'text' },
      {
        key: 'variant',
        label: 'Estilo',
        type: 'select',
        options: [
          { value: 'primary', label: 'Primario' },
          { value: 'secondary', label: 'Secundario' },
          { value: 'outline', label: 'Contorno' },
          { value: 'muted', label: 'Neutro' },
        ],
      },
    ],
    inline: 'text',
    flow: 'auto',
    render(c) {
      return h('div', { class: 'ema-label-wrap' }, h('span', { class: `ema-label ema-label-${c.props.variant || 'primary'}`, 'data-inline': 'text' }, c.props.text || ''));
    },
  },
  {
    type: 'table',
    label: 'Tabla',
    category: 'text',
    icon: 'table',
    defaultSize: { w: 760, h: 220 },
    defaultProps: () => ({
      header: true,
      striped: true,
      data: [
        ['Función', 'Descripción', 'Ejemplo'],
        ['SUMA', 'Suma valores', '=SUMA(A1:A5)'],
        ['PROMEDIO', 'Calcula el promedio', '=PROMEDIO(B1:B5)'],
      ],
    }),
    defaultStyle: () => ({ fontSize: 16 }),
    fields: [
      { key: 'header', label: 'Primera fila como encabezado', type: 'boolean' },
      { key: 'striped', label: 'Filas alternadas', type: 'boolean' },
      { key: 'data', label: 'Celdas', type: 'table' },
    ],
    flow: 'auto',
    render(c) {
      const data: string[][] = c.props.data || [];
      const [first, ...rest] = data;
      const head = c.props.header && first ? h('thead', null, h('tr', null, first.map((cell) => h('th', null, cell)))) : null;
      const rows = c.props.header ? rest : data;
      return h(
        'div',
        { class: 'ema-table-wrap' },
        h('table', { class: 'ema-table' + (c.props.striped ? ' ema-table-striped' : '') }, head, h('tbody', null, rows.map((r) => h('tr', null, r.map((cell) => h('td', null, cell))))))
      );
    },
  },
];
