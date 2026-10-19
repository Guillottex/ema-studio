import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Copy, Trash2, Plus, Library, Save, Search } from 'lucide-react';
import clsx from 'clsx';
import { iconSvgString, newQuestion, uid, QUESTION_TYPE_LABELS, type FieldDef, type Question, type QuestionType } from '@engine';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { stripHtml } from '../../lib/format';
import { Button, ColorInput, Field, Input, Modal, Select, Switch, Textarea, Dropdown } from '../../components/ui';
import { MediaField } from '../../components/MediaPicker';
import { RichTextEditor } from './RichTextEditor';
import { QuestionEditor } from './QuestionEditor';
import { useEditor } from '../store';

interface Props {
  field: FieldDef;
  value: any;
  props: Record<string, any>;
  onChange(v: any): void;
  onPatch?(patch: Record<string, any>): void;
}

export function FieldRenderer({ field: f, value, props, onChange, onPatch }: Props) {
  if (f.showIf && !f.showIf(props)) return null;
  const label = f.label;
  switch (f.type) {
    case 'text':
      return <Field label={label} hint={f.help}><Input sm value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'textarea':
      return <Field label={label} hint={f.help}><Textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'richtext':
      return <Field label={label}><RichTextEditor value={value ?? ''} onChange={onChange} /></Field>;
    case 'number':
      return <Field label={label} hint={f.help}><Input sm type="number" min={f.min} max={f.max} step={f.step || 1} value={value ?? 0} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} /></Field>;
    case 'color':
      return <Field label={label}><ColorInput value={value || ''} onChange={onChange} allowEmpty /></Field>;
    case 'select':
      return <Field label={label}><Select sm value={value ?? ''} onChange={(e) => onChange(e.target.value)} options={f.options || []} /></Field>;
    case 'boolean':
      return <Switch checked={!!value} onChange={onChange} label={label} />;
    case 'media':
      return <Field label={label}><MediaField value={value || ''} onChange={onChange} accept={f.accept || 'image'} /></Field>;
    case 'icon':
      return <Field label={label}><IconPicker value={value || ''} onChange={onChange} options={f.options || []} /></Field>;
    case 'screen':
      return <Field label={label}><ScreenPicker value={value || ''} onChange={onChange} /></Field>;
    case 'component':
      return <Field label={label}><ComponentPicker value={value || ''} onChange={onChange} /></Field>;
    case 'list':
      return <ListEditor field={f} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    case 'table':
      return <Field label={label}><TableEditor value={Array.isArray(value) ? value : [['']]} onChange={onChange} /></Field>;
    case 'stringlist':
      return <Field label={label} hint="Uno por línea"><Textarea rows={4} value={(value || []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} /></Field>;
    case 'question':
      return <QuestionField value={value} onChange={onChange} />;
    case 'questions':
      return <QuestionsField value={Array.isArray(value) ? value : []} onChange={onChange} onPatch={onPatch} />;
  }
  return null;
}

/* ------------------------------ lista de ítems ------------------------------ */

