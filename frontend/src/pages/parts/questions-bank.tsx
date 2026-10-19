import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Copy, Pencil, Trash2, CircleHelp, ChevronDown, Award } from 'lucide-react';
import { newQuestion, validateQuestion, QUESTION_TYPE_LABELS, type Question, type QuestionType } from '@engine';
import { api } from '../../lib/api';
import { stripHtml, fmtRelative } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, Dropdown, Empty, Field, IconButton, Input, Modal, PageLoader, Select, confirmDialog } from '../../components/ui';
import { QuestionEditor } from '../../editor/fields/QuestionEditor';
import { questionPayload, optionsSummary, typeColor, type BankQuestion, type Category } from './questions-shared';

const TYPE_OPTIONS = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
}

export function QuestionsBank({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [debounced, setDebounced] = useState(q);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<{ q: Question; categoryId: number | null; isNew: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced); else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const qs = new URLSearchParams();
  if (debounced) qs.set('q', debounced);
  if (type) qs.set('type', type);
  if (category) qs.set('category', category);
  const { data, isLoading } = useQuery({
    queryKey: ['questions', debounced, type, category],
    queryFn: () => api.get<BankQuestion[]>(`/questions${qs.toString() ? '?' + qs : ''}`),
    placeholderData: (p) => p,
  });
  const { data: cats } = useCategories();
  const items = data || [];
  const catColor = (id: number | null) => cats?.find((c) => c.id === id)?.color;

  const openNew = (t: QuestionType) => setEditing({ q: newQuestion(t), categoryId: category ? Number(category) : null, isNew: true });
  const openEdit = (x: BankQuestion) => {
    const { categoryId, category: _c, createdAt: _d, ...rest } = x;
    setEditing({ q: { ...rest, feedbackCorrect: rest.feedbackCorrect ?? '', feedbackIncorrect: rest.feedbackIncorrect ?? '', explanation: rest.explanation ?? '' }, categoryId: categoryId ?? null, isNew: false });
  };

  const duplicate = async (x: BankQuestion) => {
    setBusyId(x.id);
    try {
      await api.post(`/questions/${x.id}/duplicate`);
      await qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Pregunta duplicada');
    } catch (e) { toast.error(e); } finally { setBusyId(null); }
  };
  const remove = async (x: BankQuestion) => {
    const ok = await confirmDialog({ title: 'Eliminar pregunta', danger: true, confirmText: 'Eliminar', message: <>¿Eliminar la pregunta <b>“{stripHtml(x.prompt).slice(0, 80)}”</b> del banco? También se quitará de las evaluaciones que la incluyan.</> });
    if (!ok) return;
    setBusyId(x.id);
    try {
      await api.del(`/questions/${x.id}`);
      await qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['quizzes'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Pregunta eliminada');
    } catch (e) { toast.error(e); } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar en el enunciado…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto min-w-[170px]" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: '', label: 'Todos los tipos' }, ...TYPE_OPTIONS]} />
        <Select className="w-auto min-w-[170px]" value={category} onChange={(e) => setCategory(e.target.value)}
          options={[{ value: '', label: 'Todas las categorías' }, ...(cats || []).map((c) => ({ value: String(c.id), label: c.name }))]} />
        {canManage && (
          <div className="ml-auto">
            <Dropdown
              trigger={(open) => <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={open}>Nueva pregunta<ChevronDown className="h-4 w-4 -mr-1" /></Button>}
              items={TYPE_OPTIONS.map((t) => ({ label: t.label, onClick: () => openNew(t.value as QuestionType) }))}
            />
          </div>
        )}
      </div>

      {isLoading ? <PageLoader /> : items.length === 0 ? (
        <Empty icon={<CircleHelp className="h-10 w-10" />} title={debounced || type || category ? 'No hay preguntas con esos filtros' : 'El banco de preguntas está vacío'}
          action={debounced || type || category ? <Button onClick={() => { setQ(''); setType(''); setCategory(''); }}>Limpiar filtros</Button> : canManage ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openNew('single')}>Crear la primera pregunta</Button> : undefined}>
          {debounced || type || category ? 'Probá con otra búsqueda.' : 'Creá preguntas reutilizables para armar evaluaciones.'}
        </Empty>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          <div className="hidden items-center gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:flex">
            <span className="flex-1">Pregunta</span><span className="w-28 text-right">Elementos</span><span className="w-16 text-right">Puntos</span><span className="w-40">Categoría</span>{canManage && <span className="w-[104px]" />}
          </div>
          {items.map((x) => (
            <div key={x.id} className="group flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => canManage && openEdit(x)} disabled={!canManage}>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge color={typeColor(x.type)}>{QUESTION_TYPE_LABELS[x.type] || x.type}</Badge>
                  {x.media?.src && <Badge>Con {x.media.kind === 'image' ? 'imagen' : x.media.kind}</Badge>}
                  {x.createdAt && <span className="text-[11px] text-slate-400">{fmtRelative(x.createdAt)}</span>}
                </div>
                <div className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{stripHtml(x.prompt) || <i className="text-slate-400">Sin enunciado</i>}</div>
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 md:contents">
                <span className="md:w-28 md:text-right">{optionsSummary(x)}</span>
                <span className="inline-flex items-center gap-1 md:w-16 md:justify-end"><Award className="h-3.5 w-3.5" />{x.points}</span>
                <span className="md:w-40">
                  {x.category ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: catColor(x.categoryId) || '#94a3b8' }} />{x.category}</span>
                  ) : <span className="text-slate-400">Sin categoría</span>}
                </span>
              </div>
              {canManage && (
                <div className="flex w-[104px] justify-end gap-0.5">
                  <IconButton title="Editar" onClick={() => openEdit(x)}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton title="Duplicar" disabled={busyId === x.id} onClick={() => duplicate(x)}><Copy className="h-4 w-4" /></IconButton>
                  <IconButton title="Eliminar" disabled={busyId === x.id} className="hover:!text-red-600" onClick={() => remove(x)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && <p className="mt-2 text-xs text-slate-500">{items.length} pregunta{items.length === 1 ? '' : 's'}</p>}

      {editing && <QuestionModal key={editing.q.id} initial={editing} cats={cats || []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuestionModal({ initial, cats, onClose }: { initial: { q: Question; categoryId: number | null; isNew: boolean }; cats: Category[]; onClose(): void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState<Question>(initial.q);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const issues = validateQuestion(q);
  const asking = useRef(false);

  const close = async () => {
    if (asking.current) return;
    if (dirty) {
      asking.current = true;
      const ok = await confirmDialog({ title: 'Descartar cambios', message: 'Hay cambios sin guardar en la pregunta. ¿Querés cerrarla igual?', confirmText: 'Descartar', danger: true });
      setTimeout(() => { asking.current = false; }, 0);
      if (!ok) return;
    }
    onClose();
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = questionPayload(q, categoryId);
      if (initial.isNew) await api.post('/questions', body);
      else await api.put(`/questions/${q.id}`, body);
      await qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['quiz'] });
      toast.success(initial.isNew ? 'Pregunta creada' : 'Pregunta guardada');
      onClose();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={close} size="lg" title={initial.isNew ? 'Nueva pregunta' : 'Editar pregunta'} description="Las preguntas del banco se reutilizan en evaluaciones de cualquier curso."
      footer={<>
        {issues.length > 0 && <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">{issues.length} aviso{issues.length === 1 ? '' : 's'} por resolver</span>}
        <Button onClick={close}>Cancelar</Button>
        <Button variant="primary" loading={saving} disabled={issues.length > 0} onClick={save}>{initial.isNew ? 'Crear pregunta' : 'Guardar cambios'}</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Categoría" hint="Sirve para filtrar y organizar el banco.">
          <Select value={categoryId ?? ''} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : null); setDirty(true); }}
            options={[{ value: '', label: 'Sin categoría' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
        </Field>
        <QuestionEditor value={q} onChange={(v) => { setQ(v); setDirty(true); }} />
      </div>
    </Modal>
  );
}
