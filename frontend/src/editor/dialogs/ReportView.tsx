import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from '../../components/ui';

export type ReportLevel = 'ok' | 'warning' | 'error';

export interface ReportIssue {
  level: ReportLevel;
  code: string;
  message: string;
  where?: string;
  screenId?: string;
  componentId?: string;
}

export interface ReportCheck { name: string; level: ReportLevel; detail: string }

export interface ValidationReportData {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: ReportIssue[];
  checks: ReportCheck[];
  files?: number;
}

export const LEVEL_ICON: Record<ReportLevel, string> = { ok: '✅', warning: '⚠️', error: '❌' };

/** Resumen con contadores (correctos / advertencias / errores / archivos). */
export function ReportSummary({ report }: { report: ValidationReportData }) {
  const okChecks = report.checks.filter((c) => c.level === 'ok').length;
  const box = 'rounded-lg border px-3 py-2.5';
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className={clsx(box, 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20')}>
        <div className="text-xs text-emerald-700 dark:text-emerald-300">✅ Correcto</div>
        <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">{okChecks}<span className="ml-1 text-xs font-normal">/ {report.checks.length} controles</span></div>
      </div>
      <div className={clsx(box, 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20')}>
        <div className="text-xs text-amber-700 dark:text-amber-300">⚠️ Advertencias</div>
        <div className="text-xl font-semibold text-amber-800 dark:text-amber-200">{report.warnings}</div>
      </div>
      <div className={clsx(box, 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20')}>
        <div className="text-xs text-red-700 dark:text-red-300">❌ Errores</div>
        <div className="text-xl font-semibold text-red-800 dark:text-red-200">{report.errors}</div>
      </div>
      <div className={clsx(box, 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40')}>
        <div className="text-xs text-slate-500">📦 Archivos del paquete</div>
        <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{report.files ?? '—'}</div>
      </div>
    </div>
  );
}

/** Lista de controles realizados. */
export function ChecksList({ checks }: { checks: ReportCheck[] }) {
  if (!checks.length) return null;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {checks.map((c, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-5 text-center" aria-hidden>{LEVEL_ICON[c.level] || '•'}</span>
          <span className="flex-1 font-medium text-slate-800 dark:text-slate-100">{c.name}</span>
          <span className={clsx('text-xs', c.level === 'error' ? 'text-red-600 dark:text-red-400' : c.level === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500')}>{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Problemas agrupados por nivel y luego por ubicación ("where"). */
export function IssuesList({ issues, onGoTo, levels = ['error', 'warning'] }: { issues: ReportIssue[]; onGoTo?(screenId: string, componentId?: string): void; levels?: ReportLevel[] }) {
  const groups = useMemo(() => levels.map((lvl) => {
    const list = issues.filter((i) => i.level === lvl);
    const byWhere = new Map<string, ReportIssue[]>();
    list.forEach((i) => {
      const k = i.where || 'Curso';
      if (!byWhere.has(k)) byWhere.set(k, []);
      byWhere.get(k)!.push(i);
    });
    return { lvl, count: list.length, byWhere: [...byWhere.entries()] };
  }).filter((g) => g.count > 0), [issues, levels]);

  if (!groups.length) return null;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.lvl}>
          <h4 className={clsx('mb-2 text-sm font-semibold', g.lvl === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
            {LEVEL_ICON[g.lvl]} {g.lvl === 'error' ? 'Errores' : 'Advertencias'} ({g.count})
          </h4>
          <div className="space-y-2">
            {g.byWhere.map(([where, list]) => (
              <div key={where} className="rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">{where}</div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((i, k) => {
                    const clickable = !!(i.screenId && onGoTo);
                    const inner = (
                      <>
                        <span className="w-5 flex-none text-center" aria-hidden>{LEVEL_ICON[i.level]}</span>
                        <span className="flex-1 text-left">{i.message}</span>
                        {clickable && <span className="flex flex-none items-center text-xs text-brand-600 dark:text-brand-300">Ir<ChevronRight className="h-3.5 w-3.5" /></span>}
                      </>
                    );
                    return (
                      <li key={k}>
                        {clickable ? (
                          <button type="button" onClick={() => onGoTo!(i.screenId!, i.componentId)} className="flex w-full items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60" title="Ir a la pantalla">
                            {inner}
                          </button>
                        ) : (
                          <div className="flex items-start gap-2 px-3 py-2 text-sm">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Vista completa de un reporte de validación. */
export function ReportView({ report, onGoTo, showChecks = true }: { report: ValidationReportData; onGoTo?(screenId: string, componentId?: string): void; showChecks?: boolean }) {
  return (
    <div className="space-y-4">
      <ReportSummary report={report} />
      {report.valid ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
          {report.warnings ? 'El curso se puede exportar, pero revisá las advertencias.' : 'Todo en orden: el curso está listo para exportarse como SCORM 1.2.'}
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200">
          Hay errores que impiden exportar el curso. Corregilos y volvé a validar.
        </div>
      )}
      {showChecks && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Controles</h4>
          <ChecksList checks={report.checks} />
        </div>
      )}
      <IssuesList issues={report.issues} onGoTo={onGoTo} />
    </div>
  );
}
