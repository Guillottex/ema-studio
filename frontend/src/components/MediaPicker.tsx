import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Search, FileText, Music, Video, Image as ImageIcon, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { api, assetUrl } from '../lib/api';
import { fmtBytes } from '../lib/format';
import { toast } from '../lib/toast';
import { Button, Input, Modal, Spinner } from './ui';

export interface MediaItem {
  id: string; name: string; stored_name: string; mime: string; kind: 'image' | 'video' | 'audio' | 'pdf'; size: number;
  width?: number; height?: number; url: string; thumbUrl: string | null; asset: string; created_at: string; usage?: { courses: number; screens: number };
}

export type Accept = 'image' | 'video' | 'audio' | 'pdf' | 'any';
const ACCEPT_EXT: Record<Accept, string> = {
  image: '.jpg,.jpeg,.png,.svg,.webp,.gif', video: '.mp4', audio: '.mp3', pdf: '.pdf', any: '.jpg,.jpeg,.png,.svg,.webp,.gif,.mp4,.mp3,.pdf',
};

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const I = kind === 'video' ? Video : kind === 'audio' ? Music : kind === 'pdf' ? FileText : ImageIcon;
  return <I className={className} />;
}

export function useUpload() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | File[]): Promise<MediaItem[]> => {
    const list = Array.from(files);
    if (!list.length) return [];
    const fd = new FormData();
    list.forEach((f) => fd.append('files', f));
    setBusy(true);
    try {
      const rows = await api.upload<MediaItem[]>('/media', fd);
      qc.invalidateQueries({ queryKey: ['media'] });
      toast.success(rows.length === 1 ? 'Archivo subido' : `${rows.length} archivos subidos`);
      return rows;
    } catch (e) {
      toast.error(e);
      return [];
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

/** Selector de recursos de la biblioteca multimedia (con subida de archivos). */
export function MediaPicker({ open, onClose, accept = 'any', onSelect }: { open: boolean; onClose(): void; accept?: Accept; onSelect(asset: string, item: MediaItem): void }) {
  const { data, isLoading } = useQuery({ queryKey: ['media'], queryFn: () => api.get<MediaItem[]>('/media'), enabled: open });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useUpload();
  const items = useMemo(() => (data || []).filter((m) => (accept === 'any' || m.kind === accept) && (!q || m.name.toLowerCase().includes(q.toLowerCase()))), [data, accept, q]);
  const choose = (m: MediaItem) => { onSelect(m.asset, m); onClose(); };

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Biblioteca multimedia" description={accept === 'any' ? 'Elegí un recurso o subí uno nuevo' : `Mostrando: ${{ image: 'imágenes', video: 'videos MP4', audio: 'audios MP3', pdf: 'documentos PDF', any: '' }[accept]}`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!sel} onClick={() => sel && choose(sel)} icon={<Check className="h-4 w-4" />}>Usar recurso</Button></>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_EXT[accept]} className="hidden" onChange={async (e) => { const rows = await upload(e.target.files || []); e.target.value = ''; if (rows[0]) setSel(rows[0]); }} />
        <Button variant="primary" loading={busy} icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Subir archivo</Button>
      </div>
      <div onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const rows = await upload(e.dataTransfer.files); if (rows[0]) setSel(rows[0]); }}>
        {isLoading ? <div className="flex h-40 items-center justify-center"><Spinner /></div> : items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 py-16 text-center text-sm text-slate-500 dark:border-slate-700">No hay recursos. Arrastrá archivos aquí o usá “Subir archivo”.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {items.map((m) => (
              <button key={m.id} type="button" onClick={() => setSel(m)} onDoubleClick={() => choose(m)}
                className={clsx('group overflow-hidden rounded-lg border text-left transition', sel?.id === m.id ? 'border-brand-600 ring-2 ring-brand-500/40' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700')}>
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 dark:bg-slate-800">
                  {m.kind === 'image' ? <img src={m.thumbUrl || m.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <KindIcon kind={m.kind} className="h-10 w-10 text-slate-400" />}
                </div>
                <div className="p-2"><div className="truncate text-xs font-medium">{m.name}</div><div className="text-[11px] text-slate-500">{m.kind.toUpperCase()} · {fmtBytes(m.size)}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Campo compacto: vista previa + elegir/quitar */
export function MediaField({ value, onChange, accept = 'image' }: { value?: string; onChange(v: string): void; accept?: Accept }) {
  const [open, setOpen] = useState(false);
  const name = value?.startsWith('asset:') ? value.slice(6) : value;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setOpen(true)} className="grid h-12 w-16 flex-none place-items-center overflow-hidden rounded-md border border-slate-300 bg-slate-50 hover:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
        {value && accept === 'image' ? <img src={assetUrl(value)} alt="" className="h-full w-full object-cover" /> : <KindIcon kind={accept === 'any' ? 'image' : accept} className="h-5 w-5 text-slate-400" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-slate-600 dark:text-slate-300" title={name}>{name || 'Sin seleccionar'}</div>
        <div className="mt-1 flex gap-1">
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setOpen(true)}>{value ? 'Cambiar' : 'Elegir'}</button>
          {value && <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange('')}><X className="h-3 w-3" />Quitar</button>}
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} accept={accept} onSelect={(a) => onChange(a)} />
    </div>
  );
}
