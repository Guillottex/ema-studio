import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Modal, Spinner } from '../../components/ui';
import { ReportView, type ValidationReportData } from './ReportView';

export function ValidateDialog({ courseId, open, onClose, onGoTo }: { courseId: string; open: boolean; onClose(): void; onGoTo(screenId: string, componentId?: string): void }) {
  const [report, setReport] = useState<ValidationReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await api.post<ValidationReportData>(`/courses/${courseId}/validate`));
    } catch (e: any) {
      setError(e?.message || 'No se pudo validar el curso');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (open) run();
    else { setReport(null); setError(null); }
  }, [open, run]);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={<span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-600" />Validar curso</span>}
      description="Revisamos estructura, pantallas, recursos, navegación, evaluaciones y el paquete SCORM 1.2."
      footer={<>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="primary" loading={loading} icon={<RefreshCw className="h-4 w-4" />} onClick={run}>Volver a validar</Button>
      </>}>
      {loading && !report ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Spinner className="h-7 w-7" />Validando el curso…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          ❌ {error}
        </div>
      ) : report ? (
        <div className={loading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
          <ReportView report={report} onGoTo={(sid, cid) => { onGoTo(sid, cid); onClose(); }} />
        </div>
      ) : null}
    </Modal>
  );
}
