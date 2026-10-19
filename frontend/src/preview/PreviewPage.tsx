import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Monitor, Tablet, Smartphone, RotateCw, RefreshCw, PanelRightClose, PanelRightOpen, Info, X, LogOut, RotateCcw,
  Copy, Server, Clock, MapPin, User as UserIcon, Database, ListChecks, ScrollText, AlertTriangle, Eye, Trash2, CheckCircle2,
} from 'lucide-react';
import { flattenScreens, masteryScore, type CourseDoc } from '@engine';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { Badge, Button, IconButton, Spinner, Switch, clsx, confirmDialog } from '../components/ui';
import { Scorm12Simulator, fmtElapsed, visitedFromSuspend, type LmsLogEntry, type SimulatorSnapshot } from './lmsApi';

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICES: Record<Device, { label: string; w: number; h: number; icon: ReactNode }> = {
  desktop: { label: 'Escritorio', w: 0, h: 0, icon: <Monitor className="h-4 w-4" /> },
  tablet: { label: 'Tablet', w: 768, h: 1024, icon: <Tablet className="h-4 w-4" /> },
  mobile: { label: 'Celular', w: 375, h: 740, icon: <Smartphone className="h-4 w-4" /> },
};

const PREF_KEY = 'ema-preview-prefs';
const BANNER_KEY = 'ema-preview-banner-hidden';
/** El token de previsualización dura 4 h; lo renovamos antes de que venza */
const TOKEN_MAX_AGE = 3 * 60 * 60 * 1000;

function readPrefs(): { device: Device; landscape: boolean; panel: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { device: p.device in DEVICES ? p.device : 'desktop', landscape: !!p.landscape, panel: p.panel !== false };
  } catch {
    return { device: 'desktop', landscape: false, panel: true };
  }
}

const STATUS_STYLE: Record<string, { color: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'; label: string }> = {
  passed: { color: 'green', label: 'Aprobado' },
  completed: { color: 'blue', label: 'Completado' },
  failed: { color: 'red', label: 'Desaprobado' },
  incomplete: { color: 'amber', label: 'Incompleto' },
  browsed: { color: 'violet', label: 'Explorado' },
  'not attempted': { color: 'slate', label: 'Sin intentar' },
};

const SESSION_STATE: Record<SimulatorSnapshot['state'], { color: 'slate' | 'green' | 'amber'; label: string }> = {
  'not-initialized': { color: 'slate', label: 'Sin inicializar' },
  running: { color: 'green', label: 'Sesión activa' },
  finished: { color: 'amber', label: 'Sesión finalizada' },
};

interface PlayerWindow extends Window {
  EMA_PLAYER?: { end(showMessage?: boolean): void };
}

