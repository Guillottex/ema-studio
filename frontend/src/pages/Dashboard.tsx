import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, CheckCircle2, PencilLine, Layers, MonitorPlay, CircleHelp, Images, PackageCheck, Plus, Sparkles, ArrowRight, Download, ChevronRight, Info, LayoutDashboard,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { fmtBytes, fmtDate, fmtRelative } from '../lib/format';
import { Button, clsx, Empty, IconButton, PageHeader, PageLoader } from '../components/ui';
import { CourseCover, StatusBadge } from './parts/courses-shared';

interface DashboardData {
  stats: {
    courses: number; published: number; drafts: number; modules: number; lessons: number; screens: number;
    questions: number; media: number; media_bytes: number | string; exports: number; templates: number; users: number;
  };
  recent: { id: string; title: string; status: string; version: string; cover_image: string | null; updated_at: string; updated_by_name: string | null; modules: number }[];
  exports: { id: string; file_name: string; size: number | null; created_at: string; title: string }[];
  byCategory: { name: string; color: string; n: number }[];
}

const TONES = {
  blue: 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function Stat({ label, value, icon, tone, sub, to }: { label: string; value: ReactNode; icon: ReactNode; tone: keyof typeof TONES; sub?: ReactNode; to?: string }) {
  const body = (
    <div className={clsx('card flex h-full items-start gap-3 p-4 transition', to && 'hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700')}>
      <div className={clsx('grid h-10 w-10 flex-none place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', TONES[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums leading-tight text-slate-900 dark:text-white">{value}</div>
        <div className="truncate text-[13px] text-slate-500 dark:text-slate-400">{label}</div>
        {sub && <div className="mt-0.5 truncate text-[11.5px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl">{body}</Link> : body;
}

const n = (v: number | string | undefined) => Number(v || 0).toLocaleString('es-AR');

export default function Dashboard() {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.name?.split(' ')[0] || '';

  const downloadExport = async (e: DashboardData['exports'][number]) => {
    try { await api.download(`/exports/${e.id}/download`, e.file_name); } catch (err) { toast.error(err); }
  };

  const headerActions = can('courses.create') ? (
    <>
      <Link to="/generar-ia" className="btn btn-lg btn-secondary border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20">
        <Sparkles className="h-4 w-4" />Generar con IA
      </Link>
      <Button variant="primary" size="lg" icon={<Plus className="h-4 w-4" />} onClick={() => nav('/cursos?nuevo=1')}>Nuevo curso</Button>
    </>
  ) : undefined;

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" icon={<LayoutDashboard className="h-5 w-5" />} />
        <Empty title="No se pudo cargar el resumen" action={<Button onClick={() => refetch()}>Reintentar</Button>}>{(error as Error)?.message}</Empty>
      </div>
    );
  }

  const s = data.stats;
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.n));
  const pubPct = s.courses ? Math.round((s.published / s.courses) * 100) : 0;

  return (
    <div>
      <PageHeader title={`${greet}${firstName ? `, ${firstName}` : ''}`} description="Resumen de la actividad de autoría del Estudio e-learning de EMA Servicios." actions={headerActions} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cursos creados" value={n(s.courses)} icon={<BookOpen />} tone="blue" to="/cursos" sub={s.courses ? `${pubPct}% publicados` : 'Todavía no hay cursos'} />
        <Stat label="Publicados" value={n(s.published)} icon={<CheckCircle2 />} tone="green" />
        <Stat label="En edición (borradores)" value={n(s.drafts)} icon={<PencilLine />} tone="amber" />
        <Stat label="Exportaciones SCORM" value={n(s.exports)} icon={<PackageCheck />} tone="violet" />
        <Stat label="Módulos" value={n(s.modules)} icon={<Layers />} tone="cyan" sub={`${n(s.lessons)} lecciones`} />
        <Stat label="Pantallas" value={n(s.screens)} icon={<MonitorPlay />} tone="slate" />
        <Stat label="Preguntas en el banco" value={n(s.questions)} icon={<CircleHelp />} tone="rose" to="/preguntas" />
        <Stat label="Recursos multimedia" value={n(s.media)} icon={<Images />} tone="blue" to="/biblioteca" sub={`${fmtBytes(Number(s.media_bytes || 0))} en total`} />
      </section>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info className="h-3.5 w-3.5 flex-none" />El seguimiento de participantes (inscripciones, avance y calificaciones) se realiza en el LMS donde se publica el paquete SCORM.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Últimos cursos modificados</h2>
            <Link to="/cursos" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">Ver todos<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="p-5">
              <Empty icon={<BookOpen className="h-10 w-10" />} title="Todavía no hay cursos"
                action={can('courses.create') && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => nav('/cursos?nuevo=1')}>Crear el primer curso</Button>}>
                Creá un curso en blanco, desde una plantilla o generalo a partir de una descripción.
              </Empty>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => nav(can('courses.edit') ? `/cursos/${c.id}/editor` : `/cursos/${c.id}/preview`)}
                    className="group flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <CourseCover src={c.cover_image} title={c.title} className="h-12 w-20 flex-none rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{c.title}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        v{c.version} · {c.modules} módulo{c.modules === 1 ? '' : 's'} · <span title={fmtDate(c.updated_at)}>{fmtRelative(c.updated_at)}</span>{c.updated_by_name ? ` por ${c.updated_by_name}` : ''}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                    <ChevronRight className="hidden h-4 w-4 flex-none text-slate-300 group-hover:text-slate-500 sm:block" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">Cursos por categoría</h2></div>
            <div className="px-5 py-4">
              {data.byCategory.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Sin datos todavía.</p> : (
                <ul className="space-y-3">
                  {data.byCategory.map((c) => (
                    <li key={c.name}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: c.color }} /><span className="truncate">{c.name}</span></span>
                        <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{c.n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${c.name}: ${c.n} cursos`}>
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(c.n / maxCat) * 100}%`, backgroundColor: c.color }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">Exportaciones SCORM recientes</h2></div>
            {data.exports.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Aún no se exportó ningún curso. Las exportaciones se hacen desde el editor.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.exports.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"><PackageCheck className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" title={e.file_name}>{e.title}</div>
                      <div className="truncate text-[11.5px] text-slate-500"><span title={fmtDate(e.created_at)}>{fmtRelative(e.created_at)}</span> · {fmtBytes(e.size)}</div>
                    </div>
                    <IconButton title={`Descargar ${e.file_name}`} onClick={() => downloadExport(e)}><Download className="h-4 w-4" /></IconButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
