import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Smartphone, Tablet, Wand2, RotateCcw, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, Lock, Unlock, Scissors, ClipboardPaste, Pencil } from 'lucide-react';
import {
  renderInner, outerStyle, applyThemeVars, responsiveFontSize, createComponent, getDef, flowOrder, isBackdrop, STAGE_WIDTH, paletteItems,
  type ComponentData, type RenderCtx, type ScreenData, type Theme, type Breakpoint, type Box,
} from '@engine';
import { assetUrl } from '../lib/api';
import { confirmDialog, useMenu } from '../components/ui';
import { sanitize } from './fields/RichTextEditor';
import {
  useEditor, mutate, beginGesture, select, setBoxes, boxOf, editableBp, stageSize, addComponent, updateComponent,
  duplicateSelected, deleteSelected, copySelected, paste, reorder,
} from './store';

/* ------------------------------ contexto de dibujo ------------------------------ */

function makeCtx(theme: Theme, screen: ScreenData): RenderCtx {
  const noop = () => undefined;
  return {
    mode: 'edit', theme, screen, asset: (s) => assetUrl(s), markComplete: noop, isComplete: () => false, runActions: noop, navigate: noop,
    openDialog: noop, registerMedia: noop, getCompState: () => undefined, setCompState: noop, reportQuestion: noop, reportQuiz: noop,
    getFinalResult: () => null, screenTitle: () => '',
  };
}

/* ------------------------------ un componente ------------------------------ */

interface CompProps {
  comp: ComponentData;
  layoutBp: Breakpoint;
  box: Box | null;
  ctx: RenderCtx;
  selected: boolean;
  editing: boolean;
  onPointerDown(e: React.PointerEvent, id: string): void;
  onDoubleClick(id: string): void;
  onContextMenu(e: React.MouseEvent, id: string): void;
  onCommitInline(id: string, value: string): void;
}

const CompView = memo(function CompView({ comp, layoutBp, box, ctx, selected, editing, onPointerDown, onDoubleClick, onContextMenu, onCommitInline }: CompProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentKey = JSON.stringify([comp.type, comp.props, comp.style]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inner = renderInner(comp, ctx);
    const rfs = responsiveFontSize(comp, layoutBp);
    if (rfs) inner.style.fontSize = rfs + 'px';
    el.replaceChildren(inner);
  }, [contentKey, ctx, layoutBp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editing || !ref.current) return;
    const target = ref.current.querySelector<HTMLElement>('[data-inline]');
    if (!target) return;
    const mode = target.dataset.inline;
    target.contentEditable = 'true';
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const commit = () => onCommitInline(comp.id, mode === 'html' ? sanitize(target.innerHTML) : target.innerText.replace(/\n$/, ''));
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && mode === 'text' && !e.shiftKey && comp.type !== 'text' && comp.type !== 'quote')) { e.preventDefault(); target.blur(); }
    };
    target.addEventListener('blur', commit, { once: true });
    target.addEventListener('keydown', onKey);
    return () => { target.removeEventListener('keydown', onKey); target.contentEditable = 'false'; };
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const style: React.CSSProperties = box
    ? { left: box.x, top: box.y, width: box.w, height: box.h, ...(outerStyle(comp.style || {}) as any) }
    : { ...(outerStyle(comp.style || {}) as any) };
  return (
    <div
      ref={ref}
      data-edit-id={comp.id}
      className={clsx('ema-comp', `ema-comp-${comp.type}`, box ? 'editor-comp' : 'relative', selected && 'is-selected', editing && 'is-editing', comp.locked && 'is-locked',
        comp.visibility?.hidden && 'is-hidden-runtime', comp.visibility?.condition && comp.visibility.condition.type !== 'always' && 'has-condition')}
      style={style}
      onPointerDown={(e) => onPointerDown(e, comp.id)}
      onDoubleClick={() => onDoubleClick(comp.id)}
      onContextMenu={(e) => onContextMenu(e, comp.id)}
    />
  );
});

