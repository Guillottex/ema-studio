import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Tags, Plus, Pencil, Trash2, BookOpen, CircleHelp, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { Button, ColorInput, Empty, Field, IconButton, Input, Modal, PageHeader, PageLoader, Textarea, clsx, confirmDialog } from '../components/ui';
import type { Category } from './parts/questions-shared';

const SWATCHES = ['#2563eb', '#0891b2', '#107c41', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#6d28d9', '#475569'];

export default function Categories() {
  const { can } = useAuth();
  const canManage = can('categories.manage');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [q, setQ] = useState('');

  const remove = async (c: Category) => {
    const used = c.courses + c.questions;
    const ok = await confirmDialog({
      title: 'Eliminar categoría', danger: true, confirmText: 'Eliminar',
      message: used
        ? <>La categoría <b>{c.name}</b> está asignada a {c.courses} curso{c.courses === 1 ? '' : 's'} y {c.questions} pregunta{c.questions === 1 ? '' : 's'}. Si la eliminás, esos elementos quedan “Sin categoría”. ¿Continuar?</>
        : <>¿Eliminar la categoría <b>{c.name}</b>?</>,
    });
    if (!ok) return;
    try {
      await api.del(`/categories/${c.id}`);
      await qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Categoría eliminada');
    } catch (e) { toast.error(e); }
  };

  const items = (data || []).filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || (c.description || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageHeader
        icon={<Tags className="h-5 w-5" />}
        title="Categorías"
        description="Organizá cursos y preguntas por área temática."
        actions={canManage && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ name: '', description: '', color: SWATCHES[0] })}>Nueva categoría</Button>}
      />

      {(data?.length || 0) > 6 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar categoría…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {isLoading ? <PageLoader /> : !data?.length ? (
        <Empty icon={<Tags className="h-10 w-10" />} title="No hay categorías"
          action={canManage ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ name: '', description: '', color: SWATCHES[0] })}>Crear categoría</Button> : undefined}>
          Las categorías te ayudan a filtrar cursos y preguntas.
        </Empty>
      ) : items.length === 0 ? (
        <Empty title="Sin resultados">No hay categorías que coincidan con “{q}”.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="card group relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.color }} />
              <div className="flex items-start gap-3 p-4 pl-5">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-lg text-white shadow-sm" style={{ background: c.color }}>
                  <Tags className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  <p className={clsx('mt-0.5 line-clamp-2 text-sm', c.description ? 'text-slate-600 dark:text-slate-400' : 'italic text-slate-400')}>{c.description || 'Sin descripción'}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <Link to="/cursos" className="inline-flex items-center gap-1 hover:text-brand-600"><BookOpen className="h-3.5 w-3.5" />{c.courses} curso{c.courses === 1 ? '' : 's'}</Link>
                    <Link to="/preguntas" className="inline-flex items-center gap-1 hover:text-brand-600"><CircleHelp className="h-3.5 w-3.5" />{c.questions} pregunta{c.questions === 1 ? '' : 's'}</Link>
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-none gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <IconButton title="Editar" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton title="Eliminar" className="hover:!text-red-600" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!canManage && data && data.length > 0 && <p className="mt-4 text-xs text-slate-500">Solo los administradores pueden crear o modificar categorías.</p>}

      {editing && <CategoryModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryModal({ initial, onClose }: { initial: Partial<Category>; onClose(): void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [color, setColor] = useState(initial.color || SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const validColor = /^#[0-9a-f]{6}$/i.test(color);
  const nameErr = name.trim().length > 0 && name.trim().length < 2 ? 'Mínimo 2 caracteres' : undefined;

  const save = async () => {
    if (name.trim().length < 2 || !validColor) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim(), color };
      if (initial.id) await api.patch(`/categories/${initial.id}`, body); else await api.post('/categories', body);
      await qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(initial.id ? 'Categoría actualizada' : 'Categoría creada');
      onClose();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={initial.id ? 'Editar categoría' : 'Nueva categoría'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={saving} disabled={name.trim().length < 2 || !validColor} onClick={save}>{initial.id ? 'Guardar' : 'Crear'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Nombre *" error={nameErr}><Input autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Seguridad e Higiene" /></Field>
        <Field label="Descripción"><Textarea rows={2} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" /></Field>
        <Field label="Color" error={!validColor ? 'Usá un color hexadecimal (#rrggbb)' : undefined}>
          <ColorInput value={color} onChange={setColor} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SWATCHES.map((s) => (
              <button key={s} type="button" title={s} onClick={() => setColor(s)}
                className={clsx('h-6 w-6 rounded-full border-2 transition', color.toLowerCase() === s ? 'border-slate-900 scale-110 dark:border-white' : 'border-transparent')} style={{ background: s }} />
            ))}
          </div>
        </Field>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
          <span className="text-xs text-slate-500">Vista previa:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: validColor ? color : '#94a3b8' }}>{name.trim() || 'Categoría'}</span>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
