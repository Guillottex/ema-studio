import { useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, MoreHorizontal, Folder, BookOpen, Monitor, Copy, Pencil, Trash2, GripVertical, FilePlus2, FolderPlus } from 'lucide-react';
import { LAYOUTS, layoutThumbSvg } from '@engine';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { Button, Field, Input, Modal, confirmDialog, promptDialog, useMenu, Tabs } from '../components/ui';
import { useEditor, reloadTree, openScreen, saveNow, mutate, type TreeModule } from './store';

type DragKind = 'module' | 'lesson' | 'screen';
interface DragInfo { kind: DragKind; id: string }
let drag: DragInfo | null = null;

function structureOf(tree: TreeModule[]) {
  return { modules: tree.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => ({ id: l.id, screens: l.screens.map((s) => s.id) })) })) };
}

export function StructureTree() {
  const tree = useEditor((s) => s.tree);
  const courseId = useEditor((s) => s.courseId);
  const screenId = useEditor((s) => s.screenId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const [newScreenFor, setNewScreenFor] = useState<{ lessonId: string; afterId?: string } | null>(null);
  const menu = useMenu();

  const persist = async (next: TreeModule[]) => {
    useEditor.setState({ tree: next });
    try {
      const t = await api.put<TreeModule[]>(`/courses/${courseId}/structure`, structureOf(next));
      useEditor.setState({ tree: t });
    } catch (e) {
      toast.error(e);
      reloadTree();
    }
  };

  /* ------------------------------ drag & drop ------------------------------ */

  const onDragOver = (e: React.DragEvent, kind: DragKind, id: string) => {
    if (!drag || drag.id === id) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    let pos: 'before' | 'after' | 'inside' | null = null;
    if (drag.kind === kind) pos = half;
    else if ((drag.kind === 'screen' && kind === 'lesson') || (drag.kind === 'lesson' && kind === 'module')) pos = 'inside';
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    if (dropHint?.id !== id || dropHint.pos !== pos) setDropHint({ id, pos });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const d = drag;
    const hint = dropHint;
    setDropHint(null);
    drag = null;
    if (!d || !hint) return;
    const t: TreeModule[] = JSON.parse(JSON.stringify(tree));
    if (d.kind === 'module') {
      const from = t.findIndex((m) => m.id === d.id);
      const [m] = t.splice(from, 1);
      let to = t.findIndex((x) => x.id === hint.id);
      if (hint.pos === 'after') to++;
      t.splice(to, 0, m);
    } else if (d.kind === 'lesson') {
      const src = t.find((m) => m.lessons.some((l) => l.id === d.id))!;
      const [l] = src.lessons.splice(src.lessons.findIndex((x) => x.id === d.id), 1);
      if (hint.pos === 'inside') t.find((m) => m.id === hint.id)!.lessons.push(l);
      else {
        const dst = t.find((m) => m.lessons.some((x) => x.id === hint.id))!;
        let to = dst.lessons.findIndex((x) => x.id === hint.id);
        if (hint.pos === 'after') to++;
        dst.lessons.splice(to, 0, l);
      }
    } else {
      const lessons = t.flatMap((m) => m.lessons);
      const src = lessons.find((l) => l.screens.some((s) => s.id === d.id))!;
      const [s] = src.screens.splice(src.screens.findIndex((x) => x.id === d.id), 1);
      if (hint.pos === 'inside') lessons.find((l) => l.id === hint.id)!.screens.push(s);
      else {
        const dst = lessons.find((l) => l.screens.some((x) => x.id === hint.id))!;
        let to = dst.screens.findIndex((x) => x.id === hint.id);
        if (hint.pos === 'after') to++;
        dst.screens.splice(to, 0, s);
      }
    }
    persist(t);
  };

  const dragProps = (kind: DragKind, id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.stopPropagation(); drag = { kind, id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); },
    onDragEnd: () => { drag = null; setDropHint(null); },
    onDragOver: (e: React.DragEvent) => onDragOver(e, kind, id),
    onDrop,
  });

  const hintClass = (id: string) => dropHint?.id === id ? (dropHint.pos === 'before' ? 'shadow-[inset_0_2px_0_#2447ea]' : dropHint.pos === 'after' ? 'shadow-[inset_0_-2px_0_#2447ea]' : 'bg-brand-50 ring-1 ring-brand-400 dark:bg-brand-900/30') : '';

  /* ------------------------------ acciones ------------------------------ */

  const addModule = async () => {
    const title = await promptDialog({ title: 'Nuevo módulo', label: 'Nombre del módulo', value: `Módulo ${tree.length + 1}` });
    if (!title) return;
    await saveNow();
    await api.post(`/courses/${courseId}/modules`, { title });
    const t = await reloadTree();
    const m = t[t.length - 1];
    const first = m?.lessons[0]?.screens[0];
    if (first) openScreen(first.id);
  };

  const addLesson = async (moduleId: string, afterId?: string) => {
    const mod = tree.find((m) => m.id === moduleId);
    const title = await promptDialog({ title: 'Nueva lección', label: 'Nombre de la lección', value: `Lección ${(mod?.lessons.length || 0) + 1}` });
    if (!title) return;
    const r = await api.post(`/modules/${moduleId}/lessons`, { title, afterId });
    const t = await reloadTree();
    const l = t.flatMap((m) => m.lessons).find((x) => x.id === r.id);
    if (l?.screens[0]) openScreen(l.screens[0].id);
  };

  const rename = async (kind: DragKind, id: string, current: string) => {
    const title = await promptDialog({ title: 'Renombrar', label: 'Nombre', value: current });
    if (!title || title === current) return;
    if (kind === 'screen') {
      if (useEditor.getState().screenId === id) {
        mutate((s) => { s.title = title; });
        await saveNow();
      } else await api.patch(`/screens/${id}`, { title });
    } else await api.patch(`/${kind === 'module' ? 'modules' : 'lessons'}/${id}`, { title });
    reloadTree();
  };

  const duplicate = async (kind: DragKind, id: string) => {
    await saveNow();
    const r = await api.post(`/${kind === 'module' ? 'modules' : kind === 'lesson' ? 'lessons' : 'screens'}/${id}/duplicate`);
    await reloadTree();
    if (kind === 'screen') openScreen(r.id);
    toast.success('Duplicado');
  };

  const remove = async (kind: DragKind, id: string, title: string) => {
    const what = kind === 'module' ? 'el módulo' : kind === 'lesson' ? 'la lección' : 'la pantalla';
    if (!(await confirmDialog({ title: `Eliminar ${what}`, message: <>¿Eliminar {what} <b>“{title}”</b>{kind !== 'screen' ? ' con todo su contenido' : ''}? Esta acción no se puede deshacer.</>, danger: true, confirmText: 'Eliminar' }))) return;
    await api.del(`/${kind === 'module' ? 'modules' : kind === 'lesson' ? 'lessons' : 'screens'}/${id}`);
    const t = await reloadTree();
    const all = t.flatMap((m) => m.lessons.flatMap((l) => l.screens));
    if (!all.some((s) => s.id === useEditor.getState().screenId)) {
      useEditor.setState({ screenId: null, screen: null, saveState: 'idle' });
      if (all[0]) openScreen(all[0].id);
    }
  };

  const nodeMenu = (e: React.MouseEvent, kind: DragKind, id: string, title: string, extra: { label: string; icon: any; onClick(): void }[] = []) =>
    menu.open(e, [
      ...extra.map((x) => ({ ...x })),
      ...(extra.length ? [{ divider: true }] : []),
      { label: 'Renombrar', icon: <Pencil />, onClick: () => rename(kind, id, title) },
      { label: 'Duplicar', icon: <Copy />, onClick: () => duplicate(kind, id) },
      { divider: true },
      { label: 'Eliminar', icon: <Trash2 />, danger: true, onClick: () => remove(kind, id, title) },
    ]);

  let screenCounter = 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="panel-title">Estructura del curso</span>
        <button className="btn btn-ghost btn-xs" onClick={addModule}><FolderPlus className="h-3.5 w-3.5" />Módulo</button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6 text-[13px]">
        {tree.map((m, mi) => (
          <div key={m.id} className="mb-1">
            <div {...dragProps('module', m.id)} className={clsx('group flex items-center gap-1 rounded-md px-1 py-1.5 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800', hintClass(m.id))}
              onContextMenu={(e) => nodeMenu(e, 'module', m.id, m.title, [{ label: 'Agregar lección', icon: <Plus />, onClick: () => addLesson(m.id) }])}>
              <GripVertical className="h-3.5 w-3.5 flex-none cursor-grab text-slate-300 opacity-0 group-hover:opacity-100" />
              <button className="icon-btn h-5 w-5" onClick={() => setCollapsed((c) => ({ ...c, [m.id]: !c[m.id] }))} aria-label="Expandir/contraer"><ChevronRight className={clsx('h-3.5 w-3.5 transition-transform', !collapsed[m.id] && 'rotate-90')} /></button>
              <Folder className="h-4 w-4 flex-none text-amber-500" />
              <span className="min-w-0 flex-1 truncate" onDoubleClick={() => rename('module', m.id, m.title)}>{mi + 1}. {m.title}</span>
              <button className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" title="Agregar lección" onClick={() => addLesson(m.id)}><Plus className="h-3.5 w-3.5" /></button>
              <button className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" title="Más acciones" onClick={(e) => nodeMenu(e, 'module', m.id, m.title, [{ label: 'Agregar lección', icon: <Plus />, onClick: () => addLesson(m.id) }])}><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </div>
            {!collapsed[m.id] && m.lessons.map((l) => (
              <div key={l.id} className="ml-4">
                <div {...dragProps('lesson', l.id)} className={clsx('group flex items-center gap-1 rounded-md px-1 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800', hintClass(l.id))}
                  onContextMenu={(e) => nodeMenu(e, 'lesson', l.id, l.title, [{ label: 'Agregar pantalla', icon: <FilePlus2 />, onClick: () => setNewScreenFor({ lessonId: l.id }) }])}>
                  <button className="icon-btn h-5 w-5" onClick={() => setCollapsed((c) => ({ ...c, [l.id]: !c[l.id] }))} aria-label="Expandir/contraer"><ChevronRight className={clsx('h-3.5 w-3.5 transition-transform', !collapsed[l.id] && 'rotate-90')} /></button>
                  <BookOpen className="h-3.5 w-3.5 flex-none text-sky-500" />
                  <span className="min-w-0 flex-1 truncate" onDoubleClick={() => rename('lesson', l.id, l.title)}>{l.title}</span>
                  <button className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" title="Agregar pantalla" onClick={() => setNewScreenFor({ lessonId: l.id })}><Plus className="h-3.5 w-3.5" /></button>
                  <button className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" title="Más acciones" onClick={(e) => nodeMenu(e, 'lesson', l.id, l.title, [{ label: 'Agregar pantalla', icon: <FilePlus2 />, onClick: () => setNewScreenFor({ lessonId: l.id }) }])}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                </div>
                {!collapsed[l.id] && l.screens.map((s) => {
                  screenCounter++;
                  const n = screenCounter;
                  return (
                    <div key={s.id} {...dragProps('screen', s.id)}
                      className={clsx('group ml-5 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-slate-600 dark:text-slate-400', screenId === s.id ? 'bg-brand-100 font-medium text-brand-800 dark:bg-brand-900/50 dark:text-brand-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800', hintClass(s.id))}
                      onClick={() => openScreen(s.id)}
                      onContextMenu={(e) => nodeMenu(e, 'screen', s.id, s.title, [{ label: 'Insertar pantalla después', icon: <FilePlus2 />, onClick: () => setNewScreenFor({ lessonId: l.id, afterId: s.id }) }])}>
                      <span className="w-5 flex-none text-right text-[10px] tabular-nums text-slate-400">{n}</span>
                      <Monitor className="h-3.5 w-3.5 flex-none" />
                      <span className="min-w-0 flex-1 truncate" onDoubleClick={() => rename('screen', s.id, s.title)}>{s.title}</span>
                      {s.component_count === 0 && <span className="h-1.5 w-1.5 flex-none rounded-full bg-amber-500" title="Pantalla vacía" />}
                      <button className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100" title="Más acciones" onClick={(e) => { e.stopPropagation(); nodeMenu(e, 'screen', s.id, s.title, [{ label: 'Insertar pantalla después', icon: <FilePlus2 />, onClick: () => setNewScreenFor({ lessonId: l.id, afterId: s.id }) }]); }}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
                {!collapsed[l.id] && (
                  <button className="ml-5 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => setNewScreenFor({ lessonId: l.id })}>
                    <Plus className="h-3.5 w-3.5" />Agregar pantalla
                  </button>
                )}
              </div>
            ))}
            {!collapsed[m.id] && (
              <button className="ml-6 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => addLesson(m.id)}>
                <Plus className="h-3.5 w-3.5" />Agregar lección
              </button>
            )}
          </div>
        ))}
        {!tree.length && <div className="p-4 text-center text-xs text-slate-500">El curso no tiene módulos. <button className="text-brand-600 underline" onClick={addModule}>Crear el primero</button></div>}
      </div>
      {menu.node}
      {newScreenFor && <NewScreenDialog {...newScreenFor} onClose={() => setNewScreenFor(null)} />}
    </div>
  );
}

function NewScreenDialog({ lessonId, afterId, onClose }: { lessonId: string; afterId?: string; onClose(): void }) {
  const [title, setTitle] = useState('Nueva pantalla');
  const [tab, setTab] = useState<'layouts' | 'templates'>('layouts');
  const [layout, setLayout] = useState('title-text');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: tpls } = useQuery({ queryKey: ['templates', 'screen'], queryFn: () => api.get<any[]>('/templates?kind=screen') });

  const create = async () => {
    setBusy(true);
    try {
      await saveNow();
      const s = await api.post(`/lessons/${lessonId}/screens`, { title, afterId, ...(tab === 'templates' && templateId ? { templateId } : { layout }) });
      await reloadTree();
      await openScreen(s.id);
      onClose();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Nueva pantalla" description="Elegí un layout o una plantilla de pantalla. Después podés modificar todo libremente."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={create} disabled={!title.trim() || (tab === 'templates' && !templateId)}>Crear pantalla</Button></>}>
      <Field label="Título de la pantalla" className="mb-4"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Tabs tabs={[{ id: 'layouts', label: 'Layouts' }, { id: 'templates', label: `Plantillas (${tpls?.length || 0})` }]} value={tab} onChange={(v) => setTab(v as any)} className="mb-3" />
      {tab === 'layouts' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLayout(l.id)} onDoubleClick={create} title={l.description}
              className={clsx('rounded-lg border p-1.5 text-left', layout === l.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
              <div className="overflow-hidden rounded" dangerouslySetInnerHTML={{ __html: layoutThumbSvg(l) }} />
              <div className="mt-1 text-xs font-medium">{l.name}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {(tpls || []).map((t) => (
            <button key={t.id} type="button" onClick={() => setTemplateId(t.id)}
              className={clsx('rounded-lg border px-3 py-2.5 text-left text-sm', templateId === t.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-slate-500">{t.description || `${t.summary?.components ?? 0} componentes`}</div>
            </button>
          ))}
          {!tpls?.length && <p className="text-sm text-slate-500">Todavía no hay plantillas de pantalla. Guardá una desde el panel de propiedades de la pantalla.</p>}
        </div>
      )}
    </Modal>
  );
}