/* ------------------------------ canvas ------------------------------ */

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

export function Canvas() {
  const screen = useEditor((s) => s.screen);
  const course = useEditor((s) => s.course);
  const bp = useEditor((s) => s.bp);
  const selected = useEditor((s) => s.selected);
  const editingId = useEditor((s) => s.editingId);
  const zoom = useEditor((s) => s.zoom);
  const zoomMode = useEditor((s) => s.zoomMode);
  const showGrid = useEditor((s) => s.showGrid);
  const snap = useEditor((s) => s.snap);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const menu = useMenu();

  const theme: Theme | undefined = course?.settings?.theme;
  const ctx = useMemo(() => (theme && screen ? makeCtx(theme, screen) : null), [theme, screen?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const eb = editableBp(screen, bp);
  const size = screen ? stageSize(screen, bp) : { w: 1200, h: 675 };
  const flowMode = !!screen && !eb && bp === 'mobile';

  // tema del curso → variables CSS
  useLayoutEffect(() => { if (rootRef.current && theme) applyThemeVars(rootRef.current, theme); }, [theme, flowMode]);

  // zoom "ajustar"
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const fit = () => {
      if (useEditor.getState().zoomMode !== 'fit') return;
      const avail = vp.clientWidth - 80;
      const z = Math.max(0.2, Math.min(1.25, avail / size.w));
      useEditor.setState({ zoom: Math.round(z * 100) / 100 });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [size.w, zoomMode]);

  const toStage = useCallback((clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
  }, [zoom]);

  /* ---------------------------- arrastrar / mover ---------------------------- */

  const startMove = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || !screen) return;
    const st = useEditor.getState();
    if (st.editingId === id) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let sel = st.selected;
    if (additive) { select([id], true); return; }
    if (!sel.includes(id)) { select([id]); sel = [id]; }
    if (st.editingId) useEditor.setState({ editingId: null });
    if (!eb) return;
    const comps = screen.components.filter((c) => sel.includes(c.id) && !c.locked);
    if (!comps.length) return;
    const start = { x: e.clientX, y: e.clientY };
    const startBoxes = Object.fromEntries(comps.map((c) => [c.id, { ...boxOf(c, eb) }]));
    const others = screen.components.filter((c) => !sel.includes(c.id)).map((c) => boxOf(c, eb));
    let began = false;
    const onMove = (ev: PointerEvent) => {
      let dx = (ev.clientX - start.x) / zoom;
      let dy = (ev.clientY - start.y) / zoom;
      if (!began) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        began = true;
        beginGesture();
      }
      const bs = Object.values(startBoxes);
      const gx = Math.min(...bs.map((b) => b.x)), gy = Math.min(...bs.map((b) => b.y));
      const gw = Math.max(...bs.map((b) => b.x + b.w)) - gx, gh = Math.max(...bs.map((b) => b.y + b.h)) - gy;
      const gv: number[] = [], gh2: number[] = [];
      if (snap && !ev.altKey) {
        const th = 6 / zoom;
        const vLines = [0, size.w / 2, size.w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
        const hLines = [0, size.h / 2, size.h, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
        let best: { d: number; adj: number; line: number } | null = null;
        for (const edge of [gx + dx, gx + dx + gw / 2, gx + dx + gw]) for (const l of vLines) { const d = Math.abs(edge - l); if (d < th && (!best || d < best.d)) best = { d, adj: l - edge, line: l }; }
        if (best) { dx += best.adj; gv.push(best.line); } else dx = Math.round((gx + dx) / 5) * 5 - gx;
        let bestH: { d: number; adj: number; line: number } | null = null;
        for (const edge of [gy + dy, gy + dy + gh / 2, gy + dy + gh]) for (const l of hLines) { const d = Math.abs(edge - l); if (d < th && (!bestH || d < bestH.d)) bestH = { d, adj: l - edge, line: l }; }
        if (bestH) { dy += bestH.adj; gh2.push(bestH.line); } else dy = Math.round((gy + dy) / 5) * 5 - gy;
      }
      setGuides({ v: gv, h: gh2 });
      const up: Record<string, Partial<Box>> = {};
      for (const [cid, b] of Object.entries(startBoxes)) up[cid] = { x: Math.round(b.x + dx), y: Math.round(b.y + dy) };
      setBoxes(up, eb, false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setGuides({ v: [], h: [] });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e: React.PointerEvent, id: string, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    if (!screen || !eb) return;
    const c = screen.components.find((x) => x.id === id);
    if (!c || c.locked) return;
    const b0 = { ...boxOf(c, eb) };
    const start = { x: e.clientX, y: e.clientY };
    const ratio = b0.w / b0.h;
    beginGesture();
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      let { x, y, w, h } = b0;
      if (handle.includes('e')) w = b0.w + dx;
      if (handle.includes('s')) h = b0.h + dy;
      if (handle.includes('w')) { w = b0.w - dx; x = b0.x + dx; }
      if (handle.includes('n')) { h = b0.h - dy; y = b0.y + dy; }
      if (ev.shiftKey && handle.length === 2) {
        h = w / ratio;
        if (handle.includes('n')) y = b0.y + b0.h - h;
      }
      if (snap && !ev.altKey) { w = Math.round(w / 5) * 5; h = Math.round(h / 5) * 5; x = Math.round(x / 5) * 5; y = Math.round(y / 5) * 5; }
      w = Math.max(16, w);
      h = Math.max(8, h);
      setBoxes({ [id]: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } }, eb, false);
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startMarquee = (e: React.PointerEvent) => {
    if (e.button !== 0 || !screen || !stageRef.current) return;
    if ((e.target as HTMLElement).closest('.editor-comp')) return;
    useEditor.setState({ editingId: null });
    if (!(e.shiftKey || e.ctrlKey)) select([]);
    if (!eb) return;
    const p0 = toStage(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => {
      const p = toStage(ev.clientX, ev.clientY);
      const r = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
      setMarquee(r);
      const hits = screen.components.filter((c) => {
        const b = boxOf(c, eb);
        return !b.hidden && b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
      }).map((c) => c.id);
      if (r.w > 3 || r.h > 3) useEditor.setState({ selected: hits });
    };
    const onUp = () => { setMarquee(null); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ---------------------------- edición inline ---------------------------- */

  const onDoubleClick = useCallback((id: string) => {
    const c = useEditor.getState().screen?.components.find((x) => x.id === id);
    if (!c || c.locked) return;
    const def = getDef(c.type);
    if (def?.inline) useEditor.setState({ editingId: id, selected: [id] });
  }, []);

  const onCommitInline = useCallback((id: string, value: string) => {
    const c = useEditor.getState().screen?.components.find((x) => x.id === id);
    useEditor.setState({ editingId: null });
    if (!c) return;
    const def = getDef(c.type);
    const key = def?.inline === 'html' ? 'html' : 'text';
    if (c.props[key] === value) return;
    updateComponent(id, (cc) => { cc.props[key] = value; });
  }, []);

  /* ---------------------------- menú contextual ---------------------------- */

  const onContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const st = useEditor.getState();
    if (!st.selected.includes(id)) select([id]);
    const c = st.screen?.components.find((x) => x.id === id);
    menu.open(e, [
      { label: 'Editar texto', icon: <Pencil />, onClick: () => onDoubleClick(id), disabled: !getDef(c?.type || '')?.inline },
      { divider: true },
      { label: 'Copiar', icon: <Copy />, shortcut: 'Ctrl+C', onClick: () => copySelected() },
      { label: 'Cortar', icon: <Scissors />, shortcut: 'Ctrl+X', onClick: () => copySelected(true) },
      { label: 'Pegar', icon: <ClipboardPaste />, shortcut: 'Ctrl+V', onClick: () => paste() },
      { label: 'Duplicar', icon: <Copy />, shortcut: 'Ctrl+D', onClick: () => duplicateSelected() },
      { divider: true },
      { label: 'Traer al frente', icon: <ArrowUpToLine />, onClick: () => reorder('front') },
      { label: 'Enviar al fondo', icon: <ArrowDownToLine />, onClick: () => reorder('back') },
      { label: c?.locked ? 'Desbloquear' : 'Bloquear', icon: c?.locked ? <Unlock /> : <Lock />, onClick: () => updateComponent(id, (cc) => { cc.locked = !cc.locked; }) },
      { divider: true },
      { label: 'Eliminar', icon: <Trash2 />, shortcut: 'Supr', danger: true, onClick: () => deleteSelected() },
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------- soltar desde la paleta ---------------------------- */

  const onDrop = (e: React.DragEvent) => {
    const key = e.dataTransfer.getData('application/x-ema-palette');
    if (!key || !screen) return;
    e.preventDefault();
    const item = paletteItems().find((p) => p.key === key);
    if (!item) return;
    const def = getDef(item.type)!;
    const w0 = item.size?.w ?? def.defaultSize.w, h0 = item.size?.h ?? def.defaultSize.h;
    const stageW = eb ? size.w : STAGE_WIDTH.desktop;
    const w = Math.min(w0, stageW - 20);
    const h = Math.round(h0 * (w / w0));
    let x = 40, y = 40;
    if (eb && stageRef.current) {
      const p = toStage(e.clientX, e.clientY);
      x = Math.max(0, Math.round(p.x - w / 2));
      y = Math.max(0, Math.round(p.y - h / 2));
    }
    const c = createComponent(item.type, { x, y, w, h, props: item.props });
    if (!eb && bp !== 'desktop') {
      // vista automática: se ubica al final de la pantalla de escritorio
      c.layout.desktop = { x: 60, y: Math.max(40, ...screen.components.map((k) => k.layout.desktop.y + k.layout.desktop.h + 20)), w: Math.min(w0, 1080), h: h0 };
    }
    addComponent(c);
  };

  /* ---------------------------- personalización responsive ---------------------------- */

  const customizeTablet = () => {
    const f = STAGE_WIDTH.tablet / STAGE_WIDTH.desktop;
    mutate((s) => {
      s.components.forEach((c) => {
        const d = c.layout.desktop;
        c.layout.tablet = { x: Math.round(d.x * f), y: Math.round(d.y * f), w: Math.round(d.w * f), h: Math.round(d.h * f), hidden: c.layout.tablet?.hidden };
      });
      s.tabletMode = 'custom';
    });
  };

  const customizeMobile = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const scale = sr.width / STAGE_WIDTH.mobile;
    const boxes: Record<string, Box> = {};
    stage.querySelectorAll<HTMLElement>('[data-edit-id]').forEach((el) => {
      const r = el.getBoundingClientRect();
      boxes[el.dataset.editId!] = { x: Math.round((r.left - sr.left) / scale), y: Math.round((r.top - sr.top) / scale), w: Math.round(r.width / scale), h: Math.max(20, Math.round(r.height / scale)) };
    });
    mutate((s) => {
      s.components.forEach((c) => {
        const hidden = c.layout.mobile?.hidden;
        c.layout.mobile = boxes[c.id] ? { ...boxes[c.id], hidden } : { x: 16, y: 0, w: 343, h: 40, hidden: true };
      });
      s.mobileMode = 'custom';
    });
  };

  const resetDevice = async (which: 'tablet' | 'mobile') => {
    if (!(await confirmDialog({ title: 'Volver al diseño automático', message: `Se descartarán las posiciones personalizadas para ${which === 'tablet' ? 'tablet' : 'celular'} (se conservan los componentes ocultos en ese dispositivo).` }))) return;
    mutate((s) => {
      s.components.forEach((c) => { const hidden = c.layout[which]?.hidden; if (hidden) c.layout[which] = { ...c.layout.desktop, hidden }; else delete c.layout[which]; });
      if (which === 'tablet') s.tabletMode = 'auto'; else s.mobileMode = 'auto';
    });
  };

  if (!screen || !ctx || !theme) {
    return <div ref={viewportRef} className="editor-canvas-bg flex flex-1 items-center justify-center text-sm text-slate-500">{screen === null ? 'Seleccioná una pantalla en la estructura' : 'Cargando…'}</div>;
  }

  const sel = selected.length === 1 ? screen.components.find((c) => c.id === selected[0]) : null;
  const selBox = sel && eb ? boxOf(sel, eb) : null;
  const bgStyle: React.CSSProperties = {};
  if (screen.background?.color) bgStyle.backgroundColor = screen.background.color;
  if (screen.background?.image) {
    const ov = screen.background.overlay;
    bgStyle.backgroundImage = (ov ? `linear-gradient(${ov}, ${ov}), ` : '') + `url("${assetUrl(screen.background.image)}")`;
    bgStyle.backgroundSize = screen.background.size || 'cover';
    bgStyle.backgroundPosition = 'center';
  }

  const banner = bp !== 'desktop' && (
    <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {bp === 'tablet' ? <Tablet className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
      {eb ? (
        <>
          <span>Editando el diseño personalizado para <b>{bp === 'tablet' ? 'tablet (768 px)' : 'celular (375 px)'}</b>. Los cambios no afectan a escritorio.</span>
          <button className="btn btn-ghost btn-xs" onClick={() => resetDevice(bp as 'tablet' | 'mobile')}><RotateCcw className="h-3.5 w-3.5" />Volver a automático</button>
        </>
      ) : (
        <>
          <span>{bp === 'tablet' ? 'Vista automática: el diseño de escritorio se escala al ancho de la tablet.' : 'Vista automática: los componentes se apilan en una columna en el orden de lectura.'}</span>
          <button className="btn btn-primary btn-xs" onClick={bp === 'tablet' ? customizeTablet : customizeMobile}><Wand2 className="h-3.5 w-3.5" />Personalizar para {bp === 'tablet' ? 'tablet' : 'celular'}</button>
        </>
      )}
    </div>
  );

  const stageW = flowMode ? STAGE_WIDTH.mobile : size.w;
  const stageH = size.h;

  return (
    <div ref={viewportRef} className="editor-canvas-bg relative min-w-0 flex-1 overflow-auto" onPointerDown={startMarquee}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-ema-palette')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
      <div className="p-10">
        {banner}
        <div style={{ width: stageW * zoom, height: flowMode ? undefined : stageH * zoom, margin: '0 auto' }}>
          <div ref={rootRef} className="ema-root" style={{ width: stageW, transform: flowMode ? undefined : `scale(${zoom})`, transformOrigin: '0 0', zoom: flowMode ? zoom : undefined } as any}>
            {flowMode ? (
              <div ref={stageRef} className="ema-stage is-flow editor-flow editor-stage" style={{ ...bgStyle, minHeight: 400 }}>
                <FlowPreview screen={screen} ctx={ctx} selected={selected} onSelect={(id) => select([id])} />
              </div>
            ) : (
              <div ref={stageRef} className={clsx('ema-stage is-abs editor-stage', showGrid && 'show-grid')} style={{ width: stageW, height: stageH, ...bgStyle }}>
                {screen.components.map((c) => {
                  const box = eb ? boxOf(c, eb) : c.layout.desktop;
                  if (eb && box.hidden) return null;
                  if (bp === 'tablet' && !eb && c.layout.tablet?.hidden) return null;
                  return <CompView key={c.id} comp={c} layoutBp={eb || 'desktop'} box={box} ctx={ctx} selected={selected.includes(c.id)} editing={editingId === c.id}
                    onPointerDown={startMove} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} onCommitInline={onCommitInline} />;
                })}
                {selBox && !sel!.locked && editingId !== sel!.id && HANDLES.map((hd) => {
                  const hs = 10 / zoom;
                  const x = hd.includes('w') ? selBox.x : hd.includes('e') ? selBox.x + selBox.w : selBox.x + selBox.w / 2;
                  const y = hd.includes('n') ? selBox.y : hd.includes('s') ? selBox.y + selBox.h : selBox.y + selBox.h / 2;
                  const cursor = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[hd];
                  return <div key={hd} className="resize-handle" style={{ left: x - hs / 2, top: y - hs / 2, width: hs, height: hs, borderWidth: 2 / zoom, cursor: `${cursor}-resize` }} onPointerDown={(e) => startResize(e, sel!.id, hd)} />;
                })}
                {guides.v.map((x, i) => <div key={'v' + i} className="guide-v" style={{ left: x, borderLeftWidth: 1 / zoom }} />)}
                {guides.h.map((y, i) => <div key={'h' + i} className="guide-h" style={{ top: y, borderTopWidth: 1 / zoom }} />)}
                {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
              </div>
            )}
          </div>
        </div>
        {!flowMode && eb && (
          <div className="mx-auto mt-2 flex justify-center">
            <button className="btn btn-ghost btn-xs" title="Agregar 200 px de alto a la pantalla" onClick={() => mutate((s) => { if (bp === 'desktop') s.height = s.height + 200; })} disabled={bp !== 'desktop'}>
              Alto: {stageH}px {bp === 'desktop' && '· + Agregar espacio abajo'}
            </button>
          </div>
        )}
      </div>
      {menu.node}
    </div>
  );
}

/** Vista de celular automática: mismo algoritmo de flujo que el player */
function FlowPreview({ screen, ctx, selected, onSelect }: { screen: ScreenData; ctx: RenderCtx; selected: string[]; onSelect(id: string): void }) {
  const ordered = flowOrder(screen.components.filter((c) => !isBackdrop(c, screen)));
  const backdrops = screen.components.filter((c) => isBackdrop(c, screen) && !c.layout.mobile?.hidden);
  return (
    <>
      {backdrops.length > 0 && (
        <div className="ema-flow-backdrop">
          {backdrops.map((c) => <FlowItem key={c.id} c={c} ctx={ctx} selected={false} onSelect={onSelect} backdrop />)}
        </div>
      )}
      {ordered.filter((c) => !c.layout.mobile?.hidden).map((c) => <FlowItem key={c.id} c={c} ctx={ctx} selected={selected.includes(c.id)} onSelect={onSelect} />)}
    </>
  );
}

function FlowItem({ c, ctx, selected, onSelect, backdrop }: { c: ComponentData; ctx: RenderCtx; selected: boolean; onSelect(id: string): void; backdrop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([c.type, c.props, c.style]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inner = renderInner(c, ctx);
    const rfs = responsiveFontSize(c, 'mobile');
    if (rfs) inner.style.fontSize = rfs + 'px';
    if (c.style?.margin) inner.style.margin = c.style.margin + 'px';
    el.replaceChildren(inner);
  }, [key, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const def = getDef(c.type);
  const d = c.layout.desktop;
  const style: React.CSSProperties = {};
  if (def?.flow === 'ratio') style.aspectRatio = `${d.w} / ${d.h}`;
  else if (def?.flow === 'fixed') style.height = Math.min(d.h, 200);
  if (c.type === 'icon') style.width = Math.min(d.w, 120);
  const compact = d.w < 500 && ['button', 'navButton', 'modal', 'badge', 'label', 'icon'].includes(c.type);
  return (
    <div ref={ref} data-edit-id={backdrop ? undefined : c.id} className={clsx('ema-comp', `ema-comp-${c.type}`, compact && 'is-compact', selected && 'outline outline-2 outline-brand-600')} style={style}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(c.id); }} />
  );
}
