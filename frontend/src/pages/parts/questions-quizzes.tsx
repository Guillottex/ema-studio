import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Pencil, Trash2, ClipboardCheck, ArrowUp, ArrowDown, X, Search, Timer, Repeat, Target, Shuffle, ListChecks, Info } from 'lucide-react';
import { QUESTION_TYPE_LABELS } from '@engine';
import { api } from '../../lib/api';
import { fmtRelative, stripHtml } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, Empty, Field, IconButton, Input, Modal, PageLoader, Select, Switch, Textarea, clsx, confirmDialog } from '../../components/ui';
import { DEFAULT_QUIZ_SETTINGS, typeColor, type BankQuestion, type QuizRow, type QuizSettings } from './questions-shared';
import { useCategories } from './questions-bank';

export function QuizzesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['quizzes'], queryFn: () => api.get<QuizRow[]>('/quizzes') });
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const duplicate = async (z: QuizRow) => {
    setBusy(z.id);
    try { await api.post(`/quizzes/${z.id}/duplicate`); await qc.invalidateQueries({ queryKey: ['quizzes'] }); toast.success('Evaluación duplicada'); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  };
  const remove = async (z: QuizRow) => {
    if (!(await confirmDialog({ title: 'Eliminar evaluación', danger: true, confirmText: 'Eliminar', message: <>¿Eliminar <b>{z.title}</b>? Las preguntas siguen disponibles en el banco. Los cursos que ya insertaron esta evaluación conservan su copia.</> }))) return;
    setBusy(z.id);
    try { await api.del(`/quizzes/${z.id}`); await qc.invalidateQueries({ queryKey: ['quizzes'] }); toast.success('Evaluación eliminada'); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  };

  const items = data || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-slate-600 dark:border-brand-900/50 dark:bg-brand-900/15 dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 flex-none text-brand-600 dark:text-brand-300" />
          <p>Armá evaluaciones con preguntas del banco y configurá puntaje mínimo, intentos y tiempo. Después podés insertarlas en cualquier pantalla de un curso desde el <b>editor visual</b> (componente “Evaluación”).</p>
        </div>
        {canManage && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ id: null })}>Nueva evaluación</Button>}
      </div>

      {isLoading ? <PageLoader /> : items.length === 0 ? (
        <Empty icon={<ClipboardCheck className="h-10 w-10" />} title="Todavía no hay evaluaciones"
          action={canManage ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ id: null })}>Crear evaluación</Button> : undefined}>
          Combiná preguntas del banco en evaluaciones reutilizables.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((z) => {
            const s = { ...DEFAULT_QUIZ_SETTINGS, ...(z.settings || {}) };
            return (
              <div key={z.id} className="card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"><ClipboardCheck className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <button type="button" disabled={!canManage} onClick={() => setEditing({ id: z.id })} className="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-brand-700 disabled:hover:text-inherit dark:text-white">{z.title}</button>
                    <div className="text-xs text-slate-500">{z.questions} pregunta{z.questions === 1 ? '' : 's'}{s.drawCount > 0 ? ` · muestra ${s.drawCount}` : ''} · {fmtRelative(z.updated_at)}{z.created_by_name ? ` · ${z.created_by_name}` : ''}</div>
                  </div>
                </div>
                {z.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{z.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge color="green"><Target className="h-3 w-3" />Aprueba con {s.passingScore}%</Badge>
                  <Badge><Repeat className="h-3 w-3" />{s.attempts === 0 ? 'Intentos ilimitados' : `${s.attempts} intento${s.attempts === 1 ? '' : 's'}`}</Badge>
                  <Badge><Timer className="h-3 w-3" />{s.timeLimit ? `${s.timeLimit} min` : 'Sin límite'}</Badge>
                  {s.randomize && <Badge color="violet"><Shuffle className="h-3 w-3" />Aleatoria</Badge>}
                </div>
                {canManage && (
                  <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing({ id: z.id })}>Editar</Button>
                    <div className="ml-auto flex gap-0.5">
                      <IconButton title="Duplicar" disabled={busy === z.id} onClick={() => duplicate(z)}><Copy className="h-4 w-4" /></IconButton>
                      <IconButton title="Eliminar" disabled={busy === z.id} className="hover:!text-red-600" onClick={() => remove(z)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && <QuizEditorModal id={editing.id} onClose={() => setEditing(null)} />}
    </div>
  );
}

interface QuizDetail extends Omit<QuizRow, 'questions'> { questions: BankQuestion[] }

function QuizEditorModal({ id, onClose }: { id: string | null; onClose(): void }) {
  const { data, isLoading } = useQuery({ queryKey: ['quiz', id], queryFn: () => api.get<QuizDetail>(`/quizzes/${id}`), enabled: !!id, gcTime: 0 });
  const { data: bank, isLoading: loadingBank } = useQuery({ queryKey: ['questions', '', '', ''], queryFn: () => api.get<BankQuestion[]>('/questions') });
  const ready = (!id || data) && bank;
  return (
    <Modal open onClose={onClose} size="xl" title={id ? 'Editar evaluación' : 'Nueva evaluación'} description="Configurá la evaluación y elegí las preguntas del banco en el orden en que se van a mostrar.">
      {isLoading || loadingBank || !ready ? <PageLoader /> : <QuizForm id={id} detail={data || null} bank={bank} onClose={onClose} />}
    </Modal>
  );
}

function QuizForm({ id, detail, bank, onClose }: { id: string | null; detail: QuizDetail | null; bank: BankQuestion[]; onClose(): void }) {
  const qc = useQueryClient();
  const { data: cats } = useCategories();
  const [title, setTitle] = useState(detail?.title || '');
  const [description, setDescription] = useState(detail?.description || '');
  const [s, setS] = useState<QuizSettings>({ ...DEFAULT_QUIZ_SETTINGS, ...(detail?.settings || {}) });
  const [selected, setSelected] = useState<string[]>(detail?.questions.map((q) => q.id) || []);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (p: Partial<QuizSettings>) => setS((o) => ({ ...o, ...p }));

  const byId = useMemo(() => {
    const m = new Map<string, BankQuestion>();
    bank.forEach((q) => m.set(q.id, q));
    detail?.questions.forEach((q) => { if (!m.has(q.id)) m.set(q.id, q); });
    return m;
  }, [bank, detail]);
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return bank.filter((q) => (!t || stripHtml(q.prompt).toLowerCase().includes(t)) && (!cat || String(q.categoryId) === cat));
  }, [bank, search, cat]);
  const totalPoints = selected.reduce((a, qid) => a + (Number(byId.get(qid)?.points) || 0), 0);

  const toggle = (qid: string) => setSelected((cur) => (cur.includes(qid) ? cur.filter((x) => x !== qid) : [...cur, qid]));
  const move = (i: number, d: number) => setSelected((cur) => {
    const j = i + d;
    if (j < 0 || j >= cur.length) return cur;
    const n = cur.slice();
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((q) => selected.includes(q.id));
  const toggleAll = () => setSelected((cur) => allFilteredSelected ? cur.filter((x) => !filtered.some((q) => q.id === x)) : [...cur, ...filtered.map((q) => q.id).filter((x) => !cur.includes(x))]);

  const save = async () => {
    if (!title.trim()) { toast.error('Ingresá un título para la evaluación'); return; }
    if (s.drawCount > selected.length) { toast.error('La cantidad de preguntas a mostrar no puede superar las seleccionadas'); return; }
    setSaving(true);
    try {
      const body = {
        title: title.trim(), description,
        settings: { ...s, passingScore: Math.min(100, Math.max(0, Number(s.passingScore) || 0)), attempts: Math.max(0, Math.round(s.attempts) || 0), timeLimit: Math.max(0, Math.round(s.timeLimit) || 0), drawCount: Math.max(0, Math.round(s.drawCount) || 0) },
        questionIds: selected,
      };
      if (id) await api.put(`/quizzes/${id}`, body); else await api.post('/quizzes', body);
      await qc.invalidateQueries({ queryKey: ['quizzes'] });
      qc.invalidateQueries({ queryKey: ['quiz'] });
      toast.success(id ? 'Evaluación guardada' : 'Evaluación creada');
      onClose();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Configuración */}
      <div className="space-y-4">
        <Field label="Título *"><Input value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Evaluación final de Excel" /></Field>
        <Field label="Descripción"><Textarea rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instrucciones o contexto para el participante" /></Field>

        <div>
          <div className="panel-title mb-2">Reglas</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Puntaje mínimo (%)"><Input type="number" min={0} max={100} value={s.passingScore} onChange={(e) => set({ passingScore: num(e.target.value) })} /></Field>
            <Field label="Intentos" hint="0 = ilimitados"><Input type="number" min={0} max={50} value={s.attempts} onChange={(e) => set({ attempts: num(e.target.value) })} /></Field>
            <Field label="Tiempo máximo (min)" hint="0 = sin límite"><Input type="number" min={0} max={600} value={s.timeLimit} onChange={(e) => set({ timeLimit: num(e.target.value) })} /></Field>
            <Field label="Preguntas a mostrar" hint={`0 = todas (${selected.length})`} error={s.drawCount > selected.length ? 'Supera las seleccionadas' : undefined}>
              <Input type="number" min={0} max={selected.length} value={s.drawCount} onChange={(e) => set({ drawCount: num(e.target.value) })} />
            </Field>
          </div>
        </div>
        <div className="space-y-2.5">
          <Switch checked={s.randomize} onChange={(randomize) => set({ randomize })} label="Preguntas en orden aleatorio" hint="Cada intento mezcla el orden (y sortea si se muestran menos preguntas)." />
          <Switch checked={s.showAnswers} onChange={(showAnswers) => set({ showAnswers })} label="Mostrar respuestas correctas al finalizar" />
          <Switch checked={s.showResult} onChange={(showResult) => set({ showResult })} label="Mostrar resultado (puntaje y aprobación)" />
        </div>
        <Field label="Mensaje de aprobación"><Textarea rows={2} maxLength={1000} value={s.passMessage} onChange={(e) => set({ passMessage: e.target.value })} /></Field>
        <Field label="Mensaje de desaprobación"><Textarea rows={2} maxLength={1000} value={s.failMessage} onChange={(e) => set({ failMessage: e.target.value })} /></Field>
      </div>

      {/* Preguntas */}
      <div className="min-w-0 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="panel-title">Preguntas seleccionadas ({selected.length})</div>
            <span className="text-xs text-slate-500">Total: {totalPoints} punto{totalPoints === 1 ? '' : 's'}</span>
          </div>
          {selected.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">Marcá preguntas del banco para agregarlas.</div>
          ) : (
            <ol className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {selected.map((qid, i) => {
                const q = byId.get(qid);
                return (
                  <li key={qid} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <span className="w-6 flex-none text-center text-xs font-semibold text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{q ? stripHtml(q.prompt) : <i className="text-slate-400">Pregunta no disponible</i>}</div>
                      {q && <div className="text-[11px] text-slate-500">{QUESTION_TYPE_LABELS[q.type]} · {q.points} pto{Number(q.points) === 1 ? '' : 's'}</div>}
                    </div>
                    <button type="button" className="icon-btn h-7 w-7" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="icon-btn h-7 w-7" title="Bajar" disabled={i === selected.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className="icon-btn h-7 w-7" title="Quitar" onClick={() => toggle(qid)}><X className="h-3.5 w-3.5" /></button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div>
          <div className="panel-title mb-2 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" />Banco de preguntas</div>
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <Input sm className="pl-8" placeholder="Buscar pregunta…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select sm className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: 'Todas las categorías' }, ...(cats || []).map((c) => ({ value: String(c.id), label: c.name }))]} />
            <Button size="sm" variant="ghost" disabled={!filtered.length} onClick={toggleAll}>{allFilteredSelected ? 'Desmarcar visibles' : 'Marcar visibles'}</Button>
          </div>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {filtered.length === 0 ? <div className="px-4 py-6 text-center text-sm text-slate-500">{bank.length ? 'Sin resultados.' : 'El banco está vacío. Creá preguntas en la pestaña “Preguntas”.'}</div> : filtered.map((q) => {
              const on = selected.includes(q.id);
              return (
                <label key={q.id} className={clsx('flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition-colors', on ? 'bg-brand-50/70 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-brand-600" checked={on} onChange={() => toggle(q.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2">{stripHtml(q.prompt)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <Badge color={typeColor(q.type)} className="!py-0 !text-[10.5px]">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <span>{q.points} pto{Number(q.points) === 1 ? '' : 's'}</span>
                      {q.category && <span>· {q.category}</span>}
                    </div>
                  </div>
                  {on && <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">#{selected.indexOf(q.id) + 1}</span>}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sticky -bottom-4 z-10 -mx-5 -mb-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60 lg:col-span-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={saving}>{id ? 'Guardar evaluación' : 'Crear evaluación'}</Button>
      </div>
    </form>
  );
}
