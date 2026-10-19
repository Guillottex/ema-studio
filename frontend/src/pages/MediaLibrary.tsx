import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Images, Upload, Search, LayoutGrid, List, UploadCloud, Info, Link2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtBytes, fmtDate, fmtRelative } from '../lib/format';
import { Button, Empty, IconButton, Input, PageHeader, PageLoader, clsx } from '../components/ui';
import { KindIcon, useUpload, type MediaItem } from '../components/MediaPicker';
import { MediaDetailModal, KIND_LABELS, UsageBadge } from './parts/media-detail';

const KINDS: { id: '' | MediaItem['kind']; label: string }[] = [
  { id: '', label: 'Todos' },
  { id: 'image', label: 'Imágenes' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audios' },
  { id: 'pdf', label: 'PDF' },
];
const ACCEPT = '.jpg,.jpeg,.png,.svg,.webp,.gif,.mp4,.mp3,.pdf';

interface AppSettings { limits: { maxUploadMb: number; maxImageMb: number; imageMaxWidth: number } }

function readView(): 'grid' | 'table' {
  try { return localStorage.getItem('ema-media-view') === 'table' ? 'table' : 'grid'; } catch { return 'grid'; }
}

export default function MediaLibrary() {
  const { can } = useAuth();
  const canUpload = can('media.upload');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [debounced, setDebounced] = useState(q);
  const [kind, setKind] = useState<'' | MediaItem['kind']>('');
  const [view, setView] = useState<'grid' | 'table'>(readView);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useUpload();

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced); else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => { try { localStorage.setItem('ema-media-view', view); } catch { /* */ } }, [view]);

  const qs = new URLSearchParams();
  if (debounced) qs.set('q', debounced);
  if (kind) qs.set('kind', kind);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['media', 'library', debounced, kind],
    queryFn: () => api.get<MediaItem[]>(`/media${qs.toString() ? '?' + qs.toString() : ''}`),
    placeholderData: (prev) => prev,
  });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<AppSettings>('/settings') });
  const items = data || [];
  const totals = useMemo(() => ({ n: items.length, bytes: items.reduce((a, m) => a + (Number(m.size) || 0), 0) }), [items]);

  // Mantener sincronizado el recurso abierto si se renombra/refresca
  useEffect(() => {
    if (selected && data) {
      const fresh = data.find((m) => m.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!canUpload || !e.dataTransfer.files?.length) return;
    await upload(e.dataTransfer.files);
  };
  const dragProps = canUpload ? {
    onDragEnter: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragging(true); } },
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDrop,
  } : {};

  const limits = settings?.limits;

  return (
    <div {...dragProps} className="relative">
      <PageHeader
        icon={<Images className="h-5 w-5" />}
        title="Biblioteca multimedia"
        description="Imágenes, videos, audios y PDF reutilizables en todos los cursos."
        actions={canUpload && (
          <>
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={async (e) => { await upload(e.target.files || []); e.target.value = ''; }} />
            <Button variant="primary" loading={busy} icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Subir archivos</Button>
          </>
        )}
      />

      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        {canUpload ? (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className={clsx('flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-4 text-left transition-colors',
              dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 bg-white hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900')}>
            <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-medium text-slate-800 dark:text-slate-100">{busy ? 'Subiendo archivos…' : 'Arrastrá archivos acá o hacé clic para elegirlos'}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                JPG, PNG, SVG, WEBP, GIF, MP4, MP3 y PDF · hasta 20 archivos por vez
                {limits && <> · máx. {limits.maxUploadMb} MB por archivo ({limits.maxImageMb} MB en imágenes; se redimensionan a {limits.imageMaxWidth}px de ancho)</>}
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Info className="h-4 w-4 flex-none" /> Tu rol permite ver y usar los recursos, pero no subir ni eliminar archivos.
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <Link2 className="h-4 w-4 flex-none text-brand-600" />
          <p className="max-w-xs text-xs text-slate-500">
            Cada recurso se guarda una sola vez y puede usarse en cualquier curso. Si lo reemplazás o lo borrás, se afectan todas las pantallas que lo usan.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)}
              className={clsx('rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors',
                kind === k.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">{totals.n} recurso{totals.n === 1 ? '' : 's'} · {fmtBytes(totals.bytes)}{isFetching && !isLoading ? ' · actualizando…' : ''}</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <IconButton title="Vista de cuadrícula" active={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></IconButton>
            <IconButton title="Vista de tabla" active={view === 'table'} onClick={() => setView('table')}><List className="h-4 w-4" /></IconButton>
          </div>
        </div>
      </div>

      {isLoading ? <PageLoader /> : items.length === 0 ? (
        <Empty icon={<Images className="h-10 w-10" />} title={debounced || kind ? 'No hay resultados' : 'La biblioteca está vacía'}
          action={canUpload && !debounced && !kind ? <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Subir el primer archivo</Button> : (debounced || kind) ? <Button onClick={() => { setQ(''); setKind(''); }}>Limpiar filtros</Button> : undefined}>
          {debounced || kind ? 'Probá con otro nombre o tipo de archivo.' : 'Subí imágenes, videos, audios o PDF para usarlos en tus cursos.'}
        </Empty>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map((m) => (
            <button key={m.id} type="button" onClick={() => setSelected(m)}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-100 dark:bg-slate-800">
                {m.kind === 'image'
                  ? <img src={m.thumbUrl || m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <KindIcon kind={m.kind} className="h-10 w-10 text-slate-400 transition group-hover:text-brand-500" />}
                <span className="absolute left-2 top-2 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{m.kind === 'pdf' ? 'PDF' : (m.name.split('.').pop() || m.kind)}</span>
                {m.usage && m.usage.screens > 0 && <span className="absolute right-2 top-2 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">En uso</span>}
              </div>
              <div className="p-2.5">
                <div className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100" title={m.name}>{m.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{fmtBytes(Number(m.size))}{m.width && m.height ? ` · ${m.width}×${m.height}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-20">Miniatura</th><th>Nombre</th><th>Tipo</th><th className="hidden md:table-cell">Dimensiones</th><th>Tamaño</th><th className="hidden md:table-cell">Fecha</th><th>Uso</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <td>
                    <div className="grid h-10 w-14 place-items-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                      {m.kind === 'image' ? <img src={m.thumbUrl || m.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <KindIcon kind={m.kind} className="h-5 w-5 text-slate-400" />}
                    </div>
                  </td>
                  <td className="max-w-[280px]"><div className="truncate font-medium text-slate-800 dark:text-slate-100" title={m.name}>{m.name}</div>{(m as any).created_by_name && <div className="text-xs text-slate-500">por {(m as any).created_by_name}</div>}</td>
                  <td className="whitespace-nowrap text-slate-600 dark:text-slate-300">{KIND_LABELS[m.kind]}</td>
                  <td className="hidden whitespace-nowrap text-slate-500 md:table-cell">{m.width && m.height ? `${m.width}×${m.height}px` : '—'}</td>
                  <td className="whitespace-nowrap text-slate-500">{fmtBytes(Number(m.size))}</td>
                  <td className="hidden whitespace-nowrap text-slate-500 md:table-cell" title={fmtDate(m.created_at)}>{fmtRelative(m.created_at)}</td>
                  <td className="whitespace-nowrap"><UsageBadge usage={m.usage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-brand-600/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-white px-10 py-8 text-center shadow-2xl dark:bg-slate-900">
            <UploadCloud className="mx-auto h-10 w-10 text-brand-600" />
            <div className="mt-2 font-semibold text-slate-800 dark:text-slate-100">Soltá los archivos para subirlos</div>
            <div className="text-xs text-slate-500">Se agregarán a la biblioteca compartida</div>
          </div>
        </div>
      )}

      <MediaDetailModal item={selected} onClose={() => setSelected(null)} canEdit={canUpload} />
    </div>
  );
}
