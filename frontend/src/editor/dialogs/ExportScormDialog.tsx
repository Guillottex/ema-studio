import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, FileArchive, HelpCircle, Loader2, Package, RefreshCw, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtBytes, fmtDate } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, IconButton, Modal, Spinner, clsx, confirmDialog } from '../../components/ui';
import { IssuesList, ReportSummary, type ValidationReportData } from './ReportView';

const STEPS = [
  'Validar curso',
  'Validar pantallas',
  'Validar recursos',
  'Validar navegación',
  'Validar evaluaciones',
  'Generar archivos',
  'Generar imsmanifest.xml',
  'Generar JavaScript SCORM',
  'Empaquetar ZIP',
  'Descargar',
];
const VALIDATION_STEPS = 5;
/** Paso del checklist al que corresponde cada código de problema */
const STEP_PREFIXES: [number, string[]][] = [
  [0, ['course.', 'module.', 'lesson.', 'id.']],
  [1, ['screen.', 'component.']],
  [2, ['asset.', 'media.', 'link.']],
  [3, ['nav.', 'action.', 'condition.']],
  [4, ['question.', 'quiz.', 'completion.']],
  [6, ['manifest.']],
  [7, ['engine.']],
];
function stepsWithErrors(report: ValidationReportData): Set<number> {
  const out = new Set<number>();
  report.issues.filter((i) => i.level === 'error').forEach((i) => {
    const hit = STEP_PREFIXES.find(([, pre]) => pre.some((p) => i.code.startsWith(p)));
    out.add(hit ? hit[0] : 0);
  });
  if (!out.size) out.add(0);
  return out;
}

type Phase = 'idle' | 'running' | 'done' | 'failed';
type StepState = 'pending' | 'active' | 'done' | 'error';