function ListEditor({ field, value, onChange }: { field: FieldDef; value: any[]; onChange(v: any[]): void }) {
  const [open, setOpen] = useState<number | null>(0);
  const setItem = (i: number, patch: any) => onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) => {
    const a = value.slice();
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
    setOpen(j);
  };
  return (
    <div>
      <div className="label">{field.label} ({value.length})</div>
      <div className="space-y-1.5">
        {value.map((it, i) => {
          const title = stripHtml(String(it?.[field.itemLabel || ''] ?? '')) || `Elemento ${i + 1}`;
          return (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button type="button" className="icon-btn h-6 w-6" onClick={() => setOpen(open === i ? null : i)}>{open === i ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
                <span className="min-w-0 flex-1 cursor-pointer truncate text-xs font-medium" onClick={() => setOpen(open === i ? null : i)}>{title}</span>
                <button type="button" className="icon-btn h-6 w-6" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></button>
                <button type="button" className="icon-btn h-6 w-6" title="Bajar" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></button>
                <button type="button" className="icon-btn h-6 w-6" title="Duplicar" onClick={() => onChange([...value.slice(0, i + 1), JSON.parse(JSON.stringify(it)), ...value.slice(i + 1)])}><Copy className="h-3 w-3" /></button>
                <button type="button" className="icon-btn h-6 w-6" title="Eliminar" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button>
              </div>
              {open === i && (
                <div className="space-y-2.5 border-t border-slate-200 p-2.5 dark:border-slate-700">
                  {(field.itemFields || []).map((sf) => (
                    <FieldRenderer key={sf.key} field={sf} value={it?.[sf.key]} props={it || {}} onChange={(v) => setItem(i, { [sf.key]: v })} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-secondary btn-xs mt-2" onClick={() => { onChange([...value, field.newItem ? field.newItem() : {}]); setOpen(value.length); }}><Plus className="h-3.5 w-3.5" />Agregar</button>
    </div>
  );
}

/* ------------------------------ tabla ------------------------------ */

function TableEditor({ value, onChange }: { value: string[][]; onChange(v: string[][]): void }) {
  const cols = Math.max(1, ...value.map((r) => r.length));
  const set = (r: number, c: number, v: string) => onChange(value.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : row[j] ?? '')) : row)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="text-xs">
          <tbody>
            {value.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                    <input className={clsx('w-28 bg-transparent px-1.5 py-1 outline-none focus:bg-brand-50 dark:focus:bg-brand-900/30', r === 0 && 'font-semibold')} value={row[c] ?? ''} onChange={(e) => set(r, c, e.target.value)} />
                  </td>
                ))}
                <td className="px-1"><button type="button" className="icon-btn h-6 w-6" title="Eliminar fila" onClick={() => onChange(value.filter((_, i) => i !== r))}><Trash2 className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => onChange([...value, Array(cols).fill('')])}><Plus className="h-3 w-3" />Fila</button>
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => onChange(value.map((r) => [...r, '']))}><Plus className="h-3 w-3" />Columna</button>
        {cols > 1 && <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(value.map((r) => r.slice(0, cols - 1)))}>Quitar última columna</button>}
      </div>
    </div>
  );
}

/* ------------------------------ íconos ------------------------------ */

function IconPicker({ value, onChange, options }: { value: string; onChange(v: string): void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-300 px-2.5 text-sm dark:border-slate-700">
        {value ? <span className="text-brand-600" dangerouslySetInnerHTML={{ __html: iconSvgString(value, 18) }} /> : <span className="text-slate-400">—</span>}
        <span className="flex-1 text-left text-xs">{value || 'Sin ícono'}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="mt-1 grid max-h-48 grid-cols-7 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-slate-700">
          {options.map((o) => (
            <button key={o.value || 'none'} type="button" title={o.label} onClick={() => { onChange(o.value); setOpen(false); }}
              className={clsx('grid aspect-square place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800', value === o.value && 'bg-brand-100 text-brand-700 dark:bg-brand-900/40')}>
              {o.value ? <span dangerouslySetInnerHTML={{ __html: iconSvgString(o.value, 18) }} /> : <span className="text-[10px]">—</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ destinos ------------------------------ */

export function ScreenPicker({ value, onChange, allowEmpty = true, emptyLabel = '(elegí un destino)' }: { value: string; onChange(v: string): void; allowEmpty?: boolean; emptyLabel?: string }) {
  const tree = useEditor((s) => s.tree);
  return (
    <Select sm value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {tree.map((m, mi) => (
        <optgroup key={m.id} label={`Módulo ${mi + 1}: ${m.title}`}>
          <option value={m.id}>▸ Inicio del módulo “{m.title}”</option>
          {m.lessons.map((l) => [
            <option key={l.id} value={l.id}>&nbsp;&nbsp;▸ Lección: {l.title}</option>,
            ...l.screens.map((s) => <option key={s.id} value={s.id}>&nbsp;&nbsp;&nbsp;&nbsp;• {s.title}</option>),
          ])}
        </optgroup>
      ))}
    </Select>
  );
}

export function ComponentPicker({ value, onChange, exclude, filter, emptyLabel = '(elegí un componente)' }: { value: string; onChange(v: string): void; exclude?: string; filter?: (type: string) => boolean; emptyLabel?: string }) {
  const comps = useEditor((s) => s.screen?.components || []);
  return (
    <Select sm value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {comps.filter((c) => c.id !== exclude && (!filter || filter(c.type))).map((c) => <option key={c.id} value={c.id}>{componentLabel(c)}</option>)}
    </Select>
  );
}

export function componentLabel(c: { name?: string; type: string; props: any; id: string }): string {
  if (c.name) return c.name;
  const txt = stripHtml(c.props?.text || c.props?.title || c.props?.html || c.props?.buttonText || c.props?.question?.prompt || '');
  return `${c.type}${txt ? ': ' + txt.slice(0, 32) : ''} (${c.id.slice(0, 4)})`;
}

/* ------------------------------ preguntas ------------------------------ */

function cloneQuestion(q: Question): Question {
  return { ...JSON.parse(JSON.stringify(q)), id: uid(8) };
}

function BankPicker({ open, onClose, multiple, onPick }: { open: boolean; onClose(): void; multiple?: boolean; onPick(qs: Question[]): void }) {
  const { data } = useQuery({ queryKey: ['questions'], queryFn: () => api.get<Question[]>('/questions'), enabled: open });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const list = (data || []).filter((x) => !q || stripHtml(x.prompt).toLowerCase().includes(q.toLowerCase()));
  const done = () => { onPick((data || []).filter((x) => sel.includes(x.id)).map(cloneQuestion)); setSel([]); onClose(); };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Banco de preguntas" description="Las preguntas se copian al componente; podés editarlas sin afectar el banco."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!sel.length} onClick={done}>Agregar {sel.length || ''}</Button></>}>
      <div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" /></div>
      <div className="space-y-1">
        {list.map((x) => (
          <label key={x.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <input type={multiple ? 'checkbox' : 'radio'} name="bankpick" className="mt-1" checked={sel.includes(x.id)} onChange={(e) => setSel(multiple ? (e.target.checked ? [...sel, x.id] : sel.filter((s) => s !== x.id)) : [x.id])} />
            <div className="min-w-0 flex-1"><div className="text-sm">{stripHtml(x.prompt)}</div><div className="text-xs text-slate-500">{QUESTION_TYPE_LABELS[x.type]} · {x.points} pts</div></div>
          </label>
        ))}
        {data && !list.length && <p className="py-6 text-center text-sm text-slate-500">No hay preguntas en el banco.</p>}
      </div>
    </Modal>
  );
}

async function saveToBank(q: Question) {
  try {
    const { id, ...rest } = q;
    void id;
    await api.post('/questions', { ...rest, media: rest.media || null });
    toast.success('Pregunta guardada en el banco');
  } catch (e) {
    toast.error(e);
  }
}

function QuestionField({ value, onChange }: { value: Question; onChange(q: Question): void }) {
  const [bank, setBank] = useState(false);
  const q = value || newQuestion('single');
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBank(true)}><Library className="h-3.5 w-3.5" />Desde el banco</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => saveToBank(q)}><Save className="h-3.5 w-3.5" />Guardar en el banco</button>
      </div>
      <QuestionEditor value={q} onChange={onChange} compact />
      <BankPicker open={bank} onClose={() => setBank(false)} onPick={(qs) => qs[0] && onChange(qs[0])} />
    </div>
  );
}

function QuestionsField({ value, onChange, onPatch }: { value: Question[]; onChange(v: Question[]): void; onPatch?(p: Record<string, any>): void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [bank, setBank] = useState(false);
  const [quizPick, setQuizPick] = useState(false);
  const { data: quizzes } = useQuery({ queryKey: ['quizzes'], queryFn: () => api.get<any[]>('/quizzes'), enabled: quizPick });
  const set = (i: number, q: Question) => onChange(value.map((x, j) => (j === i ? q : x)));
  const move = (i: number, d: number) => {
    const a = value.slice();
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  const loadQuiz = async (id: string) => {
    const z = await api.get<any>(`/quizzes/${id}`);
    const s = z.settings || {};
    const patch: Record<string, any> = { title: z.title, questions: (z.questions || []).map(cloneQuestion) };
    for (const k of ['passingScore', 'attempts', 'timeLimit', 'drawCount', 'randomize', 'showAnswers', 'showResult', 'passMessage', 'failMessage']) if (s[k] !== undefined) patch[k] = s[k];
    if (onPatch) onPatch(patch); else onChange(patch.questions);
    setQuizPick(false);
    toast.success(`Evaluación “${z.title}” cargada (${patch.questions.length} preguntas)`);
  };
  const types = Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][];
  return (
    <div>
      <div className="label">Preguntas ({value.length})</div>
      <div className="space-y-1.5">
        {value.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1 px-1.5 py-1">
              <button type="button" className="icon-btn h-6 w-6" onClick={() => setOpen(open === i ? null : i)}>{open === i ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
              <span className="min-w-0 flex-1 cursor-pointer truncate text-xs" onClick={() => setOpen(open === i ? null : i)}><b>{i + 1}.</b> {stripHtml(q.prompt) || 'Sin enunciado'}</span>
              <button type="button" className="icon-btn h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} title="Subir"><ArrowUp className="h-3 w-3" /></button>
              <button type="button" className="icon-btn h-6 w-6" disabled={i === value.length - 1} onClick={() => move(i, 1)} title="Bajar"><ArrowDown className="h-3 w-3" /></button>
              <button type="button" className="icon-btn h-6 w-6" title="Duplicar" onClick={() => onChange([...value.slice(0, i + 1), cloneQuestion(q), ...value.slice(i + 1)])}><Copy className="h-3 w-3" /></button>
              <button type="button" className="icon-btn h-6 w-6" title="Eliminar" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button>
            </div>
            {open === i && (
              <div className="border-t border-slate-200 p-2.5 dark:border-slate-700">
                <QuestionEditor value={q} onChange={(nq) => set(i, nq)} compact />
                <button type="button" className="btn btn-ghost btn-xs mt-2" onClick={() => saveToBank(q)}><Save className="h-3.5 w-3.5" />Guardar en el banco</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Dropdown align="left" trigger={(o) => <button type="button" className="btn btn-secondary btn-xs" onClick={o}><Plus className="h-3.5 w-3.5" />Nueva pregunta</button>}
          items={types.map(([t, l]) => ({ label: l, onClick: () => { onChange([...value, newQuestion(t)]); setOpen(value.length); } }))} />
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBank(true)}><Library className="h-3.5 w-3.5" />Del banco</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setQuizPick(true)}>Cargar evaluación del banco</button>
      </div>
      <BankPicker open={bank} onClose={() => setBank(false)} multiple onPick={(qs) => onChange([...value, ...qs])} />
      <Modal open={quizPick} onClose={() => setQuizPick(false)} title="Cargar evaluación del banco" description="Reemplaza las preguntas y la configuración por las de la evaluación elegida.">
        <div className="space-y-1.5">
          {(quizzes || []).map((z) => (
            <button key={z.id} type="button" onClick={() => loadQuiz(z.id)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-brand-400 dark:border-slate-700">
              <div className="text-sm font-medium">{z.title}</div><div className="text-xs text-slate-500">{z.questions} preguntas · mínimo {z.settings?.passingScore ?? 70}%</div>
            </button>
          ))}
          {quizzes && !quizzes.length && <p className="py-6 text-center text-sm text-slate-500">No hay evaluaciones en el banco.</p>}
        </div>
      </Modal>
    </div>
  );
}
