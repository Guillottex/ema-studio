import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Wand2, ListTree, FileUp, FileText, AlertTriangle, CheckCircle2, Loader2, X, Upload, ClipboardPaste } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { fmtBytes } from '../lib/format';
import { Button, clsx, Empty, Field, Input, PageHeader, Select, Switch, Tabs, Textarea } from '../components/ui';
import { ThemePicker } from './parts/courses-shared';

interface AIStatus { provider: string; configured: boolean; model: string | null; importFormats: string[] }
type Tab = 'describe' | 'import';

const LEVELS = ['Básico', 'Intermedio', 'Avanzado'];
const LANGS = [{ value: 'español', label: 'Español' }, { value: 'inglés', label: 'Inglés' }, { value: 'portugués', label: 'Portugués' }];
const ACCEPT = '.txt,.md,.docx,.pdf';

function useElapsed(active: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) { setS(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

function Busy({ title, hint, elapsed }: { title: string; hint: string; elapsed: number }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-900/20 dark:text-violet-200" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 flex-none animate-spin" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs opacity-80">{hint}</div>
      </div>
      <span className="font-mono text-xs tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
    </div>
  );
}

function Panel({ title, icon, children, className }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card p-5', className)}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">{icon}{title}</h2>
      {children}
    </section>
  );
}