interface ExportResult { id: string; fileName: string; size: number; files: number; report: ValidationReportData; downloadUrl: string }
interface ExportRow { id: string; version: string; file_name: string; size: number | null; created_at: string; warnings: number | null; created_by_name: string | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripApi = (u: string) => (u.startsWith('/api/') ? u.slice(4) : u);

export function ExportScormDialog({ courseId, courseTitle, open, onClose }: { courseId: string; courseTitle?: string; open: boolean; onClose(): void }) {
  const { can } = useAuth();
  const canExport = can('courses.export');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(-1); // índice del paso activo
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [failedSteps, setFailedSteps] = useState<Set<number> | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [failReport, setFailReport] = useState<ValidationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exports, setExports] = useState<ExportRow[] | null>(null);
  const [exportsError, setExportsError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const alive = useRef(true);

  const loadExports = useCallback(async () => {
    setExportsError(null);
    try {
      setExports(await api.get<ExportRow[]>(`/courses/${courseId}/exports`));
    } catch (e: any) {
      setExportsError(e?.message || 'No se pudieron cargar las exportaciones');
    }
  }, [courseId]);

  const reset = () => {
    setPhase('idle'); setProgress(-1); setFailedAt(null); setFailedSteps(null); setResult(null); setFailReport(null); setError(null); setDownloadError(null);
  };

  useEffect(() => {
    alive.current = true;
    if (open) { reset(); setExports(null); loadExports(); }
    return () => { alive.current = false; };
  }, [open, loadExports]);

  const stepState = (i: number): StepState => {
    if (failedSteps) {
      if (failedSteps.has(i)) return 'error';
      return i < VALIDATION_STEPS ? 'done' : 'pending';
    }
    if (failedAt !== null) {
      if (i < failedAt) return 'done';
      if (i === failedAt) return 'error';
      return 'pending';
    }
    if (phase === 'done') return 'done';
    if (i < progress) return 'done';
    if (i === progress) return phase === 'running' ? 'active' : 'pending';
    return 'pending';
  };

  const download = async (url: string, name: string) => {
    await api.download(stripApi(url), name);
  };

  const run = async () => {
    reset();
    setPhase('running');
    setProgress(0);
    // Avance visual mientras el servidor valida y empaqueta (se detiene antes de "Empaquetar ZIP")
    let cur = 0;
    const timer = setInterval(() => {
      if (cur < 7) { cur++; if (alive.current) setProgress(cur); }
    }, 350);
    try {
      const res = await api.post<ExportResult>(`/courses/${courseId}/export-scorm`);
      clearInterval(timer);
      for (let i = cur + 1; i <= 8; i++) { if (!alive.current) return; setProgress(i); await sleep(180); }
      if (!alive.current) return;
      setResult(res);
      setProgress(9);
      try {
        await download(res.downloadUrl, res.fileName);
      } catch (e: any) {
        setDownloadError(e?.message || 'No se pudo descargar el archivo');
      }
      if (!alive.current) return;
      setPhase('done');
      toast.success('Paquete SCORM 1.2 generado');
      loadExports();
    } catch (e: any) {
      clearInterval(timer);
      if (!alive.current) return;
      setPhase('failed');
      if (e instanceof ApiError && e.status === 422 && e.data?.report) {
        setFailReport(e.data.report as ValidationReportData);
        setFailedSteps(stepsWithErrors(e.data.report as ValidationReportData));
        setError(e.message);
      } else {
        setFailedAt(Math.max(VALIDATION_STEPS, Math.min(cur, 8)));
        setError(e?.message || 'No se pudo exportar el curso');
      }
    }
  };

  const removeExport = async (row: ExportRow) => {
    const ok = await confirmDialog({ title: 'Eliminar exportación', message: <>Se eliminará el archivo <b>{row.file_name}</b> del servidor. Esta acción no se puede deshacer.</>, danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    setBusyRow(row.id);
    try {
      await api.del(`/exports/${row.id}`);
      setExports((list) => (list || []).filter((x) => x.id !== row.id));
      toast.success('Exportación eliminada');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusyRow(null);
    }
  };

  const downloadRow = async (row: ExportRow) => {
    setBusyRow(row.id);
    try { await download(`/exports/${row.id}/download`, row.file_name); } catch (e) { toast.error(e); } finally { setBusyRow(null); }
  };

  const warnings = result?.report?.warnings || 0;

  return (
    <Modal open={open} onClose={phase === 'running' ? () => undefined : onClose} size="lg"
      title={<span className="flex items-center gap-2"><Package className="h-5 w-5 text-brand-600" />Exportar SCORM 1.2</span>}
      description={courseTitle ? <>Curso: <b className="text-slate-700 dark:text-slate-200">{courseTitle}</b></> : 'Generá un paquete ZIP listo para subir a tu LMS.'}
      footer={<>
        <Button onClick={onClose} disabled={phase === 'running'}>Cerrar</Button>
        {canExport && (
          <Button variant="primary" loading={phase === 'running'} icon={phase === 'idle' ? <FileArchive className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} onClick={run}>
            {phase === 'idle' || phase === 'running' ? 'Exportar SCORM 1.2' : 'Exportar de nuevo'}
          </Button>
        )}
      </>}>
      <div className="space-y-5">
        {!canExport && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            No tenés permiso para exportar cursos. Pedile a un administrador que lo haga.
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
          {/* Pasos */}
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const st = stepState(i);
              return (
                <li key={s} className={clsx('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                  st === 'active' && 'bg-brand-50 dark:bg-brand-900/20', st === 'error' && 'bg-red-50 dark:bg-red-900/20')}>
                  <span className={clsx('grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-semibold transition-colors',
                    st === 'done' ? 'bg-emerald-500 text-white' : st === 'error' ? 'bg-red-500 text-white' : st === 'active' ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300')}>
                    {st === 'done' ? <Check className="h-3 w-3" /> : st === 'error' ? <X className="h-3 w-3" /> : st === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                  </span>
                  <span className={clsx(st === 'pending' ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100', st === 'error' && 'font-medium text-red-700 dark:text-red-300')}>{s}</span>
                </li>
              );
            })}
          </ol>

          {/* Estado / resultado */}
          <div className="min-w-0">
            {phase === 'idle' && (
              <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <p>Antes de generar el paquete validamos todo el curso. Si hay errores no se descarga nada y te mostramos qué corregir.</p>
                <p className="mt-2">El ZIP incluye <span className="kbd">imsmanifest.xml</span>, el reproductor, los recursos y el JavaScript de comunicación con el LMS (SCORM 1.2).</p>
              </div>
            )}
            {phase === 'running' && (
              <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                <Spinner className="h-7 w-7" />
                <span>{STEPS[Math.max(0, progress)]}…</span>
              </div>
            )}
            {phase === 'done' && result && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-900/20">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-200">✅ Paquete generado</div>
                  <div className="mt-1 break-all text-emerald-900 dark:text-emerald-100">{result.fileName}</div>
                  <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{fmtBytes(result.size)} · {result.files} archivos{warnings ? ` · ${warnings} advertencia${warnings === 1 ? '' : 's'}` : ''}</div>
                  <Button size="sm" className="mt-3" icon={<Download className="h-4 w-4" />} onClick={() => download(result.downloadUrl, result.fileName).catch((e) => toast.error(e))}>Descargar otra vez</Button>
                </div>
                {downloadError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">❌ {downloadError}</div>}
                {warnings > 0 && <IssuesList issues={result.report.issues} levels={['warning']} />}
              </div>
            )}
            {phase === 'failed' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  ❌ {error}{failReport ? '. No se generó ningún archivo.' : ''}
                </div>
                {failReport && (<>
                  <ReportSummary report={failReport} />
                  <IssuesList issues={failReport.issues} />
                </>)}
              </div>
            )}
          </div>
        </div>

        {/* Ayuda LMS */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60">
            <HelpCircle className="h-4 w-4 text-brand-600" />Cómo subir el ZIP a tu LMS
            <span className="ml-auto text-xs text-slate-400">{showHelp ? 'Ocultar' : 'Ver'}</span>
          </button>
          {showHelp && (
            <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <p><b>Moodle:</b> entrá al curso, activá la edición y elegí <i>Agregar una actividad o un recurso → Paquete SCORM</i>. Subí el ZIP en “Paquete”, revisá las opciones de calificación y guardá.</p>
              <p><b>Cualquier LMS compatible con SCORM 1.2:</b> subí el archivo ZIP <b>tal cual, sin descomprimirlo</b>. El LMS lee el <span className="kbd">imsmanifest.xml</span> y registra el estado, la nota, el tiempo y el punto de reanudación de cada alumno.</p>
              <p className="text-xs text-slate-500">Consejo: después de subirlo, probá el curso con un usuario alumno para verificar que la finalización se registre bien.</p>
            </div>
          )}
        </div>

        {/* Exportaciones anteriores */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Exportaciones anteriores</h4>
          {exportsError ? (
            <div className="flex items-center gap-2 text-sm text-red-600">❌ {exportsError}<Button size="xs" onClick={loadExports}>Reintentar</Button></div>
          ) : exports === null ? (
            <div className="flex h-16 items-center justify-center"><Spinner /></div>
          ) : exports.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no exportaste este curso.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {exports.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileArchive className="h-4 w-4 flex-none text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100" title={row.file_name}>{row.file_name}</div>
                    <div className="text-xs text-slate-500">
                      v{row.version} · {fmtDate(row.created_at)} · {fmtBytes(row.size)}{row.created_by_name ? ` · ${row.created_by_name}` : ''}
                    </div>
                  </div>
                  {!!row.warnings && <Badge color="amber">⚠️ {row.warnings}</Badge>}
                  {busyRow === row.id ? <Spinner className="h-4 w-4" /> : (<>
                    <IconButton title="Descargar" onClick={() => downloadRow(row)}><Download className="h-4 w-4" /></IconButton>
                    {canExport && <IconButton title="Eliminar" onClick={() => removeExport(row)}><Trash2 className="h-4 w-4 text-red-500" /></IconButton>}
                  </>)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