export default function PreviewPage() {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const screenId = search.get('pantalla') || '';
  const navigate = useNavigate();
  const { can } = useAuth();

  const prefs = useMemo(readPrefs, []);
  const [device, setDevice] = useState<Device>(prefs.device);
  const [landscape, setLandscape] = useState(prefs.landscape);
  const [panelOpen, setPanelOpen] = useState(prefs.panel);
  const [bannerHidden, setBannerHidden] = useState(() => {
    try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ device, landscape, panel: panelOpen })); } catch { /* ignore */ }
  }, [device, landscape, panelOpen]);

  const course = useQuery({ queryKey: ['course', id], queryFn: () => api.get<{ id: string; title: string }>(`/courses/${id}`), enabled: !!id });
  // El documento armado es exactamente lo que se empaqueta: de ahí sale la cantidad de pantallas y el mastery score
  const doc = useQuery({ queryKey: ['course-doc', id], queryFn: () => api.get<CourseDoc>(`/courses/${id}/doc`), enabled: !!id, staleTime: 0 });
  const screenCount = useMemo(() => (doc.data ? flattenScreens(doc.data).length : 0), [doc.data]);
  const mastery = useMemo(() => (doc.data ? masteryScore(doc.data) : null), [doc.data]);
  const screenTitle = useMemo(() => (doc.data && screenId ? flattenScreens(doc.data).find((f) => f.screen.id === screenId)?.screen.title : undefined), [doc.data, screenId]);

  /* ----------------------------- Simulador LMS ----------------------------- */

  const simRef = useRef<Scorm12Simulator | null>(null);
  if (!simRef.current || simRef.current.courseId !== id) simRef.current = new Scorm12Simulator({ courseId: id, learner: { id: 'PRUEBA01', name: 'Alumno, Prueba' } });
  const sim = simRef.current;
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => sim.subscribe(bump), [sim]);
  useEffect(() => { sim.setConfig({ masteryScore: mastery }); }, [sim, mastery]);

  // El SCO busca window.API recorriendo window.parent: lo publicamos en esta ventana (el iframe es del mismo origen)
  useEffect(() => {
    (window as any).API = sim;
    return () => {
      if ((window as any).API === sim) delete (window as any).API;
    };
  }, [sim]);

  /* ----------------------------- Token / iframe ----------------------------- */

  const [token, setToken] = useState<{ url: string; at: number } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [frameLoading, setFrameLoading] = useState(true);
  const [frameError, setFrameError] = useState<string | null>(null);
  const retriedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchToken = useCallback(async () => {
    setTokenError(null);
    try {
      const r = await api.post<{ url: string }>(`/courses/${id}/preview-token`);
      setToken({ url: r.url, at: Date.now() });
      return true;
    } catch (e) {
      setTokenError(e instanceof ApiError ? e.message : 'No se pudo generar la previsualización');
      return false;
    }
  }, [id]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  /** Cierra la sesión del SCO como lo haría el LMS al cerrar la ventana (LMSFinish) */
  const endPlayerSession = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow as PlayerWindow | null;
      if (w?.EMA_PLAYER && typeof w.EMA_PLAYER.end === 'function') w.EMA_PLAYER.end(false);
    } catch { /* ignore */ }
    if (sim.snapshot().state === 'running') sim.LMSFinish('');
  }, [sim]);

  // Al salir de la página, cerrar la sesión antes de quitar el API
  useEffect(() => () => endPlayerSession(), [endPlayerSession]);

  const remount = useCallback(async () => {
    retriedRef.current = false;
    setFrameError(null);
    setFrameLoading(true);
    if (!token || Date.now() - token.at > TOKEN_MAX_AGE) await fetchToken();
    setFrameKey((k) => k + 1);
  }, [token, fetchToken]);

  const relaunch = useCallback(async (msg?: string) => {
    endPlayerSession();
    sim.relaunch();
    await remount();
    if (msg) toast.info(msg);
  }, [endPlayerSession, sim, remount]);

  const resetAttempt = useCallback(async () => {
    const ok = await confirmDialog({
      title: 'Reiniciar intento',
      message: 'Se borran el avance, el puntaje, las interacciones y los datos de suspensión guardados para este curso en este navegador. El curso arranca de cero como un alumno nuevo.',
      confirmText: 'Reiniciar',
      danger: true,
    });
    if (!ok) return;
    endPlayerSession();
    sim.reset();
    sim.clearLog();
    await remount();
    toast.success('Intento reiniciado');
  }, [endPlayerSession, sim, remount]);

  const copyCmi = useCallback(async () => {
    const s = sim.snapshot();
    const data = {
      curso: { id, titulo: course.data?.title },
      sesion: { numero: s.session, estado: s.state, sesionesGuardadas: s.sessionsStored, ultimoExit: s.lastExit, cambiosSinConfirmar: s.dirty },
      cmi: sim.exportCmi(),
    };
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.success('Datos CMI copiados al portapapeles');
  }, [sim, id, course.data?.title]);

  const onFrameLoad = useCallback(async () => {
    setFrameLoading(false);
    let booted = false;
    let text = '';
    try {
      const d = iframeRef.current?.contentDocument;
      booted = !!d?.getElementById('ema-app');
      text = d?.body?.innerText?.slice(0, 400) || '';
    } catch {
      booted = false;
    }
    if (booted) {
      // Si el documento del curso se descarga por su cuenta (recarga interna, salida, etc.), el LMS
      // cierra esa sesión y prepara un nuevo lanzamiento. Este listener corre después del del player
      // (que hace su LMSFinish), porque se registra más tarde.
      try {
        const w = iframeRef.current?.contentWindow;
        w?.addEventListener('pagehide', () => {
          const s = sim.snapshot().state;
          if (s === 'not-initialized') return; // ya se relanzó desde la página
          if (s === 'running') sim.LMSFinish('');
          sim.relaunch();
        });
      } catch { /* ignore */ }
      return;
    }
    // El servidor respondió un error (p. ej. token vencido → 401): renovamos el token una vez
    if (!retriedRef.current) {
      retriedRef.current = true;
      if (sim.snapshot().state === 'running') sim.LMSFinish('');
      if (await fetchToken()) {
        sim.relaunch();
        setFrameLoading(true);
        setFrameKey((k) => k + 1);
        return;
      }
    }
    let msg = 'No se pudo cargar el curso.';
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch { /* texto plano */ }
    setFrameError(msg);
  }, [fetchToken, sim]);

  /* ----------------------------- Escalado del dispositivo ----------------------------- */

  const stageRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [token]);

  const dev = DEVICES[device];
  const isFrame = device !== 'desktop';
  const vw = isFrame ? (landscape ? dev.h : dev.w) : 0;
  const vh = isFrame ? (landscape ? dev.w : dev.h) : 0;
  const bezel = device === 'mobile' ? 12 : 16;
  const outerW = vw + bezel * 2;
  const outerH = vh + bezel * 2;
  const pad = 32;
  const scale = isFrame && area.w > 0 ? Math.min(1, (area.w - pad) / outerW, (area.h - pad) / outerH) : 1;

  /* ----------------------------- Render ----------------------------- */

  const snap = sim.snapshot();
  const backTo = can('courses.edit') ? `/cursos/${id}/editor` : '/cursos';
  const frameSrc = token ? token.url + (screenId ? `#screen=${encodeURIComponent(screenId)}` : '') : '';
  const ready = !!token && !doc.isLoading;

  const iframe = ready && (
    <iframe
      key={frameKey}
      ref={iframeRef}
      src={frameSrc}
      title="Previsualización del curso"
      onLoad={onFrameLoad}
      allow="autoplay; fullscreen; clipboard-write"
      allowFullScreen
      className="block h-full w-full border-0 bg-white"
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Barra superior */}
      <header className="flex flex-none flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <IconButton title={can('courses.edit') ? 'Volver al editor' : 'Volver a cursos'} onClick={() => navigate(backTo)}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <div className="mr-auto min-w-0 flex-1 basis-40">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{course.data?.title || (course.isLoading ? 'Cargando…' : 'Curso')}</h1>
            <Badge color="blue" className="hidden sm:inline-flex">Vista previa</Badge>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {screenId ? <>Pantalla: {screenTitle || screenId} · <button className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => navigate(`/cursos/${id}/preview`)}>ver curso completo</button></> : 'Paquete SCORM 1.2 idéntico al exportado'}
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Dispositivo">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} type="button" title={DEVICES[d].label + (DEVICES[d].w ? ` (${DEVICES[d].w}×${DEVICES[d].h})` : '')} aria-pressed={device === d} onClick={() => setDevice(d)}
              className={clsx('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                device === d ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100')}>
              {DEVICES[d].icon}<span className="hidden lg:inline">{DEVICES[d].label}</span>
            </button>
          ))}
        </div>
        <IconButton title={landscape ? 'Girar a vertical' : 'Girar a horizontal'} disabled={!isFrame} active={isFrame && landscape} onClick={() => setLandscape((v) => !v)}>
          <RotateCw className="h-4 w-4" />
        </IconButton>
        {isFrame && <span className="hidden font-mono text-[11px] text-slate-400 md:inline">{vw}×{vh} · {Math.round(scale * 100)}%</span>}
        <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <Button size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => relaunch()} disabled={!ready} title="Cierra la sesión actual y vuelve a cargar el curso con los últimos cambios">
          <span className="hidden sm:inline">Recargar</span>
        </Button>
        <Button size="sm" variant={panelOpen ? 'primary' : 'secondary'} icon={panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />} onClick={() => setPanelOpen((v) => !v)} aria-pressed={panelOpen}>
          <span className="hidden sm:inline">Simulador LMS</span>
        </Button>
      </header>

      {!bannerHidden && (
        <div className="flex flex-none items-start gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs text-brand-900 dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-200">
          <Info className="mt-px h-4 w-4 flex-none" />
          <p className="flex-1">
            La vista previa corre dentro de un <strong>LMS simulado (SCORM 1.2)</strong>: el curso guarda avance, puntaje e interacciones como en la plataforma real.
            Los datos se guardan <strong>solo en este navegador</strong> y no afectan a los alumnos.
          </p>
          <button className="text-brand-700 hover:text-brand-900 dark:text-brand-300" aria-label="Ocultar aviso" onClick={() => { setBannerHidden(true); try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* */ } }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* Escenario */}
        <main ref={stageRef} className={clsx('relative min-w-0 flex-1 overflow-hidden', isFrame ? 'editor-canvas-bg' : 'bg-white dark:bg-slate-900')}>
          {tokenError || doc.isError ? (
            <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-red-500" />} title="No se pudo abrir la vista previa">
              <p>{tokenError || (doc.error as Error)?.message}</p>
              <Button className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => { doc.refetch(); fetchToken(); }}>Reintentar</Button>
            </CenterMsg>
          ) : !ready ? (
            <CenterMsg icon={<Spinner className="h-7 w-7" />} title="Preparando el paquete SCORM…" />
          ) : (
            <>
              {/* Misma estructura para todos los dispositivos: así el iframe no se vuelve a montar (ni reinicia la sesión) al cambiar de vista */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={isFrame ? { width: outerW * scale, height: outerH * scale } : { width: '100%', height: '100%' }} className="relative flex-none">
                  <div
                    className={clsx('absolute left-0 top-0 origin-top-left', isFrame && 'bg-slate-900 shadow-2xl ring-1 ring-black/20 dark:bg-black dark:ring-white/10', isFrame && (device === 'mobile' ? 'rounded-[36px]' : 'rounded-[28px]'))}
                    style={isFrame ? { width: outerW, height: outerH, padding: bezel, transform: `scale(${scale})` } : { width: '100%', height: '100%' }}
                  >
                    <div className={clsx('h-full w-full overflow-hidden bg-white', isFrame && (device === 'mobile' ? 'rounded-[24px]' : 'rounded-[12px]'))}>{iframe}</div>
                  </div>
                </div>
              </div>
              {(frameLoading || frameError) && (
                <div className="absolute inset-0 bg-slate-100/80 backdrop-blur-[1px] dark:bg-slate-950/80">
                  {frameError ? (
                    <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-red-500" />} title="No se pudo cargar el curso">
                      <p>{frameError}</p>
                      <Button className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => relaunch()}>Reintentar</Button>
                    </CenterMsg>
                  ) : (
                    <CenterMsg icon={<Spinner className="h-7 w-7" />} title="Cargando curso…" />
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Panel del simulador */}
        {panelOpen && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 md:static md:w-[380px] md:shadow-none">
            <LmsPanel
              sim={sim}
              snap={snap}
              screenCount={screenCount}
              onClose={() => setPanelOpen(false)}
              onRelaunch={() => relaunch('Sesión finalizada (LMSFinish). Se abrió una nueva sesión.')}
              onReset={resetAttempt}
              onCopy={copyCmi}
              disabled={!ready}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function CenterMsg({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-3">{icon}</div>
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

/* ================================ Panel ================================ */

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function LmsPanel({ sim, snap, screenCount, onClose, onRelaunch, onReset, onCopy, disabled }: {
  sim: Scorm12Simulator;
  snap: SimulatorSnapshot;
  screenCount: number;
  onClose(): void;
  onRelaunch(): void;
  onReset(): void;
  onCopy(): void;
  disabled: boolean;
}) {
  const c = snap.cmi;
  const running = snap.state === 'running';
  const now = useNow(running);
  const sessionMs = snap.initializedAt ? (snap.finishedAt ?? now) - snap.initializedAt : 0;
  const { visited, parsed } = useMemo(() => visitedFromSuspend(c.suspend_data), [c.suspend_data]);
  const visitedCount = screenCount ? visited.filter((i) => i >= 0 && i < screenCount).length : visited.length;
  const pct = screenCount ? Math.round((visitedCount / screenCount) * 100) : 0;
  const st = STATUS_STYLE[c.core.lesson_status] || { color: 'slate' as const, label: c.core.lesson_status };
  const ss = SESSION_STATE[snap.state];

  return (
    <>
      <div className="flex flex-none items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <Server className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h2 className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">Simulador LMS (SCORM 1.2)</h2>
        <Badge color={ss.color}>{running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}{ss.label}</Badge>
        <IconButton title="Ocultar panel" onClick={onClose}><X className="h-4 w-4" /></IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
          <Button size="sm" variant="primary" className="col-span-2" icon={<LogOut className="h-4 w-4" />} onClick={onRelaunch} disabled={disabled}>
            Finalizar sesión y reabrir
          </Button>
          <Button size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={onReset} disabled={disabled}>Reiniciar intento</Button>
          <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={onCopy}>Copiar datos CMI</Button>
          <p className="col-span-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
            Sesión n.º {snap.session} · {snap.sessionsStored} {snap.sessionsStored === 1 ? 'sesión guardada' : 'sesiones guardadas'}
            {snap.savedAt && <> · último guardado {new Date(snap.savedAt).toLocaleTimeString('es-AR')}</>}
            {snap.dirty && <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">· cambios sin LMSCommit</span>}
          </p>
        </div>

        {/* Resumen */}
        <Section title="Estado del alumno" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Estado (lesson_status)">
              <Badge color={st.color} className="mt-0.5">{st.label}</Badge>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400">{c.core.lesson_status}</div>
            </Stat>
            <Stat label="Puntaje (raw)">
              <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{c.core.score.raw === '' ? '—' : c.core.score.raw}</div>
              <div className="font-mono text-[11px] text-slate-400">
                min {c.core.score.min || '—'} · max {c.core.score.max || '—'}{snap.masteryScore != null && <> · mínimo {snap.masteryScore}</>}
              </div>
            </Stat>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Progreso (pantallas visitadas)</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{visitedCount}/{screenCount || '?'} · {pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-brand-600 transition-all dark:bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Section>

        <Section title="Sesión" icon={<Clock className="h-3.5 w-3.5" />}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
            <KV k="Tiempo de sesión" v={<span className="tabular-nums">{snap.initializedAt ? fmtElapsed(sessionMs) : '—'}</span>} />
            <KV k="total_time" v={c.core.total_time} mono />
            <KV k="Lesson location" v={c.core.lesson_location || '—'} mono icon={<MapPin className="h-3 w-3" />} />
            <KV k="session_time" v={c.core.session_time || '—'} mono />
            <KV k="Entry" v={c.core.entry === '' ? '(vacío)' : c.core.entry} mono highlight={c.core.entry === 'resume'} />
            <KV k="Exit" v={c.core.exit || (snap.lastExit != null ? `${snap.lastExit || '(vacío)'} (anterior)` : '—')} mono />
            <KV k="lesson_mode / credit" v="normal / credit" mono />
            <KV k="Alumno" v={<span title={snap.learner.id}>{snap.learner.name} <span className="text-slate-400">({snap.learner.id})</span></span>} icon={<UserIcon className="h-3 w-3" />} />
          </dl>
        </Section>

        <SuspendSection raw={c.suspend_data} parsed={parsed} />

        <Section title={`Interacciones (${c.interactions.length})`} icon={<ListChecks className="h-3.5 w-3.5" />}>
          {c.interactions.length === 0 ? (
            <p className="text-xs text-slate-400">El curso todavía no registró respuestas (cmi.interactions).</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-1 font-semibold">#</th>
                    <th className="px-1 py-1 font-semibold">id / tipo</th>
                    <th className="px-1 py-1 font-semibold">Respuesta</th>
                    <th className="px-4 py-1 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {c.interactions.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="px-4 py-1.5 tabular-nums text-slate-400">{i}</td>
                      <td className="max-w-[120px] px-1 py-1.5">
                        <div className="truncate font-mono" title={it.id}>{it.id || '—'}</div>
                        <div className="text-slate-400">{it.type || '—'}{it.weighting && ` · peso ${it.weighting}`}</div>
                      </td>
                      <td className="max-w-[110px] px-1 py-1.5"><div className="truncate font-mono" title={it.student_response}>{it.student_response || '—'}</div></td>
                      <td className="px-4 py-1.5">
                        <Badge color={it.result === 'correct' ? 'green' : it.result === 'wrong' ? 'red' : 'slate'}>{it.result === 'correct' ? 'correcta' : it.result === 'wrong' ? 'incorrecta' : it.result || '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <CallLog sim={sim} />
      </div>
    </>
  );
}

function Section({ title, icon, children, right }: { title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span>
        <h3 className="panel-title flex-1">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function KV({ k, v, mono, icon, highlight }: { k: string; v: ReactNode; mono?: boolean; icon?: ReactNode; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">{icon}{k}</dt>
      <dd className={clsx('truncate text-slate-800 dark:text-slate-100', mono && 'font-mono', highlight && 'font-semibold text-emerald-700 dark:text-emerald-400')}>{v}</dd>
    </div>
  );
}

function SuspendSection({ raw, parsed }: { raw: string; parsed: any }) {
  const [mode, setMode] = useState<'json' | 'raw'>('json');
  const len = raw.length;
  const ratio = Math.min(1, len / 4096);
  return (
    <Section
      title="Suspend data"
      icon={<Database className="h-3.5 w-3.5" />}
      right={
        <div className="flex rounded-md border border-slate-200 p-0.5 text-[11px] dark:border-slate-700">
          {(['json', 'raw'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={clsx('rounded px-1.5 py-0.5 font-medium', mode === m ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500')}>
              {m === 'json' ? 'JSON' : 'Crudo'}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={clsx('h-full rounded-full', ratio > 0.9 ? 'bg-red-500' : ratio > 0.7 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">{len.toLocaleString('es-AR')} / 4.096 caracteres</span>
      </div>
      {len === 0 ? (
        <p className="text-xs text-slate-400">Vacío.</p>
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
          {mode === 'json' && parsed ? JSON.stringify(parsed, null, 2) : raw}
        </pre>
      )}
      {mode === 'json' && len > 0 && !parsed && <p className="mt-1 text-[11px] text-amber-600">No es JSON válido; se muestra el texto crudo.</p>}
    </Section>
  );
}

function fmtTime(t: number) {
  const d = new Date(t);
  return d.toLocaleTimeString('es-AR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function CallLog({ sim }: { sim: Scorm12Simulator }) {
  const [hideGets, setHideGets] = useState(true);
  const [limit, setLimit] = useState(150);
  const all = sim.getLog();
  const rows: LmsLogEntry[] = [];
  for (let i = all.length - 1; i >= 0 && rows.length < limit; i--) {
    const e = all[i];
    if (hideGets && e.fn === 'LMSGetValue' && e.errorCode === '0') continue;
    rows.push(e);
  }
  const errors = all.filter((e) => e.errorCode !== '0').length;
  return (
    <Section
      title={`Llamadas a la API (${all.length})`}
      icon={<ScrollText className="h-3.5 w-3.5" />}
      right={<IconButton title="Limpiar registro" className="h-6 w-6" onClick={() => sim.clearLog()}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Switch checked={hideGets} onChange={setHideGets} label={<span className="text-xs">Ocultar LMSGetValue</span>} />
        {errors > 0 && <Badge color="red">{errors} con error</Badge>}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Sin llamadas todavía.</p>
      ) : (
        <ol className="-mx-4 font-mono text-[11px]">
          {rows.map((e) => {
            const marker = e.fn.startsWith('—');
            return (
              <li key={e.id} className={clsx('border-t border-slate-100 px-4 py-1 dark:border-slate-800', marker && 'bg-slate-50 text-center font-sans font-medium text-slate-500 dark:bg-slate-800/60', e.errorCode !== '0' && 'bg-red-50/70 dark:bg-red-900/20')}>
                {marker ? (
                  <>{e.fn.replace(/—/g, '').trim()} · {fmtTime(e.time)}</>
                ) : (
                  <div className="flex gap-2">
                    <span className="flex-none text-slate-400">{fmtTime(e.time).slice(0, 8)}</span>
                    <span className="min-w-0 flex-1 break-all">
                      <span className={clsx('font-semibold', e.fn === 'LMSSetValue' ? 'text-brand-700 dark:text-brand-300' : e.fn === 'LMSGetValue' ? 'text-slate-600 dark:text-slate-300' : 'text-violet-700 dark:text-violet-300')}>{e.fn.slice(3)}</span>
                      <span className="text-slate-500">(</span>
                      <span className="text-slate-700 dark:text-slate-200">{e.args.map((a) => JSON.stringify(a.length > 120 ? a.slice(0, 120) + '…' : a)).join(', ')}</span>
                      <span className="text-slate-500">)</span>
                      <span className="text-slate-400"> → </span>
                      <span className="text-emerald-700 dark:text-emerald-400">{JSON.stringify(e.result.length > 80 ? e.result.slice(0, 80) + '…' : e.result)}</span>
                      {e.errorCode !== '0' && <span className="ml-1 font-sans font-semibold text-red-600 dark:text-red-400" title={sim.LMSGetErrorString(e.errorCode)}>error {e.errorCode} · {sim.LMSGetErrorString(e.errorCode)}</span>}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {rows.length >= limit && (
        <Button size="xs" variant="ghost" className="mt-2 w-full" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setLimit((l) => l + 300)}>Ver más</Button>
      )}
    </Section>
  );
}
