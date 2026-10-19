import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Download, ExternalLink, Pencil, Trash2, Check } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fmtBytes, fmtDate } from '../../lib/format';
import { toast } from '../../lib/toast';
import { Badge, Button, Field, Input, Modal, confirmDialog } from '../../components/ui';
import type { MediaItem } from '../../components/MediaPicker';

export const KIND_LABELS: Record<string, string> = { image: 'Imagen', video: 'Video', audio: 'Audio', pdf: 'PDF' };

export function UsageBadge({ usage }: { usage?: { courses: number; screens: number } }) {
  if (!usage || (!usage.screens && !usage.courses)) return <Badge>Sin uso</Badge>;
  return (
    <Badge color="green">
      {usage.screens > 0 ? `${usage.screens} pantalla${usage.screens === 1 ? '' : 's'}` : 'Portada'} · {usage.courses} curso{usage.courses === 1 ? '' : 's'}
    </Badge>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** Modal de detalle/vista previa de un recurso de la biblioteca */
export function MediaDetailModal({ item, onClose, canEdit }: { item: MediaItem | null; onClose(): void; canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setName(item?.name || ''); setEditing(false); setCopied(false); }, [item?.id, item?.name]);
  if (!item) return null;

  const rename = async () => {
    const n = name.trim();
    if (!n || n === item.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await api.patch(`/media/${item.id}`, { name: n });
      await qc.invalidateQueries({ queryKey: ['media'] });
      toast.success('Nombre actualizado');
      setEditing(false);
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: 'Eliminar recurso', message: <>¿Eliminar <b>{item.name}</b> de la biblioteca? Esta acción no se puede deshacer.</>, danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    setDeleting(true);
    try {
      try {
        await api.del(`/media/${item.id}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const u = (e.data || {}) as { screens?: number; courses?: number };
          const force = await confirmDialog({
            title: 'El recurso está en uso',
            danger: true,
            confirmText: 'Eliminar de todos modos',
            message: (
              <>
                <p>Este archivo se usa en <b>{u.screens ?? '?'} pantalla{u.screens === 1 ? '' : 's'}</b> de <b>{u.courses ?? '?'} curso{u.courses === 1 ? '' : 's'}</b>.</p>
                <p className="mt-2">Si lo eliminás, esas pantallas van a mostrar el recurso como faltante hasta que lo reemplaces. ¿Querés eliminarlo igual?</p>
              </>
            ),
          });
          if (!force) return;
          await api.del(`/media/${item.id}?force=1`);
        } else throw e;
      }
      await qc.invalidateQueries({ queryKey: ['media'] });
      toast.success('Recurso eliminado');
      onClose();
    } catch (e) { toast.error(e); } finally { setDeleting(false); }
  };

  const copy = async () => {
    await copyText(item.asset);
    setCopied(true);
    toast.success('Referencia copiada');
    setTimeout(() => setCopied(false), 2000);
  };

  const ext = (item.name.split('.').pop() || '').toUpperCase();
  const rows: [string, React.ReactNode][] = [
    ['Tipo', `${KIND_LABELS[item.kind] || item.kind} (${ext || item.mime})`],
    ['Formato MIME', item.mime],
    ['Tamaño', fmtBytes(Number(item.size))],
    ...(item.width && item.height ? [['Dimensiones', `${item.width} × ${item.height} px`] as [string, React.ReactNode]] : []),
    ['Subido', fmtDate(item.created_at)],
    ...((item as any).created_by_name ? [['Subido por', (item as any).created_by_name] as [string, React.ReactNode]] : []),
    ['Uso', <UsageBadge key="u" usage={item.usage} />],
    ['Archivo', <span key="f" className="break-all font-mono text-xs">{item.stored_name}</span>],
  ];

  return (
    <Modal open onClose={onClose} size="xl" title={item.name} description={`${KIND_LABELS[item.kind] || item.kind} · ${fmtBytes(Number(item.size))}`}
      footer={
        <>
          {canEdit && <Button variant="danger" className="mr-auto" loading={deleting} icon={<Trash2 className="h-4 w-4" />} onClick={remove}>Eliminar</Button>}
          <a className="btn btn-secondary" href={item.url} download={item.name}><Download className="h-4 w-4" />Descargar</a>
          <Button variant="primary" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copy}>{copied ? 'Copiada' : 'Copiar referencia'}</Button>
        </>
      }>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/70 [background-image:linear-gradient(45deg,rgba(148,163,184,.15)_25%,transparent_25%,transparent_75%,rgba(148,163,184,.15)_75%),linear-gradient(45deg,rgba(148,163,184,.15)_25%,transparent_25%,transparent_75%,rgba(148,163,184,.15)_75%)] [background-position:0_0,10px_10px] [background-size:20px_20px]">
          {item.kind === 'image' && <img src={item.url} alt={item.name} className="max-h-[60vh] max-w-full object-contain" />}
          {item.kind === 'video' && <video src={item.url} controls preload="metadata" className="max-h-[60vh] w-full bg-black" />}
          {item.kind === 'audio' && <div className="w-full p-6"><audio src={item.url} controls preload="metadata" className="w-full" /></div>}
          {item.kind === 'pdf' && (
            <object data={item.url} type="application/pdf" className="h-[60vh] w-full">
              <iframe src={item.url} title={item.name} className="h-[60vh] w-full" />
            </object>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Nombre visible" hint={canEdit ? 'Cambiar el nombre no rompe las referencias de los cursos.' : undefined}>
            {editing ? (
              <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); rename(); }}>
                <Input sm autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setName(item.name); setEditing(false); } }} />
                <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!name.trim()}>Guardar</Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-sm font-medium" title={item.name}>{item.name}</div>
                {canEdit && <Button size="xs" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Renombrar</Button>}
              </div>
            )}
          </Field>

          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
                <dt className="flex-none text-xs text-slate-500">{k}</dt>
                <dd className="min-w-0 text-right text-slate-700 dark:text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="label">Referencia para usar en cursos</div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <code className="min-w-0 flex-1 truncate text-xs">{item.asset}</code>
              <button type="button" className="icon-btn h-7 w-7" title="Copiar referencia" onClick={copy}><Copy className="h-3.5 w-3.5" /></button>
            </div>
            <p className="mt-1 text-[11.5px] text-slate-500">Desde el editor visual podés elegir este recurso con el selector de la biblioteca; se incluye automáticamente en el paquete SCORM al exportar.</p>
          </div>

          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir en una pestaña nueva
          </a>
        </div>
      </div>
    </Modal>
  );
}
