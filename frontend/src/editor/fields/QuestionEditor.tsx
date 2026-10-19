import { ArrowDown, ArrowUp, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { newQuestion, parseBlanks, validateQuestion, uid, QUESTION_TYPE_LABELS, type Question, type QuestionType } from '@engine';
import { Field, Input, Select, Switch, Textarea } from '../../components/ui';
import { MediaField } from '../../components/MediaPicker';
import { RichTextEditor } from './RichTextEditor';

const TYPES = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/** Editor completo de una pregunta (se usa en el editor visual y en el banco de preguntas). */
export function QuestionEditor({ value, onChange, compact }: { value: Question; onChange(q: Question): void; compact?: boolean }) {
  const q = value;
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const setOpt = (i: number, patch: any) => set({ options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const move = (i: number, d: number) => {
    const o = q.options.slice();
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    set({ options: o });
  };
  const changeType = (t: QuestionType) => {
    const base = newQuestion(t);
    onChange({ ...base, id: q.id, prompt: q.prompt, points: q.points, explanation: q.explanation, media: q.media, feedbackCorrect: q.feedbackCorrect, feedbackIncorrect: q.feedbackIncorrect });
  };
  const issues = validateQuestion(q);
  const single = q.type === 'single' || q.type === 'truefalse';

  return (
    <div className="space-y-3">
      <Field label="Tipo de pregunta">
        <Select sm value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)} options={TYPES} />
      </Field>
      <Field label="Enunciado">
        <RichTextEditor value={q.prompt} onChange={(prompt) => set({ prompt })} minHeight={compact ? 60 : 80} />
      </Field>
      <div className="grid grid-cols-[110px_1fr] items-start gap-2">
        <Field label="Multimedia">
          <Select sm value={q.media?.kind || ''} onChange={(e) => set({ media: e.target.value ? { kind: e.target.value as any, src: q.media?.src || '' } : null })}
            options={[{ value: '', label: 'Ninguna' }, { value: 'image', label: 'Imagen' }, { value: 'audio', label: 'Audio' }, { value: 'video', label: 'Video' }]} />
        </Field>
        {q.media && (
          <Field label="Archivo">
            <MediaField value={q.media.src} accept={q.media.kind} onChange={(src) => set({ media: { ...q.media!, src } })} />
          </Field>
        )}
      </div>

      {(single || q.type === 'multiple') && (
        <Field label={single ? 'Opciones (marcá la correcta)' : 'Opciones (marcá todas las correctas)'}>
          <div className="space-y-1.5">
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-1.5">
                <input type={single ? 'radio' : 'checkbox'} name={`c-${q.id}`} checked={!!o.correct} title="Respuesta correcta" className="h-4 w-4 accent-emerald-600"
                  onChange={(e) => set({ options: q.options.map((x, j) => (single ? { ...x, correct: j === i } : j === i ? { ...x, correct: e.target.checked } : x)) })} />
                <Input sm value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder={`Opción ${i + 1}`} />
                {q.type !== 'truefalse' && <button type="button" className="icon-btn h-7 w-7" title="Eliminar opción" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {q.type !== 'truefalse' && q.options.length < 8 && (
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => set({ options: [...q.options, { id: uid(6), text: '' }] })}><Plus className="h-3.5 w-3.5" />Agregar opción</button>
            )}
          </div>
        </Field>
      )}

      {q.type === 'order' && (
        <Field label="Elementos en el orden correcto (se mezclan al mostrarse)">
          <div className="space-y-1.5">
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-1">
                <span className="w-5 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
                <Input sm value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} />
                <button type="button" className="icon-btn h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className="icon-btn h-7 w-7" onClick={() => move(i, 1)} disabled={i === q.options.length - 1} title="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" className="icon-btn h-7 w-7" title="Eliminar" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => set({ options: [...q.options, { id: uid(6), text: '' }] })}><Plus className="h-3.5 w-3.5" />Agregar elemento</button>
          </div>
        </Field>
      )}

      {q.type === 'match' && (
        <Field label="Pares a relacionar">
          <div className="space-y-1.5">
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-1">
                <Input sm value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder="Concepto" />
                <span className="text-slate-400">→</span>
                <Input sm value={o.match || ''} onChange={(e) => setOpt(i, { match: e.target.value })} placeholder="Relación" />
                <button type="button" className="icon-btn h-7 w-7 flex-none" title="Eliminar" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => set({ options: [...q.options, { id: uid(6), text: '', match: '' }] })}><Plus className="h-3.5 w-3.5" />Agregar par</button>
          </div>
        </Field>
      )}

      {q.type === 'fill' && (
        <Field label="Texto con espacios" hint={<>Marcá cada espacio con llaves dobles: <code>{'{{respuesta|alternativa}}'}</code>. Detectados: {parseBlanks(q.fillText).answers.length}</>}>
          <Textarea rows={3} value={q.fillText || ''} onChange={(e) => set({ fillText: e.target.value })} />
        </Field>
      )}

      {q.type === 'short' && (
        <Field label="Respuestas aceptadas (una por línea)">
          <Textarea rows={3} value={(q.acceptedAnswers || []).join('\n')} onChange={(e) => set({ acceptedAnswers: e.target.value.split('\n') })} onBlur={() => set({ acceptedAnswers: (q.acceptedAnswers || []).map((s) => s.trim()).filter(Boolean) })} />
        </Field>
      )}
      {(q.type === 'short' || q.type === 'fill') && <Switch checked={!!q.caseSensitive} onChange={(caseSensitive) => set({ caseSensitive })} label="Distinguir mayúsculas y minúsculas" />}

      <div className="grid grid-cols-3 gap-2">
        <Field label="Puntaje"><Input sm type="number" min={0} step={0.5} value={q.points} onChange={(e) => set({ points: Number(e.target.value) || 0 })} /></Field>
        <Field label="Intentos" hint="0 = ilimitados"><Input sm type="number" min={0} value={q.attempts} onChange={(e) => set({ attempts: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Tiempo (seg)" hint="0 = sin límite"><Input sm type="number" min={0} value={q.timeLimit || 0} onChange={(e) => set({ timeLimit: Math.max(0, Number(e.target.value) || 0) })} /></Field>
      </div>
      <div className="flex flex-col gap-2">
        {(single || q.type === 'multiple') && q.type !== 'truefalse' && <Switch checked={!!q.shuffle} onChange={(shuffle) => set({ shuffle })} label="Mezclar opciones (aleatorización)" />}
        {['multiple', 'order', 'match', 'fill'].includes(q.type) && <Switch checked={!!q.partialCredit} onChange={(partialCredit) => set({ partialCredit })} label="Puntaje parcial" />}
      </div>
      <Field label="Feedback correcto"><Input sm value={q.feedbackCorrect || ''} onChange={(e) => set({ feedbackCorrect: e.target.value })} /></Field>
      <Field label="Feedback incorrecto"><Input sm value={q.feedbackIncorrect || ''} onChange={(e) => set({ feedbackIncorrect: e.target.value })} /></Field>
      <Field label="Explicación (se muestra al finalizar)"><Textarea rows={2} value={q.explanation || ''} onChange={(e) => set({ explanation: e.target.value })} /></Field>

      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          {issues.map((m) => <div key={m} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 flex-none" />{m}</div>)}
        </div>
      )}
    </div>
  );
}
