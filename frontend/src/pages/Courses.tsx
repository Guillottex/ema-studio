import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Copy, Download, Eye, FileJson, LayoutGrid, List, MoreVertical, Pencil, Plus, Search, Send, Trash2, Undo2, Upload, Layers, MonitorPlay, Clock, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { fmtDate, fmtRelative } from '../lib/format';
import { Button, clsx, confirmDialog, Empty, IconButton, Input, PageHeader, PageLoader, Select, type MenuItem } from '../components/ui';
import { CategoryBadge, CourseCover, StatusBadge, useCategories, type CourseRow } from './parts/courses-shared';
import { NewCourseModal } from './parts/courses-new-modal';
import { ActionMenu } from './parts/courses-menu';

type View = 'grid' | 'list';
const VIEW_KEY = 'ema-courses-view';

function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function Courses() {
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<View>(readView);
  const dq = useDebounced(q.trim());
  const fileRef = useRef<HTMLInputElement>(null);
  const cats = useCategories();

  const newOpen = params.get('nuevo') === '1' && can('courses.create');
  const openNew = () => setParams((p) => { p.set('nuevo', '1'); return p; });
  const closeNew = () => setParams((p) => { p.delete('nuevo'); return p; }, { replace: true });

  const qs = new URLSearchParams();
  if (dq) qs.set('q', dq);
  if (status) qs.set('status', status);
  if (category) qs.set('category', category);
  const list = useQuery({
    queryKey: ['courses', { q: dq, status, category }],
    queryFn: () => api.get<CourseRow[]>(`/courses${qs.toString() ? '?' + qs : ''}`),
    placeholderData: keepPreviousData,
  });

  const changeView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ } };
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['courses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const duplicate = useMutation({
    mutationFn: (c: CourseRow) => api.post<{ id: string; title: string }>(`/courses/${c.id}/duplicate`),
    onSuccess: (c) => { invalidate(); toast.success(`Se creó “${c.title}”`); },
    onError: (e) => toast.error(e),
  });
  const setStatusM = useMutation({
    mutationFn: (v: { c: CourseRow; status: 'draft' | 'published' }) => api.patch(`/courses/${v.c.id}`, { status: v.status }),
    onSuccess: (_r, v) => { invalidate(); toast.success(v.status === 'published' ? 'Curso publicado' : 'El curso volvió a borrador'); },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: (c: CourseRow) => api.del(`/courses/${c.id}`),
    onSuccess: () => { invalidate(); toast.success('Curso eliminado'); },
    onError: (e) => toast.error(e),
  });
  const importM = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.upload<{ courseId: string; restoredAssets: number; missingAssets: string[] }>('/courses/import', fd); },
    onSuccess: (r) => {
      invalidate();
      const missing = r.missingAssets?.length || 0;
      const restored = r.restoredAssets || 0;
      if (missing) toast.info(`Proyecto importado. Recursos restaurados: ${restored}. Faltan ${missing} recurso(s): revisalos en el editor.`);
      else toast.success(`Proyecto importado${restored ? ` con ${restored} recurso(s) restaurado(s)` : ''}`);
      nav(`/cursos/${r.courseId}/editor`);
    },
    onError: (e) => toast.error(e),
  });

  const exportJson = async (c: CourseRow) => {
    try { await api.download(`/courses/${c.id}/export-json`, `${c.title}-proyecto.json`); toast.success('Proyecto exportado'); }
    catch (e) { toast.error(e); }
  };

  const askDelete = async (c: CourseRow) => {
    const ok = await confirmDialog({
      title: 'Eliminar curso', danger: true, confirmText: 'Eliminar',
      message: <>Se eliminará <b>“{c.title}”</b> con todos sus módulos, pantallas, versiones y exportaciones SCORM. Esta acción no se puede deshacer.</>,
    });
    if (ok) remove.mutate(c);
  };

  const menuItems = (c: CourseRow): MenuItem[] => {
    const items: MenuItem[] = [];
    if (can('courses.edit')) items.push({ label: 'Editar', icon: <Pencil />, onClick: () => nav(`/cursos/${c.id}/editor`) });
    items.push({ label: 'Previsualizar', icon: <Eye />, onClick: () => nav(`/cursos/${c.id}/preview`) });
    if (can('courses.create')) items.push({ label: 'Duplicar', icon: <Copy />, onClick: () => duplicate.mutate(c) });
    if (can('courses.export')) items.push({ label: 'Exportar proyecto (.json)', icon: <FileJson />, onClick: () => exportJson(c) });
    if (can('courses.publish')) {
      items.push(c.status === 'published'
        ? { label: 'Pasar a borrador', icon: <Undo2 />, onClick: () => setStatusM.mutate({ c, status: 'draft' }) }
        : { label: 'Publicar', icon: <Send />, onClick: () => setStatusM.mutate({ c, status: 'published' }) });
    }
    if (can('courses.edit')) items.push({ divider: true }, { label: 'Eliminar', icon: <Trash2 />, danger: true, onClick: () => askDelete(c) });
    return items;
  };

  const open = (c: CourseRow) => nav(can('courses.edit') ? `/cursos/${c.id}/editor` : `/cursos/${c.id}/preview`);
  const rows = list.data || [];
  const filtered = !!(dq || status || category);

  return (
    <div>
      <PageHeader title="Cursos" icon={<BookOpen className="h-5 w-5" />}
        description={list.data ? `${rows.length} curso${rows.length === 1 ? '' : 's'}${filtered ? ' con los filtros aplicados' : ''}` : 'Creá, editá y publicá tus cursos'}
        actions={can('courses.create') && (
          <>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importM.mutate(f); }} />
            <Button icon={<Upload className="h-4 w-4" />} loading={importM.isPending} onClick={() => fileRef.current?.click()}>Importar proyecto (.json)</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openNew}>Nuevo curso</Button>
          </>
        )} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9 pr-8" placeholder="Buscar por nombre, descripción o autor…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" aria-label="Limpiar búsqueda" className="absolute right-2 top-2 text-slate-400 hover:text-slate-600" onClick={() => setQ('')}><X className="h-4 w-4" /></button>}
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {([['', 'Todos'], ['draft', 'Borrador'], ['published', 'Publicado']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStatus(v)}
              className={clsx('rounded-md px-3 py-1.5 text-sm font-medium transition', status === v ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>{l}</button>
          ))}
        </div>
        <Select className="w-auto min-w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)}
          options={[{ value: '', label: 'Todas las categorías' }, ...(cats.data || []).map((c) => ({ value: String(c.id), label: c.name }))]} />
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <IconButton title="Vista en tarjetas" active={view === 'grid'} onClick={() => changeView('grid')} className="h-7 w-7"><LayoutGrid className="h-4 w-4" /></IconButton>
          <IconButton title="Vista en lista" active={view === 'list'} onClick={() => changeView('list')} className="h-7 w-7"><List className="h-4 w-4" /></IconButton>
        </div>
      </div>

      {list.isLoading ? <PageLoader /> : list.isError ? (
        <Empty title="No se pudieron cargar los cursos" action={<Button onClick={() => list.refetch()}>Reintentar</Button>}>{(list.error as Error).message}</Empty>
      ) : rows.length === 0 ? (
        filtered ? (
          <Empty icon={<Search className="h-10 w-10" />} title="No hay cursos que coincidan" action={<Button onClick={() => { setQ(''); setStatus(''); setCategory(''); }}>Limpiar filtros</Button>}>Probá con otra búsqueda o cambiá los filtros.</Empty>
        ) : (
          <Empty icon={<BookOpen className="h-10 w-10" />} title="Todavía no hay cursos"
            action={can('courses.create') && <div className="flex gap-2"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openNew}>Crear el primer curso</Button><Button onClick={() => nav('/generar-ia')}>Generar con IA</Button></div>}>
            Creá un curso en blanco, desde una plantilla o a partir de un documento.
          </Empty>
        )
      ) : view === 'grid' ? (
        <div className={clsx('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 transition-opacity', list.isFetching && 'opacity-70')}>
          {rows.map((c) => (
            <article key={c.id} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
              <button type="button" onClick={() => open(c)} className="relative block aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800" aria-label={`Abrir ${c.title}`}>
                <CourseCover src={c.cover_image} title={c.title} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
                <span className="absolute left-2.5 top-2.5"><StatusBadge status={c.status} /></span>
                <span className="absolute right-2.5 top-2.5 rounded-full bg-slate-900/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">v{c.version}</span>
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-1.5"><CategoryBadge name={c.category} color={c.category_color} /></div>
                <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 dark:text-white" title={c.title}>{c.title}</h3>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{c.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{c.modules} módulo{c.modules === 1 ? '' : 's'}</span>
                  <span className="inline-flex items-center gap-1"><MonitorPlay className="h-3.5 w-3.5" />{c.screens} pantalla{c.screens === 1 ? '' : 's'}</span>
                  <span className="inline-flex items-center gap-1" title={fmtDate(c.updated_at)}><Clock className="h-3.5 w-3.5" />{fmtRelative(c.updated_at)}</span>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-4">
                  {can('courses.edit') ? (
                    <Button size="sm" variant="primary" className="flex-1" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => nav(`/cursos/${c.id}/editor`)}>Editar</Button>
                  ) : null}
                  <Button size="sm" className={clsx(!can('courses.edit') && 'flex-1')} icon={<Eye className="h-3.5 w-3.5" />} onClick={() => nav(`/cursos/${c.id}/preview`)}>Previsualizar</Button>
                  {menuItems(c).length > 2 && (
                    <ActionMenu items={menuItems(c)} trigger={(o) => <IconButton title="Más acciones" onClick={o}><MoreVertical className="h-4 w-4" /></IconButton>} />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={clsx('card overflow-x-auto transition-opacity', list.isFetching && 'opacity-70')}>
          <table className="table-base">
            <thead>
              <tr><th>Curso</th><th className="hidden md:table-cell">Categoría</th><th>Estado</th><th className="hidden lg:table-cell">Contenido</th><th className="hidden sm:table-cell">Modificado</th><th className="w-px" /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => open(c)}>
                      <CourseCover src={c.cover_image} title={c.title} className="h-10 w-16 flex-none rounded-md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300">{c.title}</span>
                        <span className="block text-xs text-slate-500">v{c.version}{c.author ? ` · ${c.author}` : ''}</span>
                      </span>
                    </button>
                  </td>
                  <td className="hidden md:table-cell"><CategoryBadge name={c.category} color={c.category_color} /></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="hidden whitespace-nowrap text-xs text-slate-500 lg:table-cell">{c.modules} mód. · {c.screens} pant.</td>
                  <td className="hidden whitespace-nowrap text-xs text-slate-500 sm:table-cell" title={fmtDate(c.updated_at)}>{fmtRelative(c.updated_at)}{c.updated_by_name ? <span className="block text-slate-400">por {c.updated_by_name}</span> : null}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {can('courses.edit') && <IconButton title="Editar" onClick={() => nav(`/cursos/${c.id}/editor`)}><Pencil className="h-4 w-4" /></IconButton>}
                      <IconButton title="Previsualizar" onClick={() => nav(`/cursos/${c.id}/preview`)}><Eye className="h-4 w-4" /></IconButton>
                      {menuItems(c).length > 2 && <ActionMenu items={menuItems(c)} trigger={(o) => <IconButton title="Más acciones" onClick={o}><MoreVertical className="h-4 w-4" /></IconButton>} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {can('courses.export') && rows.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Download className="h-3.5 w-3.5" />“Exportar proyecto (.json)” genera un respaldo editable con sus recursos, que se puede volver a importar en esta u otra instalación.</p>
      )}

      {can('courses.create') && <NewCourseModal open={newOpen} onClose={closeNew} />}
    </div>
  );
}
