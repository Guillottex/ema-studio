import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, FilePlus2, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { toast } from '../../lib/toast';
import { Button, clsx, Field, Input, Modal, Select, Spinner, Tabs, Textarea } from '../../components/ui';
import { MediaField } from '../../components/MediaPicker';
import { linesToList, ThemePicker, TemplateThumb, useCategories, useCourseTemplates } from './courses-shared';

const LEVELS = ['Básico', 'Intermedio', 'Avanzado'];
const LANGS = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' }, { value: 'pt', label: 'Portugués' }];

type Step = 'datos' | 'detalles' | 'diseno';

function initialForm(author: string) {
  return {
    title: '', description: '', author, categoryId: '' as string, coverImage: '', duration: '', level: 'Básico', language: 'es', version: '1.0',
    objectives: '', requirements: '', status: 'draft' as 'draft' | 'published', themeId: null as string | null, templateId: null as string | null,
  };
}

export function NewCourseModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(() => initialForm(user?.name || ''));
  const [step, setStep] = useState<Step>('datos');
  const [touched, setTouched] = useState(false);
  const cats = useCategories();
  const tpls = useCourseTemplates(open);

  useEffect(() => {
    if (open) { setF(initialForm(user?.name || '')); setStep('datos'); setTouched(false); }
  }, [open, user?.name]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post<{ id: string; title: string }>('/courses', {
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      author: f.author.trim() || undefined,
      categoryId: f.categoryId ? Number(f.categoryId) : null,
      coverImage: f.coverImage || null,
      duration: f.duration.trim() || undefined,
      level: f.level,
      language: f.language,
      version: f.version.trim() || '1.0',
      objectives: linesToList(f.objectives),
      requirements: linesToList(f.requirements),
      status: f.status,
      themeId: f.themeId,
      ...(f.templateId ? { templateId: f.templateId } : {}),
    }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Curso “${c.title}” creado`);
      onClose();
      nav(`/cursos/${c.id}/editor`);
    },
    onError: (e) => toast.error(e),
  });

  const titleError = touched && !f.title.trim() ? 'El nombre es obligatorio' : undefined;
  const submit = () => {
    setTouched(true);
    if (!f.title.trim()) { setStep('datos'); return; }
    create.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Nuevo curso" description="Completá los datos básicos; todo se puede cambiar después desde el editor."
      footer={
        <>
          <span className="mr-auto hidden text-xs text-slate-500 sm:block">{f.templateId ? 'Se creará a partir de la plantilla elegida' : 'Se creará con un módulo, una lección y una pantalla en blanco'}</span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={create.isPending} icon={<Plus className="h-4 w-4" />} onClick={submit}>Crear curso</Button>
        </>
      }>
      <Tabs<Step> className="-mx-5 -mt-4 mb-4 px-5" value={step} onChange={setStep}
        tabs={[{ id: 'datos', label: 'Datos generales' }, { id: 'detalles', label: 'Objetivos y requisitos' }, { id: 'diseno', label: 'Diseño y punto de partida' }]} />

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <button type="submit" className="hidden" />
        {step === 'datos' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre del curso *" error={titleError} className="sm:col-span-2">
              <Input autoFocus value={f.title} maxLength={200} placeholder="Ej.: Atención al cliente telefónica" onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <Textarea rows={3} value={f.description} maxLength={5000} placeholder="¿De qué se trata el curso y a quién está dirigido?" onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Autor"><Input value={f.author} maxLength={200} onChange={(e) => set('author', e.target.value)} /></Field>
            <Field label="Categoría">
              <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}
                options={[{ value: '', label: cats.isLoading ? 'Cargando…' : 'Sin categoría' }, ...(cats.data || []).map((c) => ({ value: String(c.id), label: c.name }))]} />
            </Field>
            <Field label="Imagen de portada" className="sm:col-span-2"><MediaField accept="image" value={f.coverImage} onChange={(v) => set('coverImage', v)} /></Field>
            <Field label="Duración estimada"><Input value={f.duration} maxLength={80} placeholder="Ej.: 45 minutos" onChange={(e) => set('duration', e.target.value)} /></Field>
            <Field label="Nivel"><Select value={f.level} onChange={(e) => set('level', e.target.value)} options={LEVELS.map((l) => ({ value: l, label: l }))} /></Field>
            <Field label="Idioma"><Select value={f.language} onChange={(e) => set('language', e.target.value)} options={LANGS} /></Field>
            <Field label="Versión"><Input value={f.version} maxLength={20} onChange={(e) => set('version', e.target.value)} /></Field>
            <Field label="Estado" className="sm:col-span-2" hint={!can('courses.publish') ? 'Sólo un administrador puede publicar cursos.' : undefined}>
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
                {(['draft', 'published'] as const).map((s) => (
                  <button key={s} type="button" disabled={s === 'published' && !can('courses.publish')} onClick={() => set('status', s)}
                    className={clsx('rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
                      f.status === s ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                    {s === 'draft' ? 'Borrador' : 'Publicado'}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 'detalles' && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Objetivos de aprendizaje" hint="Uno por línea. Se muestran en la portada del curso.">
              <Textarea rows={6} value={f.objectives} placeholder={'Identificar las partes de la interfaz\nCrear fórmulas básicas\nDar formato a una planilla'} onChange={(e) => set('objectives', e.target.value)} />
            </Field>
            <Field label="Requisitos previos" hint="Uno por línea (opcional).">
              <Textarea rows={4} value={f.requirements} placeholder={'Manejo básico de Windows'} onChange={(e) => set('requirements', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'diseno' && (
          <div className="space-y-5">
            <div>
              <div className="label">Tema visual</div>
              <ThemePicker value={f.themeId} onChange={(v) => set('themeId', v)} />
              {f.templateId && <p className="mt-1.5 text-[11.5px] text-slate-500">Si elegís un tema, reemplaza el de la plantilla.</p>}
            </div>
            <div>
              <div className="label">Empezar desde</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <button type="button" onClick={() => set('templateId', null)}
                  className={clsx('group overflow-hidden rounded-lg border text-left transition', f.templateId === null ? 'border-brand-500 ring-2 ring-brand-500/25' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
                  <div className="grid aspect-video place-items-center bg-slate-50 text-slate-400 dark:bg-slate-800"><FilePlus2 className="h-8 w-8" /></div>
                  <div className="flex items-center gap-1.5 p-2 text-sm font-medium">{f.templateId === null && <Check className="h-3.5 w-3.5 text-brand-600" />}En blanco</div>
                </button>
                {tpls.isLoading && <div className="grid place-items-center"><Spinner /></div>}
                {(tpls.data || []).map((t) => (
                  <button key={t.id} type="button" onClick={() => set('templateId', t.id)} title={t.description || undefined}
                    className={clsx('group overflow-hidden rounded-lg border text-left transition', f.templateId === t.id ? 'border-brand-500 ring-2 ring-brand-500/25' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
                    <TemplateThumb svg={t.thumbnail} className="aspect-video" />
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium">{f.templateId === t.id && <Check className="h-3.5 w-3.5 flex-none text-brand-600" />}<span className="truncate">{t.name}</span></div>
                      <div className="text-[11px] text-slate-500">{t.summary?.modules ?? 0} módulos</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
