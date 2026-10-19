import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutTemplate, Copy, Pencil, Trash2, Plus, Save, Layers, Shapes, Lock, Info, Rocket, Palette } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { fmtRelative, fmtDate } from '../lib/format';
import { Badge, Button, confirmDialog, Empty, Field, IconButton, Input, Modal, PageHeader, PageLoader, promptDialog, Select, Tabs, Textarea } from '../components/ui';
import { TemplateThumb, ThemePicker, useCourseTemplates, type CourseRow, type TemplateRow } from './parts/courses-shared';

type Tab = 'course' | 'screen';

/* --------------------------- Usar plantilla de curso --------------------------- */

function UseTemplateModal({ tpl, onClose }: { tpl: TemplateRow | null; onClose(): void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [themeId, setThemeId] = useState<string | null>(null);
  useEffect(() => { if (tpl) { setTitle(''); setThemeId(null); } }, [tpl]);

  const create = useMutation({
    mutationFn: () => api.post<{ id: string; title: string }>('/courses', { title: title.trim(), templateId: tpl!.id, themeId }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Curso “${c.title}” creado desde la plantilla`);
      onClose();
      nav(`/cursos/${c.id}/editor`);
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Modal open={!!tpl} onClose={onClose} size="md" title="Usar plantilla" description={tpl ? `Se creará un curso nuevo a partir de “${tpl.name}”.` : undefined}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Rocket className="h-4 w-4" />} loading={create.isPending} disabled={!title.trim()} onClick={() => create.mutate()}>Crear curso</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Nombre del curso *"><Input autoFocus value={title} maxLength={200} placeholder="Ej.: Procedimiento de recepción de envíos" onChange={(e) => setTitle(e.target.value)} /></Field>
        <div>
          <div className="label">Tema visual (opcional)</div>
          <ThemePicker value={themeId} onChange={setThemeId} />
          <p className="mt-1.5 text-[11.5px] text-slate-500">Con “Tema predeterminado” se conserva el diseño original de la plantilla{tpl?.summary?.theme ? ` (${tpl.summary.theme})` : ''}.</p>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------ Guardar curso como plantilla ------------------------ */

function SaveCourseAsTemplateModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ['courses', { q: '', status: '', category: '' }], queryFn: () => api.get<CourseRow[]>('/courses'), enabled: open });
  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personalizada');
  useEffect(() => { if (open) { setCourseId(''); setName(''); setDescription(''); setCategory('Personalizada'); } }, [open]);

  const pick = (id: string) => {
    setCourseId(id);
    const c = courses.data?.find((x) => x.id === id);
    if (c) { if (!name.trim()) setName(c.title); if (!description.trim()) setDescription(c.description || ''); }
  };

  const save = useMutation({
    mutationFn: () => api.post('/templates/from-course', { courseId, name: name.trim(), description: description.trim() || undefined, category: category.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Plantilla de curso guardada'); onClose(); },
    onError: (e) => toast.error(e),
  });
  const valid = !!courseId && !!name.trim();

  return (
    <Modal open={open} onClose={onClose} size="md" title="Guardar curso como plantilla" description="Se copia la estructura, las pantallas y el tema del curso. El curso original no se modifica."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Save className="h-4 w-4" />} loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>Guardar plantilla</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <Field label="Curso de origen *">
          <Select value={courseId} onChange={(e) => pick(e.target.value)}
            options={[{ value: '', label: courses.isLoading ? 'Cargando cursos…' : 'Elegí un curso…' }, ...(courses.data || []).map((c) => ({ value: c.id, label: `${c.title} (v${c.version})` }))]} />
        </Field>
        <Field label="Nombre de la plantilla *"><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descripción"><Textarea rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Categoría" hint="Agrupa la plantilla en la galería (ej.: Procesos, Capacitación)."><Input value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Página ---------------------------------- */

export default function Templates() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('course');
  const [useTpl, setUseTpl] = useState<TemplateRow | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const courseTpls = useCourseTemplates();
  const screenTpls = useQuery({ queryKey: ['templates', 'screen'], queryFn: () => api.get<TemplateRow[]>('/templates?kind=screen') });
  const isAdmin = can('templates.manage');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['templates'] });
  const canModify = (t: TemplateRow) => isAdmin || (t.kind === 'screen' && !t.is_system && t.created_by === user?.id);

  const rename = useMutation({
    mutationFn: (v: { t: TemplateRow; name: string }) => api.patch(`/templates/${v.t.id}`, { name: v.name }),
    onSuccess: () => { invalidate(); toast.success('Plantilla renombrada'); },
    onError: (e) => toast.error(e),
  });
  const duplicate = useMutation({
    mutationFn: (t: TemplateRow) => api.post<{ id: string; name: string }>(`/templates/${t.id}/duplicate`),
    onSuccess: (r) => { invalidate(); toast.success(`Se creó “${r.name}”`); },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: (t: TemplateRow) => api.del(`/templates/${t.id}`),
    onSuccess: () => { invalidate(); toast.success('Plantilla eliminada'); },
    onError: (e) => toast.error(e),
  });

  const askRename = async (t: TemplateRow) => {
    const name = await promptDialog({ title: 'Renombrar plantilla', label: 'Nombre', value: t.name, confirmText: 'Guardar' });
    if (name && name !== t.name) rename.mutate({ t, name });
  };
  const askDelete = async (t: TemplateRow) => {
    const ok = await confirmDialog({ title: 'Eliminar plantilla', danger: true, confirmText: 'Eliminar', message: <>¿Eliminar la plantilla <b>“{t.name}”</b>? Los cursos ya creados con ella no se modifican.</> });
    if (ok) remove.mutate(t);
  };

  const myScreens = (screenTpls.data || []).filter((t) => !t.is_system);
  const systemScreens = (screenTpls.data || []).filter((t) => t.is_system);

  return (
    <div>
      <PageHeader title="Plantillas" icon={<LayoutTemplate className="h-5 w-5" />} description="Puntos de partida reutilizables para cursos y pantallas."
        actions={isAdmin && <Button icon={<Save className="h-4 w-4" />} onClick={() => setSaveOpen(true)}>Guardar curso como plantilla</Button>} />

      <Tabs<Tab> className="mb-5" value={tab} onChange={setTab} tabs={[
        { id: 'course', label: <>Plantillas de curso{courseTpls.data && <span className="ml-1 text-xs text-slate-400">({courseTpls.data.length})</span>}</>, icon: <Layers className="h-4 w-4" /> },
        { id: 'screen', label: <>Mis plantillas de pantalla{screenTpls.data && <span className="ml-1 text-xs text-slate-400">({screenTpls.data.length})</span>}</>, icon: <Shapes className="h-4 w-4" /> },
      ]} />

      {tab === 'course' && (courseTpls.isLoading ? <PageLoader /> : courseTpls.isError ? (
        <Empty title="No se pudieron cargar las plantillas" action={<Button onClick={() => courseTpls.refetch()}>Reintentar</Button>} />
      ) : !courseTpls.data?.length ? (
        <Empty icon={<LayoutTemplate className="h-10 w-10" />} title="No hay plantillas de curso"
          action={isAdmin && <Button icon={<Save className="h-4 w-4" />} onClick={() => setSaveOpen(true)}>Guardar un curso como plantilla</Button>}>
          Las plantillas de curso incluyen estructura de módulos, pantallas de ejemplo y tema visual.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courseTpls.data.map((t) => (
            <article key={t.id} className="card group flex flex-col overflow-hidden">
              <div className="relative">
                <TemplateThumb svg={t.thumbnail} className="aspect-video bg-slate-100 dark:bg-slate-800" />
                {t.category && <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-900/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{t.category}</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug text-slate-900 dark:text-white">{t.name}</h3>
                  {t.is_system ? <Badge color="blue" className="flex-none">Sistema</Badge> : <Badge color="violet" className="flex-none">Personalizada</Badge>}
                </div>
                {t.description && <p className="mt-1 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{t.summary?.modules ?? 0} módulo{t.summary?.modules === 1 ? '' : 's'}</span>
                  {t.summary?.theme && (
                    <span className="inline-flex items-center gap-1"><Palette className="h-3.5 w-3.5" />
                      {t.summary.primary && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.summary.primary }} />}{t.summary.theme}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1 pt-4">
                  {can('courses.create') ? (
                    <Button variant="primary" size="sm" className="flex-1" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setUseTpl(t)}>Usar plantilla</Button>
                  ) : <span className="flex-1 text-xs text-slate-400">Necesitás permiso de autor para crear cursos.</span>}
                  {isAdmin && (
                    <>
                      <IconButton title="Renombrar" onClick={() => askRename(t)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton title="Duplicar" onClick={() => duplicate.mutate(t)}><Copy className="h-4 w-4" /></IconButton>
                      <IconButton title="Eliminar" className="hover:!text-red-600" onClick={() => askDelete(t)}><Trash2 className="h-4 w-4" /></IconButton>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ))}

      {tab === 'screen' && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-slate-700 dark:border-brand-900 dark:bg-brand-900/20 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-none text-brand-600 dark:text-brand-300" />
            <div>
              Las plantillas de pantalla se crean desde el editor de cursos con <b>“Guardar pantalla como plantilla”</b>, y se insertan al <b>agregar una pantalla</b> nueva a una lección.
              Acá podés renombrarlas, duplicarlas o eliminarlas.
            </div>
          </div>

          {screenTpls.isLoading ? <PageLoader /> : screenTpls.isError ? (
            <Empty title="No se pudieron cargar las plantillas" action={<Button onClick={() => screenTpls.refetch()}>Reintentar</Button>} />
          ) : (
            <>
              <ScreenList title="Mis plantillas" rows={myScreens} emptyText="Todavía no guardaste pantallas como plantilla."
                canModify={canModify} canDuplicate={can('templates.use')} onRename={askRename} onDuplicate={(t) => duplicate.mutate(t)} onDelete={askDelete} />
              <ScreenList title="Plantillas del sistema" rows={systemScreens} emptyText="No hay plantillas del sistema."
                canModify={canModify} canDuplicate={can('templates.use')} onRename={askRename} onDuplicate={(t) => duplicate.mutate(t)} onDelete={askDelete} />
            </>
          )}
        </div>
      )}

      <UseTemplateModal tpl={useTpl} onClose={() => setUseTpl(null)} />
      {isAdmin && <SaveCourseAsTemplateModal open={saveOpen} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}

function ScreenList({ title, rows, emptyText, canModify, canDuplicate, onRename, onDuplicate, onDelete }: {
  title: string; rows: TemplateRow[]; emptyText: string; canModify(t: TemplateRow): boolean; canDuplicate: boolean;
  onRename(t: TemplateRow): void; onDuplicate(t: TemplateRow): void; onDelete(t: TemplateRow): void;
}) {
  return (
    <section>
      <h2 className="panel-title mb-2">{title} <span className="font-normal normal-case tracking-normal">({rows.length})</span></h2>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">{emptyText}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Nombre</th><th className="hidden md:table-cell">Categoría</th><th>Componentes</th><th className="hidden sm:table-cell">Creada</th><th className="w-px" /></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">{t.is_system ? <Lock className="h-4 w-4" /> : <Shapes className="h-4 w-4" />}</div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900 dark:text-white">{t.name}</div>
                        {t.description && <div className="truncate text-xs text-slate-500">{t.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell text-slate-500">{t.category || '—'}</td>
                  <td className="tabular-nums">{t.summary?.components ?? 0}</td>
                  <td className="hidden sm:table-cell whitespace-nowrap text-xs text-slate-500" title={fmtDate(t.created_at)}>{fmtRelative(t.created_at)}{t.created_by_name ? <span className="block text-slate-400">por {t.created_by_name}</span> : null}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {canModify(t) && <IconButton title="Renombrar" onClick={() => onRename(t)}><Pencil className="h-4 w-4" /></IconButton>}
                      {canDuplicate && <IconButton title="Duplicar" onClick={() => onDuplicate(t)}><Copy className="h-4 w-4" /></IconButton>}
                      {canModify(t) && <IconButton title="Eliminar" className="hover:!text-red-600" onClick={() => onDelete(t)}><Trash2 className="h-4 w-4" /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
