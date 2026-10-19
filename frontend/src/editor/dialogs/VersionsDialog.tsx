import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, ExternalLink, GitBranch, History, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate, fmtRelative } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, Field, IconButton, Input, Modal, Spinner, Textarea, clsx, confirmDialog } from '../../components/ui';

interface VersionRow { id: string; version: string; notes: string; created_at: string; created_by_name: string | null; modules: number | null }
type Bump = 'minor' | 'major' | 'custom' | 'current';

function parseVersion(v?: string) {
  const m = /^(\d+)(?:\.(\d+))?/.exec(v || '1.0');
  return { major: m ? Number(m[1]) : 1, minor: m && m[2] ? Number(m[2]) : 0 };
}
function nextVersion(v: string | undefined, kind: 'minor' | 'major') {
  const { major, minor } = parseVersion(v);
  return kind === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'curso';

export function VersionsDialog({ courseId, currentVersion, open, onClose, onRestored }: { courseId: string; currentVersion?: string; open: boolean; onClose(): void; onRestored(): void }) {
  const { can } = useAuth();
  const canEdit = can('courses.edit');
  const canCreateCourse = can('courses.create');
  const [current, setCurrent] = useState(currentVersion || '1.0');
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bump, setBump] = useState<Bump>('minor');
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [duplicated, setDuplicated] = useState<{ id: string; version: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await api.get<VersionRow[]>(`/courses/${courseId}/versions`));
    } catch (e: any) {
      setLoadError(e?.message || 'No se pudieron cargar las versiones');
    }
  }, [courseId]);

  useEffect(() => {
    if (!open) return;
    setRows(null); setBump('minor'); setCustom(''); setNotes(''); setDuplicated(null);
    setCurrent(currentVersion || '1.0');
    load();
  }, [open, load, currentVersion]);

  const preview = bump === 'custom' ? custom.trim() || '—' : bump === 'current' ? current : nextVersion(current, bump);

  const create = async () => {
    if (bump === 'custom' && !custom.trim()) { toast.error('Indicá el número de versión'); return; }
    setCreating(true);
    try {
      const v = await api.post<{ id: string; version: string }>(`/courses/${courseId}/versions`, { bump, version: bump === 'custom' ? custom.trim() : undefined, notes: notes.trim() });
      setCurrent(v.version);
      setNotes(''); setCustom('');
      toast.success(`Versión ${v.version} creada`);
      await load();
    } catch (e) {
      toast.error(e);
    } finally {
      setCreating(false);
    }
  };

  const restore = async (row: VersionRow) => {
    const ok = await confirmDialog({
      title: `Restaurar versión ${row.version}`,
      message: (
        <div className="space-y-2">
          <p>El contenido, la configuración y los datos generales del curso se reemplazarán por los de la <b>v{row.version}</b>.</p>
          <p>Antes de restaurar se crea automáticamente un <b>respaldo</b> del estado actual, así que podés volver atrás si lo necesitás.</p>
        </div>
      ),
      confirmText: 'Restaurar',
    });
    if (!ok) return;
    setBusy(row.id);
    try {
      const res = await api.post<{ ok: boolean; version: string }>(`/versions/${row.id}/restore`);
      setCurrent(res.version);
      toast.success(`Se restauró la versión ${res.version}`);
      await load();
      onRestored();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (row: VersionRow) => {
    setBusy(row.id);
    try {
      const res = await api.post<{ id: string }>(`/versions/${row.id}/duplicate`);
      setDuplicated({ id: res.id, version: row.version });
      toast.success(`Se creó un curso nuevo a partir de la v${row.version}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const downloadJson = async (row: VersionRow) => {
    setBusy(row.id);
    try {
      const v = await api.get<{ snapshot: any; version: string }>(`/versions/${row.id}`);
      const blob = new Blob([JSON.stringify(v.snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(v.snapshot?.title || 'curso')}-v${v.version}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: VersionRow) => {
    const ok = await confirmDialog({ title: 'Eliminar versión', message: <>Se eliminará la instantánea <b>v{row.version}</b>{row.notes ? ` (“${row.notes}”)` : ''}. El curso actual no se modifica.</>, danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    setBusy(row.id);
    try {
      await api.del(`/versions/${row.id}`);
      setRows((r) => (r || []).filter((x) => x.id !== row.id));
      toast.success('Versión eliminada');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const bumpOptions: { id: Bump; label: string; hint: string }[] = [
    { id: 'minor', label: 'Menor', hint: `${current} → ${nextVersion(current, 'minor')}` },
    { id: 'major', label: 'Mayor', hint: `${current} → ${nextVersion(current, 'major')}` },
    { id: 'custom', label: 'Personalizada', hint: 'Escribí el número' },
    { id: 'current', label: 'Conservar número', hint: `Queda ${current}` },
  ];

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2"><History className="h-5 w-5 text-brand-600" />Versiones del curso</span>}
      description={<>Versión actual: <b className="text-slate-700 dark:text-slate-200">v{current}</b>. Cada versión guarda una copia completa del curso que podés restaurar, duplicar o descargar.</>}
      footer={<Button onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-5">
        {canEdit && (
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><GitBranch className="h-4 w-4" />Crear versión</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {bumpOptions.map((o) => (
                <button key={o.id} type="button" onClick={() => setBump(o.id)}
                  className={clsx('rounded-lg border px-3 py-2 text-left transition', bump === o.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-slate-500">{o.hint}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
              {bump === 'custom' ? (
                <Field label="Número de versión"><Input value={custom} maxLength={20} placeholder="Ej.: 2.1" onChange={(e) => setCustom(e.target.value)} /></Field>
              ) : (
                <Field label="Nueva versión"><div className="input flex items-center bg-slate-50 font-mono dark:bg-slate-900/60">v{preview}</div></Field>
              )}
              <Field label="Notas" hint="Qué cambió en esta versión (opcional)">
                <Textarea rows={2} maxLength={1000} value={notes} placeholder="Ej.: Se agregó el módulo de gráficos y se corrigió la evaluación final" onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="primary" loading={creating} icon={<Plus className="h-4 w-4" />} onClick={create} disabled={bump === 'custom' && !custom.trim()}>Crear versión v{preview}</Button>
            </div>
          </div>
        )}

        {duplicated && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
            ✅ Se creó un curso nuevo a partir de la v{duplicated.version}.
            <Link to={`/cursos/${duplicated.id}/editor`} onClick={onClose} className="inline-flex items-center gap-1 font-medium underline">Abrir en el editor<ExternalLink className="h-3.5 w-3.5" /></Link>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Historial</h4>
          {loadError ? (
            <div className="flex items-center gap-2 text-sm text-red-600">❌ {loadError}<Button size="xs" onClick={load}>Reintentar</Button></div>
          ) : rows === null ? (
            <div className="flex h-24 items-center justify-center"><Spinner /></div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">Todavía no hay versiones guardadas. Creá la primera para poder volver a este punto más adelante.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5 sm:flex-nowrap">
                  <Badge color={row.version === current ? 'blue' : 'slate'} className="mt-0.5 font-mono">v{row.version}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800 dark:text-slate-100">{row.notes || <span className="italic text-slate-400">Sin notas</span>}</div>
                    <div className="mt-0.5 text-xs text-slate-500" title={fmtDate(row.created_at)}>
                      {row.created_by_name || 'Usuario eliminado'} · {fmtRelative(row.created_at)} · {row.modules ?? 0} módulo{row.modules === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-0.5">
                    {busy === row.id ? <Spinner className="h-4 w-4" /> : (<>
                      {canEdit && <IconButton title="Restaurar esta versión" onClick={() => restore(row)}><RotateCcw className="h-4 w-4" /></IconButton>}
                      {canCreateCourse && <IconButton title="Duplicar como curso nuevo" onClick={() => duplicate(row)}><Copy className="h-4 w-4" /></IconButton>}
                      <IconButton title="Descargar JSON" onClick={() => downloadJson(row)}><Download className="h-4 w-4" /></IconButton>
                      {canEdit && <IconButton title="Eliminar versión" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-red-500" /></IconButton>}
                    </>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
