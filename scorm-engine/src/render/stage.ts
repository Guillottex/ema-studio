import { STAGE_WIDTH, type Breakpoint, type Box, type ComponentData, type ComponentStyle, type ScreenData, type AnimationConfig } from '../types';
import { getDef } from '../registry';
import type { RenderCtx } from '../registry/types';
import { fontStack, shadowCss } from '../themes';
import { h } from './dom';

/** Breakpoint según el ancho de la ventana (igual criterio en el player y el editor) */
export function breakpointFor(width: number): Breakpoint {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** Altura de diseño de la pantalla para un breakpoint con layout personalizado */
export function stageHeight(screen: ScreenData, bp: Breakpoint): number {
  if (bp === 'desktop') return screen.height;
  const boxes = screen.components.map((c) => c.layout[bp]).filter(Boolean) as Box[];
  const fromBoxes = boxes.length ? Math.max(...boxes.filter((b) => !b.hidden).map((b) => b.y + b.h)) + 40 : 0;
  const scaled = Math.round(screen.height * (STAGE_WIDTH[bp] / STAGE_WIDTH.desktop));
  return Math.max(fromBoxes, bp === 'mobile' ? 300 : scaled);
}

export type StageMode = { kind: 'abs'; layoutBp: Breakpoint; designWidth: number } | { kind: 'flow' };

/**
 * Decide cómo se dibuja una pantalla:
 * - desktop: posiciones absolutas de diseño (1200px) escaladas al ancho disponible
 * - tablet: layout tablet si fue personalizado; si no, el de desktop escalado (o flujo si queda demasiado chico)
 * - mobile: layout móvil si fue personalizado; si no, flujo vertical automático
 */
export function stageMode(screen: ScreenData, bp: Breakpoint, availableWidth: number): StageMode {
  if (bp === 'mobile') {
    return screen.mobileMode === 'custom' ? { kind: 'abs', layoutBp: 'mobile', designWidth: STAGE_WIDTH.mobile } : { kind: 'flow' };
  }
  if (bp === 'tablet' && screen.tabletMode === 'custom') return { kind: 'abs', layoutBp: 'tablet', designWidth: STAGE_WIDTH.tablet };
  if (availableWidth / STAGE_WIDTH.desktop < 0.55) return { kind: 'flow' };
  return { kind: 'abs', layoutBp: 'desktop', designWidth: STAGE_WIDTH.desktop };
}

export function boxFor(c: ComponentData, bp: Breakpoint): Box {
  return (bp !== 'desktop' && c.layout[bp]) || c.layout.desktop;
}

/** Orden de lectura para el modo flujo: filas (por y) y dentro de cada fila por x */
export function flowOrder(components: ComponentData[]): ComponentData[] {
  const items = components.slice().sort((a, b) => a.layout.desktop.y - b.layout.desktop.y || a.layout.desktop.x - b.layout.desktop.x);
  const rows: ComponentData[][] = [];
  for (const c of items) {
    const d = c.layout.desktop;
    const row = rows.find((r) => {
      const f = r[0].layout.desktop;
      const overlap = Math.min(f.y + f.h, d.y + d.h) - Math.max(f.y, d.y);
      return overlap > Math.min(f.h, d.h) * 0.5;
    });
    if (row) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.layout.desktop.x - b.layout.desktop.x));
}

/** Componentes que en modo flujo actúan como fondo (cubren casi toda la pantalla) */
export function isBackdrop(c: ComponentData, screen: ScreenData): boolean {
  const d = c.layout.desktop;
  return (c.type === 'background' || c.type === 'shape') && d.w >= STAGE_WIDTH.desktop * 0.9 && d.h >= screen.height * 0.8;
}

export function innerStyle(style: ComponentStyle): Partial<CSSStyleDeclaration> {
  const s: Record<string, string> = {};
  if (style.fontFamily) s.fontFamily = fontStack(style.fontFamily)!;
  if (style.fontSize) s.fontSize = style.fontSize + 'px';
  if (style.fontWeight) s.fontWeight = String(style.fontWeight);
  if (style.fontStyle) s.fontStyle = style.fontStyle;
  if (style.lineHeight) s.lineHeight = String(style.lineHeight);
  if (style.color) s.color = style.color;
  if (style.background) s.background = style.background;
  if (style.textAlign) s.textAlign = style.textAlign;
  if (style.padding) s.padding = style.padding + 'px';
  if (style.borderRadius) s.borderRadius = style.borderRadius + 'px';
  if (style.borderWidth) s.border = `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || 'var(--ema-border)'}`;
  if (style.shadow && style.shadow !== 'none') s.boxShadow = shadowCss(style.shadow);
  if (style.verticalAlign) s.justifyContent = style.verticalAlign === 'middle' ? 'center' : style.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';
  if (style.margin) s.inset = style.margin + 'px';
  return s as any;
}

export function outerStyle(style: ComponentStyle): Record<string, string> {
  const s: Record<string, string> = {};
  if (style.opacity !== undefined && style.opacity !== null && style.opacity < 1) s.opacity = String(style.opacity);
  if (style.rotation) s.transform = `rotate(${style.rotation}deg)`;
  return s;
}

/** Contenido del componente envuelto en .ema-comp-inner (lo usan editor y player) */
export function renderInner(c: ComponentData, ctx: RenderCtx): HTMLElement {
  const def = getDef(c.type);
  const inner = h('div', { class: 'ema-comp-inner' });
  Object.assign(inner.style, innerStyle(c.style || {}));
  if (c.style?.background || c.style?.borderWidth || (c.style?.shadow && c.style.shadow !== 'none')) inner.classList.add('has-surface');
  if (!def) {
    inner.appendChild(h('div', { class: 'ema-placeholder' }, `Componente desconocido: ${c.type}`));
    return inner;
  }
  try {
    inner.appendChild(def.render(c, ctx));
  } catch (err) {
    console.error('[EMA] Error al dibujar componente', c.type, err);
    inner.appendChild(h('div', { class: 'ema-placeholder' }, 'Error al mostrar el componente'));
  }
  return inner;
}

export function animationClasses(a?: AnimationConfig): { cls: string[]; vars: Record<string, string> } {
  if (!a || a.type === 'none') return { cls: [], vars: {} };
  const type = a.type === 'scroll' ? 'slide' : a.type;
  return {
    cls: ['ema-anim', `ema-anim-${type}`, `ema-dir-${a.direction || 'up'}`, `ema-trig-${a.type === 'scroll' ? 'scroll' : a.trigger || 'load'}`],
    vars: { '--ema-anim-dur': `${a.duration || 600}ms`, '--ema-anim-delay': `${a.delay || 0}ms` },
  };
}

/** Tamaño de fuente efectivo en tablet/celular (reduce títulos grandes para pantallas chicas) */
export function responsiveFontSize(c: ComponentData, bp: Breakpoint): number | null {
  if (bp === 'desktop') return null;
  const fs = c.style?.fontSize || (c.type === 'heading' ? 40 : c.type === 'subheading' ? 26 : 0);
  if (fs <= 18) return null;
  return Math.round(18 + (fs - 18) * (bp === 'mobile' ? 0.45 : 0.7));
}
