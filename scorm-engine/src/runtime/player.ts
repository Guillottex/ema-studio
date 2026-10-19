import { flattenScreens, type Action, type ComponentData, type Condition, type CourseDoc, type FlatScreen, type Question, type ScreenData } from '../types';
import { h, escapeHtml } from '../render/dom';
import { icon } from '../render/icons';
import { applyThemeVars } from '../themes';
import { getDef, isTrackable } from '../registry';
import type { RenderCtx, QuestionResult, QuizResult } from '../registry/types';
import { breakpointFor, stageMode, stageHeight, boxFor, flowOrder, isBackdrop, renderInner, outerStyle, animationClasses, responsiveFontSize, type StageMode } from '../render/stage';
import { Tracker, emptyState } from './tracking';

export interface PlayerOptions {
  /** Prefijo para resolver recursos "asset:archivo.ext" (en el ZIP: "media/") */
  assetBase: string;
  /** Mapa nombre de recurso → ruta (en el ZIP: images/… o media/…) */
  assetMap?: Record<string, string>;
  /** Abrir directamente en esta pantalla (previsualizar pantalla) */
  startScreen?: string;
  onLog?: (msg: string) => void;
}

interface DialogHandle { close(): void }

export class Player {
  readonly doc: CourseDoc;
  readonly flat: FlatScreen[];
  readonly tracker: Tracker;
  idx = 0;
  private root: HTMLElement;
  private opts: PlayerOptions;
  private els!: {
    header: HTMLElement; title: HTMLElement; progressFill: HTMLElement; progressText: HTMLElement; progress: HTMLElement;
    menu: HTMLElement; menuList: HTMLElement; main: HTMLElement; stageHost: HTMLElement; footer: HTMLElement;
    prev: HTMLButtonElement; next: HTMLButtonElement; counter: HTMLElement; live: HTMLElement; layer: HTMLElement;
  };
  private compEls = new Map<string, HTMLElement>();
  private runtimeVis = new Map<string, boolean>();
  private media = new Map<string, HTMLMediaElement | HTMLIFrameElement>();
  private currentMode: StageMode | null = null;
  private currentBp = '';
  private scaler: HTMLElement | null = null;
  private stageBox: HTMLElement | null = null;
  private stageDims = { w: 1200, h: 675 };
  private io: IntersectionObserver | null = null;
  private saveTimer: any = null;
  private ctx: RenderCtx;
  private ended = false;

  constructor(root: HTMLElement, doc: CourseDoc, opts: PlayerOptions) {
    this.root = root;
    this.doc = doc;
    this.opts = opts;
    this.flat = flattenScreens(doc);
    this.tracker = new Tracker(doc, this.flat, (m) => this.log(m));
    this.ctx = this.makeCtx();
  }

  private log(m: string) {
    this.opts.onLog?.(m);
    if ((window as any).EMA_DEBUG) console.info('[EMA]', m);
  }

  /* ------------------------------------------------------------------ */
  /*  Inicio                                                             */
  /* ------------------------------------------------------------------ */

