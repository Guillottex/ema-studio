import { useEffect, useState } from 'react';
import '@engine-css';
import './fonts';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, Undo2, Redo2, Monitor, Tablet, Smartphone, ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, Eye, PlayCircle, ShieldCheck, History,
  Settings2, Download, FileJson, PackageCheck, Check, Loader2, AlertCircle, CloudOff, Layers, Shapes, LayoutTemplate, Keyboard,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { fmtTime } from '../lib/format';
import { Badge, Dropdown, Modal, PageLoader, confirmDialog } from '../components/ui';
import {
  useEditor, loadCourse, openScreen, saveNow, flushOnUnload, undo, redo, deleteSelected, duplicateSelected, copySelected, paste, select,
  restoreBackup, editableBp, setBoxes, boxOf, reloadTree,
} from './store';
import { Canvas } from './Canvas';
import { StructureTree } from './StructureTree';
import { Palette, LayoutsPanel } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { CourseSettingsDialog } from './dialogs/CourseSettingsDialog';
import { ValidateDialog } from './dialogs/ValidateDialog';
import { ExportScormDialog } from './dialogs/ExportScormDialog';
import { VersionsDialog } from './dialogs/VersionsDialog';

function SaveIndicator() {
  const st = useEditor((s) => s.saveState);
  const at = useEditor((s) => s.lastSavedAt);
  const err = useEditor((s) => s.saveError);
  if (st === 'saving') return <span className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando...</span>;
  if (st === 'dirty') return <span className="flex items-center gap-1.5 text-xs text-amber-600"><CloudOff className="h-3.5 w-3.5" />Cambios sin guardar</span>;
  if (st === 'error') return <button className="flex items-center gap-1.5 text-xs text-red-600 hover:underline" title={err} onClick={() => { useEditor.setState({ saveState: 'dirty' }); saveNow(); }}><AlertCircle className="h-3.5 w-3.5" />Error al guardar · Reintentar</button>;
  if (st === 'saved') return <span className="flex items-center gap-1.5 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" />Guardado{at ? ` · Último guardado: ${fmtTime(at)}` : ''}</span>;
  return <span className="text-xs text-slate-400">Guardado automático activado</span>;
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + Z / Ctrl + Y', 'Deshacer / rehacer'], ['Ctrl + C / X / V', 'Copiar / cortar / pegar'], ['Ctrl + D', 'Duplicar'], ['Supr', 'Eliminar'],
  ['Flechas', 'Mover 1 px (Shift: 10 px)'], ['Ctrl + A', 'Seleccionar todo'], ['Esc', 'Quitar selección'], ['Doble clic', 'Editar texto en el lienzo'],
  ['Shift + clic', 'Selección múltiple'], ['Alt al arrastrar', 'Desactivar imán'], ['Shift al redimensionar', 'Mantener proporción'], ['Ctrl + S', 'Guardar ahora'],
];

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const course = useEditor((s) => s.course);
  const tree = useEditor((s) => s.tree);
  const bp = useEditor((s) => s.bp);
  const zoom = useEditor((s) => s.zoom);
  const zoomMode = useEditor((s) => s.zoomMode);
  const showGrid = useEditor((s) => s.showGrid);
  const snap = useEditor((s) => s.snap);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const leftTab = useEditor((s) => s.leftTab);
  const screenId = useEditor((s) => s.screenId);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<null | 'settings' | 'validate' | 'export' | 'versions' | 'shortcuts'>(null);

  // carga inicial
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    loadCourse(id)
      .then(async ({ tree }) => {
        if (!alive) return;
        const all = tree.flatMap((m) => m.lessons.flatMap((l) => l.screens));
        const wanted = params.get('pantalla');
        const first = (wanted && all.find((s) => s.id === wanted)) || all[0];
        if (first) {
          const r = await openScreen(first.id);
          if (r?.recoverable) {
            const ok = await confirmDialog({ title: 'Recuperar cambios', message: `Encontramos cambios de esta pantalla que no llegaron a guardarse (${new Date(r.recoverable.at).toLocaleString('es-AR')}). ¿Querés recuperarlos?`, confirmText: 'Recuperar' });
            if (ok) restoreBackup(r.recoverable);
            else localStorage.removeItem(`ema-draft:${first.id}`);
          }
        }
      })
      .catch((e) => { toast.error(e); nav('/cursos'); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; saveNow(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // mantener ?pantalla= en la URL
  useEffect(() => {
    if (screenId && params.get('pantalla') !== screenId) setParams({ pantalla: screenId }, { replace: true });
  }, [screenId]); // eslint-disable-line react-hooks/exhaustive-deps

  // evitar pérdida de datos al cerrar
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (flushOnUnload()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, []);

  // atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]'))) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const st = useEditor.getState();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (mod && k === 's') { e.preventDefault(); saveNow().then(() => toast.success('Guardado')); }
      else if (mod && k === 'c') { e.preventDefault(); copySelected(); }
      else if (mod && k === 'x') { e.preventDefault(); copySelected(true); }
      else if (mod && k === 'v') { e.preventDefault(); paste(); }
      else if (mod && k === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (mod && k === 'a') { e.preventDefault(); select(st.screen?.components.map((c) => c.id) || []); }
      else if (k === 'delete' || k === 'backspace') { if (st.selected.length) { e.preventDefault(); deleteSelected(); } }
      else if (k === 'escape') select([]);
      else if (k.startsWith('arrow') && st.selected.length && st.screen) {
        const eb = editableBp(st.screen, st.bp);
        if (!eb) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        const up: Record<string, any> = {};
        st.screen.components.filter((c) => st.selected.includes(c.id) && !c.locked).forEach((c) => { const b = boxOf(c, eb); up[c.id] = { x: b.x + dx, y: b.y + dy }; });
        setBoxes(up, eb, !e.repeat);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!can('courses.edit')) return <Navigate to={`/cursos/${id}/preview`} replace />;
  if (loading || !course) return <div className="h-full"><PageLoader /></div>;

  const setZoom = (z: number) => useEditor.setState({ zoom: Math.max(0.2, Math.min(2, Math.round(z * 100) / 100)), zoomMode: 'manual' });
  const preview = async (screen?: boolean) => {
    await saveNow();
    window.open(`/cursos/${id}/preview${screen && screenId ? `?pantalla=${screenId}` : ''}`, '_blank');
  };
  const exportJson = async () => {
    await saveNow();
    try { await api.download(`/courses/${id}/export-json`, 'curso-proyecto.json'); } catch (e) { toast.error(e); }
  };
  const goTo = async (sid: string, compId?: string) => {
    const all = tree.flatMap((m) => m.lessons.flatMap((l) => l.screens));
    if (!all.some((s) => s.id === sid)) return;
    await openScreen(sid);
    if (compId) select([compId]);
  };
  const totalScreens = tree.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.screens.length, 0), 0);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* barra superior */}
      <header className="flex h-14 flex-none items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800">
        <Link to="/cursos" className="icon-btn" title="Volver a cursos" onClick={() => saveNow()}><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 max-w-[260px]">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{course.title}</span>
            <Badge color={course.status === 'published' ? 'green' : 'amber'}>{course.status === 'published' ? 'Publicado' : 'Borrador'}</Badge>
          </div>
          <SaveIndicator />
        </div>
        <div className="mx-2 h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <button className="icon-btn" title="Deshacer (Ctrl+Z)" disabled={!past} onClick={undo}><Undo2 className="h-4 w-4" /></button>
        <button className="icon-btn" title="Rehacer (Ctrl+Y)" disabled={!future} onClick={redo}><Redo2 className="h-4 w-4" /></button>
        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {([['desktop', Monitor, 'Escritorio'], ['tablet', Tablet, 'Tablet'], ['mobile', Smartphone, 'Celular']] as const).map(([b, I, l]) => (
            <button key={b} title={l} onClick={() => useEditor.setState({ bp: b, selected: [], zoomMode: 'fit', editingId: null })}
              className={clsx('flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium', bp === b ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500')}>
              <I className="h-3.5 w-3.5" /><span className="hidden xl:inline">{l}</span>
            </button>
          ))}
        </div>
        <div className="hidden items-center md:flex">
          <button className="icon-btn" title="Alejar" onClick={() => setZoom(zoom - 0.1)}><ZoomOut className="h-4 w-4" /></button>
          <button className="w-12 text-center text-xs tabular-nums text-slate-500" title="Ajustar a la ventana" onClick={() => useEditor.setState({ zoomMode: 'fit' })}>{Math.round(zoom * 100)}%</button>
          <button className="icon-btn" title="Acercar" onClick={() => setZoom(zoom + 0.1)}><ZoomIn className="h-4 w-4" /></button>
          <button className={clsx('icon-btn', zoomMode === 'fit' && 'is-active')} title="Ajustar" onClick={() => useEditor.setState({ zoomMode: 'fit' })}><Maximize className="h-4 w-4" /></button>
          <button className={clsx('icon-btn', showGrid && 'is-active')} title="Cuadrícula" onClick={() => useEditor.setState({ showGrid: !showGrid })}><Grid3x3 className="h-4 w-4" /></button>
          <button className={clsx('icon-btn', snap && 'is-active')} title="Imán y guías de alineación" onClick={() => useEditor.setState({ snap: !snap })}><Magnet className="h-4 w-4" /></button>
          <button className="icon-btn" title="Atajos de teclado" onClick={() => setDialog('shortcuts')}><Keyboard className="h-4 w-4" /></button>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={() => preview(true)} title="Previsualizar esta pantalla"><Eye className="h-4 w-4" /><span className="hidden 2xl:inline">Pantalla</span></button>
        <button className="btn btn-secondary btn-sm" onClick={() => preview(false)}><PlayCircle className="h-4 w-4" /><span className="hidden lg:inline">Previsualizar curso</span></button>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await saveNow(); setDialog('validate'); }}><ShieldCheck className="h-4 w-4" /><span className="hidden xl:inline">Validar</span></button>
        <button className="icon-btn" title="Versiones" onClick={async () => { await saveNow(); setDialog('versions'); }}><History className="h-4 w-4" /></button>
        <button className="icon-btn" title="Configuración del curso" onClick={() => setDialog('settings')}><Settings2 className="h-4 w-4" /></button>
        <Dropdown trigger={(o) => <button className="btn btn-primary btn-sm" onClick={o}><Download className="h-4 w-4" />Exportar</button>}
          items={[
            { label: 'Exportar SCORM 1.2 (.zip)', icon: <PackageCheck />, onClick: async () => { await saveNow(); setDialog('export'); }, disabled: !can('courses.export') },
            { label: 'Exportar proyecto editable (.json)', icon: <FileJson />, onClick: exportJson },
          ]} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* panel izquierdo */}
        <aside className="flex w-[272px] flex-none flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800">
            {([['structure', Layers, 'Estructura'], ['components', Shapes, 'Componentes'], ['layouts', LayoutTemplate, 'Layouts']] as const).map(([t, I, l]) => (
              <button key={t} onClick={() => useEditor.setState({ leftTab: t })} className={clsx('flex flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] font-medium', leftTab === t ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {leftTab === 'structure' && <StructureTree />}
            {leftTab === 'components' && <Palette />}
            {leftTab === 'layouts' && <LayoutsPanel />}
          </div>
          <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">{tree.length} módulos · {totalScreens} pantallas</div>
        </aside>

        <Canvas />

        {/* panel derecho */}
        <aside className="w-[320px] flex-none overflow-hidden border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <PropertiesPanel />
        </aside>
      </div>

      <CourseSettingsDialog courseId={id!} open={dialog === 'settings'} onClose={() => setDialog(null)} onSaved={(c) => useEditor.setState({ course: c })} />
      <ValidateDialog courseId={id!} open={dialog === 'validate'} onClose={() => setDialog(null)} onGoTo={goTo} />
      <ExportScormDialog courseId={id!} courseTitle={course.title} open={dialog === 'export'} onClose={() => setDialog(null)} />
      <VersionsDialog courseId={id!} currentVersion={course.version} open={dialog === 'versions'} onClose={() => setDialog(null)}
        onRestored={async () => { const c = await api.get(`/courses/${id}`); useEditor.setState({ course: c, screen: null, screenId: null, saveState: 'idle' }); const t = await reloadTree(); const f = t.flatMap((m) => m.lessons.flatMap((l) => l.screens))[0]; if (f) openScreen(f.id); }} />
      <Modal open={dialog === 'shortcuts'} onClose={() => setDialog(null)} title="Atajos de teclado" size="sm">
        <div className="space-y-1.5 text-sm">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex justify-between gap-3"><span className="kbd">{k}</span><span className="text-right text-slate-600 dark:text-slate-300">{d}</span></div>)}</div>
      </Modal>
    </div>
  );
}
