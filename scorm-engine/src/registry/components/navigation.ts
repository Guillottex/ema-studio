import { h } from '../../render/dom';
import { icon } from '../../render/icons';
import type { ComponentDef } from '../types';
import { variantOptions } from './visual';

const TARGETS = [
  { value: 'next', label: 'Siguiente pantalla' },
  { value: 'prev', label: 'Pantalla anterior' },
  { value: 'home', label: 'Inicio del curso' },
  { value: 'screen', label: 'Ir a pantalla / lección / módulo' },
  { value: 'menu', label: 'Abrir menú del curso' },
  { value: 'exit', label: 'Salir del curso' },
];

const DEFAULT_ICON: Record<string, string> = { next: 'chevron-right', prev: 'chevron-left', home: 'home', screen: 'arrow-right', menu: 'menu', exit: 'logout' };

export const navigationComponents: ComponentDef[] = [
  {
    type: 'navButton',
    label: 'Botón de navegación',
    category: 'navigation',
    icon: 'navigation',
    defaultSize: { w: 200, h: 52 },
    defaultProps: () => ({ text: 'Siguiente', target: 'next', targetId: '', variant: 'primary' }),
    fields: [
      { key: 'text', label: 'Texto', type: 'text' },
      { key: 'target', label: 'Acción', type: 'select', options: TARGETS },
      { key: 'targetId', label: 'Destino', type: 'screen', showIf: (p) => p.target === 'screen' },
      { key: 'variant', label: 'Estilo', type: 'select', options: variantOptions },
    ],
    inline: 'text',
    flow: 'auto',
    render(c, ctx) {
      const target = c.props.target || 'next';
      const ic = icon(DEFAULT_ICON[target] || 'arrow-right', 18);
      const right = target !== 'prev' && target !== 'home';
      const btn = h('button', { type: 'button', class: `ema-btn ema-btn-${c.props.variant || 'primary'} ema-btn-block`, 'data-nav': target }, !right ? ic : null, h('span', { 'data-inline': 'text' }, c.props.text || ''), right ? ic : null);
      if (ctx.mode === 'play') btn.addEventListener('click', () => ctx.navigate(target, c.props.targetId));
      return btn;
    },
  },
];

export const NAV_TARGETS = TARGETS;