  start() {
    this.buildShell();
    if (!this.flat.length) {
      this.els.stageHost.appendChild(h('div', { class: 'ema-empty' }, 'Este curso todavía no tiene pantallas.'));
      return;
    }
    const { saved } = this.tracker.start();
    const startIdx = this.opts.startScreen ? this.flat.findIndex((f) => f.screen.id === this.opts.startScreen) : -1;
    const resumeEnabled = this.doc.settings.resume?.enabled !== false;
    if (saved && resumeEnabled) {
      this.tracker.state = saved;
      this.tracker.resumed = true;
    } else {
      this.tracker.state = emptyState();
    }
    const go = (i: number) => this.goTo(i, true);
    if (startIdx >= 0) go(startIdx);
    else if (saved && resumeEnabled && saved.loc > 0) {
      if (this.doc.settings.resume?.ask !== false) this.askResume(saved.loc);
      else go(saved.loc);
    } else go(0);

    const bye = () => this.end();
    window.addEventListener('pagehide', bye);
    window.addEventListener('beforeunload', bye);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.tracker.save(true); });
    let rt: any;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.onResize(), 120); });
  }

  private askResume(loc: number) {
    const f = this.flat[loc];
    const where = `${f.module.title} → ${f.lesson.title} → ${f.screen.title}`;
    const body = h('div', { class: 'ema-resume' },
      h('p', null, 'Tenés un avance guardado en este curso.'),
      h('p', { class: 'ema-resume-where' }, icon('pin', 16), h('span', null, where)),
      h('p', { class: 'ema-muted' }, `Módulo ${f.moduleIndex + 1} · Lección ${f.lessonIndex + 1} · Pantalla ${f.screenIndex + 1}`));
    const actions = h('div', { class: 'ema-dialog-actions' });
    const dlg = this.openDialog({ title: '¿Continuar donde lo dejaste?', node: h('div', null, body, actions), size: 'sm', closable: false });
    actions.append(
      h('button', { type: 'button', class: 'ema-btn ema-btn-ghost', onclick: () => { dlg.close(); this.goTo(0, true); } }, 'Empezar desde el inicio'),
      h('button', { type: 'button', class: 'ema-btn ema-btn-primary', onclick: () => { dlg.close(); this.goTo(loc, true); } }, icon('play', 16), h('span', null, 'Continuar'))
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Estructura                                                         */
  /* ------------------------------------------------------------------ */

  private buildShell() {
    const d = this.doc;
    const nav = d.settings.navigation;
    this.root.innerHTML = '';
    this.root.classList.add('ema-root', 'ema-player');
    applyThemeVars(this.root, d.settings.theme);
    this.root.lang = d.language || 'es';

    const progressFill = h('span', { class: 'ema-progress-fill' });
    const progressText = h('span', { class: 'ema-progress-text' });
    const progress = h('div', { class: `ema-progress ema-progress-${d.settings.theme.progress?.style || 'bar'}`, role: 'progressbar', 'aria-label': 'Progreso del curso' }, h('span', { class: 'ema-progress-track' }, progressFill), progressText);
    const menuBtn = h('button', { type: 'button', class: 'ema-icon-btn', 'aria-label': 'Menú del curso', title: 'Menú' }, icon('menu', 22));
    menuBtn.addEventListener('click', () => this.toggleMenu());
    const exitBtn = h('button', { type: 'button', class: 'ema-icon-btn', 'aria-label': 'Salir del curso', title: 'Salir' }, icon('logout', 20));
    exitBtn.addEventListener('click', () => this.confirmExit());
    const title = h('div', { class: 'ema-header-title' }, h('strong', null, d.title), h('span', { class: 'ema-header-sub' }));
    const header = h('header', { class: 'ema-header' + (nav.showHeader === false ? ' is-hidden' : '') },
      nav.showMenu ? menuBtn : null,
      d.settings.logo ? h('img', { class: 'ema-logo', src: this.asset(d.settings.logo), alt: '' }) : null,
      title,
      nav.showProgress ? progress : null,
      exitBtn);

    const menuList = h('nav', { class: 'ema-menu-list', 'aria-label': 'Contenido del curso' });
    const menu = h('aside', { class: 'ema-menu' }, h('div', { class: 'ema-menu-head' }, h('strong', null, 'Contenido'), h('button', { type: 'button', class: 'ema-icon-btn', 'aria-label': 'Cerrar menú', onclick: () => this.toggleMenu(false) }, icon('x', 18))), menuList);
    const stageHost = h('div', { class: 'ema-stage-host' });
    const live = h('div', { class: 'ema-sr', 'aria-live': 'polite' });
    const main = h('main', { class: 'ema-main', tabindex: '-1' }, stageHost, live);
    const prev = h('button', { type: 'button', class: 'ema-btn ema-btn-ghost ema-nav-prev' }, icon('chevron-left', 18), h('span', null, 'Anterior')) as HTMLButtonElement;
    const next = h('button', { type: 'button', class: 'ema-btn ema-btn-primary ema-nav-next' }, h('span', null, 'Siguiente'), icon('chevron-right', 18)) as HTMLButtonElement;
    prev.addEventListener('click', () => this.navigate('prev'));
    next.addEventListener('click', () => this.navigate('next'));
    const counter = h('span', { class: 'ema-counter' + (nav.showScreenCounter === false ? ' is-hidden' : '') });
    const footer = h('footer', { class: 'ema-footer' }, prev, counter, next);
    const layer = h('div', { class: 'ema-layer' });
    const body = h('div', { class: 'ema-body' }, nav.showMenu ? menu : null, h('div', { class: 'ema-content' }, main, footer));
    this.root.append(header, body, layer);
    this.els = { header, title, progressFill, progressText, progress, menu, menuList, main, stageHost, footer, prev, next, counter, live, layer };
    if (nav.showMenu && window.innerWidth >= 1280) this.root.classList.add('menu-open');
  }

  private toggleMenu(force?: boolean) {
    const open = force ?? !this.root.classList.contains('menu-open');
    this.root.classList.toggle('menu-open', open);
    if (open) this.renderMenu();
  }

  private renderMenu() {
    const list = this.els.menuList;
    list.innerHTML = '';
    const st = this.tracker.state;
    this.doc.modules.forEach((m, mi) => {
      const mod = h('div', { class: 'ema-menu-module' }, h('div', { class: 'ema-menu-mtitle' }, h('span', { class: 'ema-menu-num' }, String(mi + 1)), h('span', null, m.title)));
      m.lessons.forEach((l) => {
        const les = h('div', { class: 'ema-menu-lesson' }, h('div', { class: 'ema-menu-ltitle' }, l.title));
        l.screens.forEach((s) => {
          const i = this.flat.findIndex((f) => f.screen.id === s.id);
          const allowed = this.canGoTo(i);
          const visited = st.visited.has(i);
          const b = h('button', { type: 'button', class: 'ema-menu-screen' + (i === this.idx ? ' is-current' : '') + (visited ? ' is-visited' : ''), disabled: !allowed },
            icon(!allowed ? 'lock' : visited ? 'check-circle' : 'file', 15), h('span', null, s.title));
          b.addEventListener('click', () => { this.goTo(i); if (window.innerWidth < 1280) this.toggleMenu(false); });
          les.appendChild(b);
        });
        mod.appendChild(les);
      });
      list.appendChild(mod);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Navegación                                                         */
  /* ------------------------------------------------------------------ */

  canGoTo(i: number): boolean {
    if (i < 0 || i >= this.flat.length) return false;
    if (this.doc.settings.navigation.mode !== 'linear') return true;
    const st = this.tracker.state;
    if (st.visited.has(i) || i <= this.idx) return true;
    // lineal: sólo la siguiente pantalla, y si la actual está completa (cuando lo requiere)
    if (i !== this.idx + 1) {
      const maxVisited = Math.max(-1, ...st.visited);
      return i <= maxVisited;
    }
    return this.canLeaveCurrent();
  }

  canLeaveCurrent(): boolean {
    const s = this.flat[this.idx]?.screen;
    if (!s) return true;
    if (s.settings?.requireCompletion || this.doc.settings.navigation.mode === 'linear') return this.isScreenComplete(s);
    return true;
  }

  navigate(target: string, targetId?: string) {
    switch (target) {
      case 'next':
        if (!this.canLeaveCurrent() && this.flat[this.idx].screen.settings?.requireCompletion) {
          this.toast('Completá las actividades de esta pantalla para continuar.');
          return;
        }
        if (this.idx < this.flat.length - 1) this.goTo(this.idx + 1);
        return;
      case 'prev':
        if (this.idx > 0) this.goTo(this.idx - 1);
        return;
      case 'home':
        this.goTo(0);
        return;
      case 'menu':
        this.toggleMenu(true);
        return;
      case 'exit':
        this.confirmExit();
        return;
      case 'screen': {
        if (!targetId) return;
        let i = this.flat.findIndex((f) => f.screen.id === targetId);
        if (i < 0) i = this.flat.findIndex((f) => f.lesson.id === targetId);
        if (i < 0) i = this.flat.findIndex((f) => f.module.id === targetId);
        if (i >= 0) this.goTo(i, true);
        return;
      }
    }
  }

  goTo(i: number, force = false) {
    if (i < 0 || i >= this.flat.length) return;
    if (!force && !this.canGoTo(i)) {
      this.toast('Completá las pantallas anteriores para avanzar.');
      return;
    }
    this.idx = i;
    this.renderScreen();
  }

  /* ------------------------------------------------------------------ */
  /*  Pantalla                                                           */
  /* ------------------------------------------------------------------ */

  private renderScreen() {
    const f = this.flat[this.idx];
    const screen = f.screen;
    const st = this.tracker.state;
    st.loc = this.idx;
    st.visited.add(this.idx);
    this.compEls.clear();
    this.runtimeVis.clear();
    this.media.forEach((m) => { if (m instanceof HTMLMediaElement) m.pause(); });
    this.media.clear();
    this.io?.disconnect();
    this.ctx = this.makeCtx();

    const host = this.els.stageHost;
    host.innerHTML = '';
    const bp = breakpointFor(window.innerWidth);
    const avail = Math.max(280, host.clientWidth || this.els.main.clientWidth || window.innerWidth);
    const mode = stageMode(screen, bp, avail);
    this.currentMode = mode;
    this.currentBp = bp;
    this.root.dataset.bp = bp;

    const stage = h('div', { class: 'ema-stage', 'data-screen': screen.id });
    this.applyBackground(stage, screen);

    if (mode.kind === 'abs') {
      const H = mode.layoutBp === 'desktop' ? screen.height : stageHeight(screen, mode.layoutBp);
      this.stageDims = { w: mode.designWidth, h: H };
      const scaler = h('div', { class: 'ema-scaler', style: { width: mode.designWidth + 'px', height: H + 'px' } }, stage);
      stage.classList.add('is-abs');
      for (const c of screen.components) {
        const box = boxFor(c, mode.layoutBp);
        if (box.hidden || c.layout[bp]?.hidden) continue;
        const el = this.wrap(c);
        Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
        const rfs = responsiveFontSize(c, mode.layoutBp);
        if (rfs) (el.firstChild as HTMLElement).style.fontSize = rfs + 'px';
        stage.appendChild(el);
      }
      const box = h('div', { class: 'ema-stage-box' }, scaler);
      host.appendChild(box);
      this.scaler = scaler;
      this.stageBox = box;
      this.rescale();
    } else {
      this.scaler = null;
      this.stageBox = null;
      stage.classList.add('is-flow');
      const backdrop = h('div', { class: 'ema-flow-backdrop' });
      for (const c of screen.components) {
        if (isBackdrop(c, screen) && !c.layout.mobile?.hidden) backdrop.appendChild(this.wrap(c));
      }
      if (backdrop.childElementCount) stage.appendChild(backdrop);
      const flowBp = bp === 'mobile' ? 'mobile' : 'tablet';
      for (const c of flowOrder(screen.components.filter((x) => !isBackdrop(x, screen)))) {
        if (c.layout[flowBp]?.hidden) continue;
        const el = this.wrap(c);
        const def = getDef(c.type);
        const d = c.layout.desktop;
        if (def?.flow === 'ratio') el.style.aspectRatio = `${d.w} / ${d.h}`;
        else if (def?.flow === 'fixed') el.style.height = Math.min(d.h, 200) + 'px';
        if (d.w < 500 && (c.type === 'button' || c.type === 'navButton' || c.type === 'modal' || c.type === 'badge' || c.type === 'label' || c.type === 'icon')) el.classList.add('is-compact');
        if (c.type === 'icon') el.style.width = Math.min(d.w, 120) + 'px';
        const inner = el.firstChild as HTMLElement;
        if (c.style?.margin) inner.style.margin = c.style.margin + 'px';
        const rfs = responsiveFontSize(c, bp === 'mobile' ? 'mobile' : 'tablet');
        if (rfs) inner.style.fontSize = rfs + 'px';
        stage.appendChild(el);
      }
      host.appendChild(stage);
    }

    this.applyVisibility();
    this.startAnimations(stage);
    this.updateChrome();
    this.els.main.scrollTop = 0;
    this.els.live.textContent = `${f.module.title}, ${f.lesson.title}: ${screen.title}`;
    this.tracker.save(true);
  }

  private applyBackground(stage: HTMLElement, s: ScreenData) {
    const bg = s.background || {};
    if (bg.color) stage.style.backgroundColor = bg.color;
    if (bg.image) {
      stage.style.backgroundImage = (bg.overlay ? `linear-gradient(${bg.overlay}, ${bg.overlay}), ` : '') + `url("${this.asset(bg.image)}")`;
      stage.style.backgroundSize = bg.size || 'cover';
      stage.style.backgroundPosition = 'center';
    }
  }

  private wrap(c: ComponentData): HTMLElement {
    const el = h('div', { class: `ema-comp ema-comp-${c.type}`, 'data-id': c.id });
    Object.assign(el.style, outerStyle(c.style || {}));
    el.appendChild(renderInner(c, this.ctx));
    const an = animationClasses(c.animation);
    if (an.cls.length) {
      el.classList.add(...an.cls);
      for (const [k, v] of Object.entries(an.vars)) el.style.setProperty(k, v);
    }
    const events = c.events || [];
    const clicks = events.filter((e) => e.trigger === 'click' && e.actions.length);
    if (clicks.length) {
      el.classList.add('is-clickable');
      el.setAttribute('tabindex', el.querySelector('button,a,input') ? '-1' : '0');
      el.addEventListener('click', () => clicks.forEach((e) => this.runActions(e.actions, c.id)));
      el.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === el) { ev.preventDefault(); clicks.forEach((e) => this.runActions(e.actions, c.id)); } });
    }
    const hovers = events.filter((e) => e.trigger === 'hover' && e.actions.length);
    if (hovers.length) el.addEventListener('mouseenter', () => hovers.forEach((e) => this.runActions(e.actions, c.id)));
    if (c.animation?.type && c.animation.type !== 'none' && c.animation.trigger === 'click') {
      el.addEventListener('click', () => this.playAnimation(el));
    }
    this.compEls.set(c.id, el);
    return el;
  }

  private startAnimations(stage: HTMLElement) {
    const els = Array.from(stage.querySelectorAll<HTMLElement>('.ema-anim'));
    const scrollEls = els.filter((e) => e.classList.contains('ema-trig-scroll'));
    if (scrollEls.length && 'IntersectionObserver' in window) {
      this.io = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('ema-anim-run'); this.io?.unobserve(en.target); }
      }), { root: this.els.main, threshold: 0.15 });
      scrollEls.forEach((e) => this.io!.observe(e));
    } else scrollEls.forEach((e) => e.classList.add('ema-anim-run'));
    requestAnimationFrame(() => requestAnimationFrame(() => els.filter((e) => e.classList.contains('ema-trig-load')).forEach((e) => e.classList.add('ema-anim-run'))));
  }

  private playAnimation(el: HTMLElement, type?: string) {
    if (type && type !== 'none') {
      el.classList.forEach((k) => { if (/^ema-anim-(fade|slide|zoom|bounce|appear)$/.test(k)) el.classList.remove(k); });
      el.classList.add('ema-anim', `ema-anim-${type === 'scroll' ? 'slide' : type}`);
      if (![...el.classList].some((k) => k.startsWith('ema-dir-'))) el.classList.add('ema-dir-up');
    }
    el.classList.remove('ema-anim-run');
    void el.offsetWidth; // reflow para reiniciar la animación
    el.classList.add('ema-anim-run');
  }

  private rescale() {
    if (!this.scaler || !this.stageBox) return;
    const avail = this.els.stageHost.clientWidth || window.innerWidth;
    const s = Math.min(1, avail / this.stageDims.w);
    this.scaler.style.transform = `scale(${s})`;
    this.stageBox.style.width = this.stageDims.w * s + 'px';
    this.stageBox.style.height = this.stageDims.h * s + 'px';
  }

  private onResize() {
    if (!this.flat.length) return;
    const f = this.flat[this.idx];
    const bp = breakpointFor(window.innerWidth);
    const mode = stageMode(f.screen, bp, this.els.stageHost.clientWidth);
    const same = this.currentMode && mode.kind === this.currentMode.kind && bp === this.currentBp && (mode.kind === 'flow' || (this.currentMode.kind === 'abs' && mode.layoutBp === this.currentMode.layoutBp));
    if (same) this.rescale();
    else this.renderScreen();
  }

  /* ------------------------------------------------------------------ */
  /*  Estado, condiciones y visibilidad                                  */
  /* ------------------------------------------------------------------ */

  private componentVisible(c: ComponentData): boolean {
    let vis = !c.visibility?.hidden;
    if (this.runtimeVis.has(c.id)) vis = this.runtimeVis.get(c.id)!;
    const cond = c.visibility?.condition;
    if (vis && cond && cond.type !== 'always') vis = this.evalCondition(cond);
    return vis;
  }

  evalCondition(cond: Condition): boolean {
    const st = this.tracker.state;
    switch (cond.type) {
      case 'always':
        return true;
      case 'screenComplete': {
        const s = cond.target ? this.flat.find((f) => f.screen.id === cond.target)?.screen : this.flat[this.idx].screen;
        return s ? this.isScreenComplete(s) : false;
      }
      case 'componentComplete':
        return !!cond.target && st.done.has(cond.target);
      case 'variable':
        return (st.vars[cond.target || ''] ?? '') === (cond.value ?? '');
      case 'quizPassed':
        if (cond.target) return !!st.comp[cond.target]?.passed;
        return !!st.final?.passed;
      case 'screenVisited': {
        const i = this.flat.findIndex((f) => f.screen.id === cond.target);
        return i >= 0 && st.visited.has(i);
      }
    }
    return true;
  }

  isScreenComplete(s: ScreenData): boolean {
    const done = this.tracker.state.done;
    const current = s.id === this.flat[this.idx]?.screen.id;
    return s.components.every((c) => {
      if (!isTrackable(c)) return true;
      if (current && !this.componentVisible(c)) return true;
      if (!current && c.visibility?.hidden) return true;
      return done.has(c.id);
    });
  }

  private applyVisibility() {
    const s = this.flat[this.idx].screen;
    for (const c of s.components) {
      const el = this.compEls.get(c.id);
      if (!el) continue;
      const vis = this.componentVisible(c);
      const was = !el.classList.contains('is-hidden');
      el.classList.toggle('is-hidden', !vis);
      el.setAttribute('aria-hidden', String(!vis));
      if (vis && !was && el.classList.contains('ema-trig-action')) this.playAnimation(el);
    }
  }

  private onStateChange() {
    this.applyVisibility();
    this.updateChrome();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.tracker.save(true), 400);
  }

  private updateChrome() {
    const f = this.flat[this.idx];
    const total = this.flat.length;
    const pct = Math.round(this.tracker.visitedPct());
    this.els.progressFill.style.width = pct + '%';
    this.els.progressText.textContent = pct + '%';
    this.els.progress.setAttribute('aria-valuenow', String(pct));
    this.els.progress.setAttribute('aria-valuemin', '0');
    this.els.progress.setAttribute('aria-valuemax', '100');
    (this.els.title.querySelector('.ema-header-sub') as HTMLElement).textContent = `${f.module.title} · ${f.lesson.title}`;
    this.els.counter.textContent = `${this.idx + 1} / ${total}`;
    this.els.prev.disabled = this.idx === 0;
    const isLast = this.idx === total - 1;
    const blocked = !this.canLeaveCurrent();
    this.els.next.disabled = isLast || blocked;
    this.els.next.title = blocked ? 'Completá las actividades de la pantalla para continuar' : '';
    this.els.next.classList.toggle('is-blocked', blocked && !isLast);
    this.els.footer.classList.toggle('is-hidden', !!f.screen.settings?.hideNav);
    if (this.root.classList.contains('menu-open')) this.renderMenu();
  }

  /* ------------------------------------------------------------------ */
  /*  Acciones                                                           */
  /* ------------------------------------------------------------------ */

  runActions(actions: Action[], sourceId: string) {
    for (const a of actions) {
      try {
        this.runAction(a, sourceId);
      } catch (e) {
        console.error('[EMA] acción fallida', a, e);
      }
    }
  }

  private findComp(id?: string): ComponentData | undefined {
    if (!id) return undefined;
    for (const f of this.flat) {
      const c = f.screen.components.find((x) => x.id === id);
      if (c) return c;
    }
    return undefined;
  }

  private runAction(a: Action, sourceId: string) {
    switch (a.type) {
      case 'show':
      case 'hide':
      case 'toggle': {
        if (!a.target) return;
        const c = this.findComp(a.target);
        const cur = c ? this.componentVisible(c) : false;
        this.runtimeVis.set(a.target, a.type === 'show' ? true : a.type === 'hide' ? false : !cur);
        this.applyVisibility();
        this.updateChrome();
        return;
      }
      case 'openModal': {
        const c = this.findComp(a.target);
        if (c && c.type === 'modal') {
          this.openDialog({ title: c.props.title, html: c.props.content, size: c.props.size });
          this.markComplete(c.id);
        } else this.openDialog({ title: a.title || '', html: a.text ? `<p>${escapeHtml(a.text)}</p>` : '' });
        return;
      }
      case 'message':
        this.openDialog({ title: a.title || 'Mensaje', html: `<p>${escapeHtml(a.text || '').replace(/\n/g, '<br>')}</p>`, size: 'sm' });
        return;
      case 'goto':
        this.navigate('screen', a.screenId);
        return;
      case 'next':
      case 'prev':
      case 'home':
        this.navigate(a.type);
        return;
      case 'playMedia':
      case 'pauseMedia': {
        const m = a.target ? this.media.get(a.target) : undefined;
        if (m instanceof HTMLMediaElement) {
          if (a.type === 'playMedia') m.play().catch(() => this.toast('No se pudo reproducir el contenido.'));
          else m.pause();
        } else if (m) {
          const iframe = m as HTMLIFrameElement;
          if (!iframe.src && iframe.dataset.src) iframe.src = iframe.dataset.src;
          iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      case 'animate': {
        const el = a.target ? this.compEls.get(a.target) : undefined;
        if (el) this.playAnimation(el, a.animation);
        return;
      }
      case 'complete':
        this.markComplete(a.target || sourceId);
        return;
      case 'setVar':
        if (a.varName) {
          this.tracker.state.vars[a.varName] = a.value ?? '';
          this.onStateChange();
        }
        return;
    }
  }

  markComplete(id: string) {
    const st = this.tracker.state;
    if (st.done.has(id)) return;
    st.done.add(id);
    const c = this.findComp(id);
    c?.events?.filter((e) => e.trigger === 'complete').forEach((e) => this.runActions(e.actions, id));
    this.onStateChange();
  }

  /* ------------------------------------------------------------------ */
  /*  Contexto para componentes                                          */
  /* ------------------------------------------------------------------ */

  asset(src?: string): string {
    if (!src) return '';
    if (src.startsWith('asset:')) {
      const name = src.slice(6);
      return this.opts.assetMap?.[name] || this.opts.assetBase + name;
    }
    return src;
  }

  private makeCtx(): RenderCtx {
    const self = this;
    const screen = this.flat[this.idx]?.screen;
    return {
      mode: 'play',
      theme: this.doc.settings.theme,
      screen,
      asset: (s) => self.asset(s),
      markComplete: (id) => self.markComplete(id),
      isComplete: (id) => self.tracker.state.done.has(id),
      runActions: (a, s) => self.runActions(a, s),
      navigate: (t, id) => self.navigate(t, id),
      openDialog: (o) => { self.openDialog(o); },
      registerMedia: (id, el) => { self.media.set(id, el); },
      getCompState: (id) => self.tracker.state.comp[id],
      setCompState: (id, s) => { self.tracker.state.comp[id] = s; clearTimeout(self.saveTimer); self.saveTimer = setTimeout(() => self.tracker.save(true), 400); },
      reportQuestion: (id: string, q: Question, r: QuestionResult) => self.reportQuestion(id, q, r),
      reportQuiz: (id: string, isFinal: boolean, r: QuizResult) => self.reportQuiz(id, isFinal, r),
      getFinalResult: () => {
        const f = self.tracker.state.final;
        return f ? { score: f.score, passed: f.passed, status: self.tracker.status } : null;
      },
      screenTitle: (id) => self.flat.find((f) => f.screen.id === id)?.screen.title || '',
    };
  }

  private reportQuestion(id: string, q: Question, r: QuestionResult) {
    const st = this.tracker.state;
    const comp = st.comp[id];
    this.tracker.recordInteraction(id, q, comp?.response ?? null, r.correct);
    if (!id.includes(':')) st.scores[id] = [r.score, r.maxScore];
    this.tracker.save(true);
  }

  private reportQuiz(id: string, isFinal: boolean, r: QuizResult) {
    const st = this.tracker.state;
    if (isFinal) {
      const c = this.findComp(id);
      const max = Number(c?.props.attempts) || 0;
      const used = st.comp[id]?.attempts || 0;
      const prev = st.final;
      const passed = !!prev?.passed || r.passed;
      st.final = {
        score: Math.max(prev?.score ?? 0, r.scorePct),
        passed,
        attemptsExhausted: !passed && max > 0 && used >= max,
      };
    } else {
      st.scores[id] = [r.raw, r.max];
    }
    this.markComplete(id);
    this.tracker.save(true);
    this.updateChrome();
  }

  /* ------------------------------------------------------------------ */
  /*  Diálogos y mensajes                                                */
  /* ------------------------------------------------------------------ */

  openDialog(o: { title?: string; html?: string; node?: Node; size?: 'sm' | 'md' | 'lg'; closable?: boolean }): DialogHandle {
    const closable = o.closable !== false;
    const prevFocus = document.activeElement as HTMLElement | null;
    const body = h('div', { class: 'ema-dialog-body' });
    if (o.html) body.innerHTML = o.html;
    if (o.node) body.appendChild(o.node);
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
    const closeBtn = closable ? h('button', { type: 'button', class: 'ema-icon-btn', 'aria-label': 'Cerrar', onclick: close }, icon('x', 18)) : null;
    const dialog = h('div', { class: `ema-dialog ema-dialog-${o.size || 'md'}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Ventana' },
      o.title || closeBtn ? h('div', { class: 'ema-dialog-head' }, h('h2', null, o.title || ''), closeBtn) : null, body);
    const backdrop = h('div', { class: 'ema-dialog-backdrop' }, dialog);
    if (closable) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && closable) close(); };
    document.addEventListener('keydown', onKey);
    this.els.layer.appendChild(backdrop);
    setTimeout(() => (dialog.querySelector('button, [href], input, select') as HTMLElement | null)?.focus(), 30);
    return { close };
  }

  toast(msg: string) {
    const t = h('div', { class: 'ema-toast', role: 'status' }, icon('info', 18), h('span', null, msg));
    this.els.layer.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  private confirmExit() {
    const actions = h('div', { class: 'ema-dialog-actions' });
    const dlg = this.openDialog({ title: 'Salir del curso', size: 'sm', node: h('div', null, h('p', null, 'Tu avance quedará guardado y podrás continuar más tarde desde esta pantalla.'), actions) });
    actions.append(
      h('button', { type: 'button', class: 'ema-btn ema-btn-ghost', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'ema-btn ema-btn-primary', onclick: () => { dlg.close(); this.end(true); } }, icon('logout', 16), h('span', null, 'Guardar y salir'))
    );
  }

  /** Finaliza la sesión SCORM (LMSFinish). */
  end(showMessage = false) {
    if (this.ended) return;
    this.ended = true;
    this.tracker.finish();
    if (showMessage) {
      this.els.layer.appendChild(h('div', { class: 'ema-dialog-backdrop' }, h('div', { class: 'ema-dialog ema-dialog-sm', role: 'dialog' }, h('div', { class: 'ema-dialog-body ema-center' }, icon('check-circle', 40), h('h2', null, 'Avance guardado'), h('p', null, 'Ya podés cerrar esta ventana.')))));
      try {
        if (window.top === window) window.close();
      } catch { /* ignore */ }
    }
  }
}