export default function AIGenerate() {
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('describe');
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<AIStatus>('/ai/status') });
  const configured = !!status.data?.configured;

  /* ------------------------------ describir ------------------------------ */
  const [brief, setBrief] = useState({ prompt: '', audience: '', duration: '', level: 'Básico', modules: 4, language: 'español' });
  const [themeId, setThemeId] = useState<string | null>(null);
  const setB = <K extends keyof typeof brief>(k: K, v: (typeof brief)[K]) => setBrief((p) => ({ ...p, [k]: v }));

  const done = (courseId: string, msg: string) => {
    qc.invalidateQueries({ queryKey: ['courses'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(msg);
    nav(`/cursos/${courseId}/editor`);
  };

  const generate = useMutation({
    mutationFn: (mode: 'ai' | 'structure') => api.post<{ courseId: string; mode: string }>('/ai/generate-course', {
      prompt: brief.prompt.trim(),
      audience: brief.audience.trim() || undefined,
      duration: brief.duration.trim() || undefined,
      level: brief.level,
      modules: brief.modules,
      language: brief.language,
      mode,
      themeId,
    }),
    onSuccess: (r) => done(r.courseId, r.mode === 'ai' ? 'Curso generado con IA. Revisá y ajustá el contenido.' : 'Estructura creada. Completá los textos marcados con [Completar].'),
    onError: (e) => toast.error(e),
  });
  const promptOk = brief.prompt.trim().length >= 5;
  const genElapsed = useElapsed(generate.isPending);

  /* ------------------------------ importar ------------------------------ */
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [impTheme, setImpTheme] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!configured) setUseAI(false); }, [configured]);

  const pickFile = (f?: File | null) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'md', 'docx', 'pdf'].includes(ext)) { toast.error('Formato no admitido. Usá .txt, .md, .docx o .pdf'); return; }
    setFile(f);
  };

  const importM = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (file) fd.append('file', file);
      else fd.append('text', text);
      if (title.trim()) fd.append('title', title.trim());
      fd.append('useAI', String(useAI && configured));
      if (impTheme) fd.append('themeId', impTheme);
      return api.upload<{ courseId: string; modules: number }>('/ai/import-content', fd);
    },
    onSuccess: (r) => done(r.courseId, `Curso creado con ${r.modules} módulo${r.modules === 1 ? '' : 's'} a partir del contenido`),
    onError: (e) => toast.error(e),
  });
  const importOk = !!file || text.trim().length > 0;
  const impElapsed = useElapsed(importM.isPending);
  const busy = generate.isPending || importM.isPending;

  if (!can('courses.create')) {
    return (
      <div>
        <PageHeader title="Generar con IA" icon={<Sparkles className="h-5 w-5" />} />
        <Empty icon={<Sparkles className="h-10 w-10" />} title="No tenés permiso para crear cursos">Pedile a un administrador que te asigne el rol de autor.</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Generar con IA" icon={<Sparkles className="h-5 w-5" />}
        description="Armá un curso a partir de una descripción o de un documento existente. El resultado queda como borrador editable." />

      {/* Estado del proveedor */}
      {status.isLoading ? null : configured ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span>IA configurada: <b>{status.data!.provider}</b>{status.data!.model ? <> · modelo <span className="font-mono text-xs">{status.data!.model}</span></> : null}</span>
        </div>
      ) : (
        <div className="mb-5 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <b>La generación con IA no está configurada.</b> Un administrador tiene que definir <code className="kbd">AI_PROVIDER</code> y <code className="kbd">AI_API_KEY</code> en el archivo <code className="kbd">.env</code> del servidor y reiniciarlo.
            Mientras tanto podés usar <b>“Crear estructura (sin IA)”</b> o importar un documento sin reestructurar.
          </div>
        </div>
      )}

      <Tabs<Tab> className="mb-5" value={tab} onChange={(t) => !busy && setTab(t)} tabs={[
        { id: 'describe', label: 'Describir el curso', icon: <Wand2 className="h-4 w-4" /> },
        { id: 'import', label: 'Importar contenido', icon: <FileUp className="h-4 w-4" /> },
      ]} />

      {tab === 'describe' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel title="¿Qué curso querés crear?" className="lg:col-span-2">
            <fieldset disabled={busy} className="space-y-4">
              <Field label="Descripción del curso *" hint="Contá el tema, el objetivo y cualquier detalle que tenga que incluir (procedimientos, normas, ejemplos).">
                <Textarea rows={6} value={brief.prompt} maxLength={4000} onChange={(e) => setB('prompt', e.target.value)}
                  placeholder="Crear un curso sobre seguridad e higiene para empleados de una empresa de servicios." />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Audiencia"><Input value={brief.audience} maxLength={300} placeholder="Ej.: personal operativo de sucursales" onChange={(e) => setB('audience', e.target.value)} /></Field>
                <Field label="Duración estimada"><Input value={brief.duration} maxLength={60} placeholder="Ej.: 1 hora" onChange={(e) => setB('duration', e.target.value)} /></Field>
                <Field label="Nivel"><Select value={brief.level} onChange={(e) => setB('level', e.target.value)} options={LEVELS.map((l) => ({ value: l, label: l }))} /></Field>
                <Field label="Idioma del contenido"><Select value={brief.language} onChange={(e) => setB('language', e.target.value)} options={LANGS} /></Field>
                <Field label={<>Cantidad de módulos: <b className="text-slate-900 dark:text-white">{brief.modules}</b></>} className="sm:col-span-2">
                  <input type="range" min={1} max={12} step={1} value={brief.modules} onChange={(e) => setB('modules', Number(e.target.value))} className="w-full accent-brand-600" aria-label="Cantidad de módulos" />
                  <div className="flex justify-between text-[11px] text-slate-400"><span>1</span><span>12</span></div>
                </Field>
              </div>
            </fieldset>
          </Panel>

          <div className="space-y-5">
            <Panel title="Tema visual">
              <fieldset disabled={busy}><ThemePicker compact value={themeId} onChange={setThemeId} /></fieldset>
            </Panel>
            <Panel title="Crear">
              <div className="space-y-3">
                <Button variant="primary" size="lg" className="w-full bg-violet-600 hover:bg-violet-700" icon={<Sparkles className="h-4 w-4" />}
                  disabled={!configured || !promptOk || busy} loading={generate.isPending && generate.variables === 'ai'} onClick={() => generate.mutate('ai')}>
                  Generar con IA
                </Button>
                <p className="text-[11.5px] text-slate-500">
                  {configured ? 'Redacta módulos, lecciones, pantallas y preguntas de repaso. Puede tardar uno o dos minutos.' : 'No disponible: falta configurar AI_PROVIDER y AI_API_KEY en el .env.'}
                </p>
                <div className="divider" />
                <Button className="w-full" icon={<ListTree className="h-4 w-4" />} disabled={!promptOk || busy}
                  loading={generate.isPending && generate.variables === 'structure'} onClick={() => generate.mutate('structure')}>
                  Crear estructura (sin IA)
                </Button>
                <p className="text-[11.5px] text-slate-500">Crea un esqueleto editable con la cantidad de módulos elegida y textos <code className="kbd">[Completar]</code> para que los redactes vos.</p>
                {!promptOk && <p className="text-[11.5px] text-amber-600 dark:text-amber-400">Escribí una descripción de al menos 5 caracteres.</p>}
              </div>
            </Panel>
          </div>

          {generate.isPending && (
            <div className="lg:col-span-3">
              <Busy elapsed={genElapsed} title={generate.variables === 'ai' ? 'Generando el curso con IA…' : 'Creando la estructura del curso…'}
                hint={generate.variables === 'ai' ? 'No cierres esta página. Al terminar se abre el editor automáticamente.' : 'En un momento se abre el editor.'} />
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel title="Contenido de origen" className="lg:col-span-2">
            <fieldset disabled={busy} className="space-y-4">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-slate-500">{fmtBytes(file.size)}</div>
                  </div>
                  <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setFile(null)}>Quitar</Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
                  className={clsx('flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
                    drag ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-slate-300 hover:border-brand-400 dark:border-slate-700')}>
                  <Upload className="mb-2 h-7 w-7 text-slate-400" />
                  <span className="text-sm font-medium">Arrastrá un archivo o hacé clic para elegirlo</span>
                  <span className="mt-0.5 text-xs text-slate-500">Formatos: .txt, .md, .docx, .pdf (hasta 30 MB)</span>
                </button>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />o pegá el texto<span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>

              <Field hint={file ? 'Se usa el archivo seleccionado; quitalo para importar el texto pegado.' : undefined}>
                <Textarea rows={10} value={text} disabled={!!file} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]"
                  placeholder={'# Módulo 1: Introducción\n## Lección 1: Conceptos básicos\n### ¿Qué es la seguridad e higiene?\nTexto de la pantalla…\n- Viñeta 1\n- Viñeta 2'} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Título del curso" hint={file ? 'Si lo dejás vacío se usa el nombre del archivo.' : 'Opcional.'}>
                  <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Manual de procedimientos" />
                </Field>
                <div className="sm:pt-5">
                  <Switch checked={useAI && configured} disabled={!configured} onChange={setUseAI} label="Usar IA para reestructurar"
                    hint={configured ? 'Reorganiza el contenido en módulos, lecciones y pantallas, respetando el texto original.' : 'Requiere configurar la IA en el servidor.'} />
                </div>
              </div>
            </fieldset>
          </Panel>

          <div className="space-y-5">
            <Panel title="Cómo se arma el curso" icon={<ClipboardPaste className="h-4 w-4 text-slate-400" />}>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Sin IA, el contenido se divide según sus títulos (en Word, los estilos Título 1, 2 y 3):</p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex gap-2"><code className="kbd flex-none">#</code><span>Módulo</span></li>
                <li className="flex gap-2"><code className="kbd flex-none">##</code><span>Lección</span></li>
                <li className="flex gap-2"><code className="kbd flex-none">###</code><span>Pantalla</span></li>
                <li className="flex gap-2"><code className="kbd flex-none">-</code><span>Viñetas dentro de la pantalla</span></li>
              </ul>
              <p className="mt-3 text-[11.5px] text-slate-500">Si el texto no tiene títulos, se agrupa por párrafos en pantallas de unas 150 palabras, con 5 pantallas por lección.</p>
            </Panel>
            <Panel title="Tema visual">
              <fieldset disabled={busy}><ThemePicker compact value={impTheme} onChange={setImpTheme} /></fieldset>
            </Panel>
            <Button variant="primary" size="lg" className="w-full" icon={useAI && configured ? <Sparkles className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
              disabled={!importOk || busy} loading={importM.isPending} onClick={() => importM.mutate()}>
              {useAI && configured ? 'Importar y reestructurar con IA' : 'Crear curso desde el contenido'}
            </Button>
          </div>

          {importM.isPending && (
            <div className="lg:col-span-3">
              <Busy elapsed={impElapsed} title={useAI && configured ? 'Reestructurando el contenido con IA…' : 'Procesando el contenido…'}
                hint="No cierres esta página. Al terminar se abre el editor automáticamente." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
