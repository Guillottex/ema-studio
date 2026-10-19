import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, FolderTree, FileText, Monitor, LayoutTemplate, Image as ImageIcon, CircleHelp, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { stripHtml } from '../../lib/format';

interface Results { courses: any[]; modules: any[]; lessons: any[]; screens: any[]; templates: any[]; media: any[]; questions: any[] }

export function GlobalSearch({ open, onClose }: { open: boolean; onClose(): void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();

  useEffect(() => { if (!open) { setQ(''); setRes(null); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get<Results>(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes(null)).finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    if (!res) return [];
    const out: { icon: any; title: string; sub: string; go(): void; group: string }[] = [];
    res.courses.forEach((c) => out.push({ group: 'Cursos', icon: BookOpen, title: c.title, sub: c.status === 'published' ? 'Publicado' : 'Borrador', go: () => nav(`/cursos/${c.id}/editor`) }));
    res.modules.forEach((m) => out.push({ group: 'Módulos', icon: FolderTree, title: m.title, sub: m.course, go: () => nav(`/cursos/${m.course_id}/editor`) }));
    res.lessons.forEach((l) => out.push({ group: 'Lecciones', icon: FileText, title: l.title, sub: l.course, go: () => nav(`/cursos/${l.course_id}/editor${l.screen_id ? `?pantalla=${l.screen_id}` : ''}`) }));
    res.screens.forEach((s) => out.push({ group: 'Pantallas', icon: Monitor, title: s.title, sub: `${s.course} · ${s.lesson}`, go: () => nav(`/cursos/${s.course_id}/editor?pantalla=${s.id}`) }));
    res.templates.forEach((t) => out.push({ group: 'Plantillas', icon: LayoutTemplate, title: t.name, sub: t.kind === 'course' ? 'Plantilla de curso' : 'Plantilla de pantalla', go: () => nav('/plantillas') }));
    res.media.forEach((m) => out.push({ group: 'Recursos', icon: ImageIcon, title: m.name, sub: m.kind, go: () => nav(`/biblioteca?q=${encodeURIComponent(m.name)}`) }));
    res.questions.forEach((x) => out.push({ group: 'Preguntas', icon: CircleHelp, title: stripHtml(x.prompt).slice(0, 90), sub: x.type, go: () => nav(`/preguntas?q=${encodeURIComponent(stripHtml(x.prompt).slice(0, 30))}`) }));
    return out;
  }, [res, nav]);

  useEffect(() => setActive(0), [items.length]);
  if (!open) return null;

  const choose = (i: number) => { const it = items[i]; if (it) { onClose(); it.go(); } };
  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en cursos, lecciones, pantallas, plantillas, recursos y preguntas…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') choose(active);
            }} />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {q.trim().length < 2 && <p className="px-5 py-6 text-center text-sm text-slate-500">Escribí al menos 2 caracteres.</p>}
          {res && !items.length && <p className="px-5 py-6 text-center text-sm text-slate-500">Sin resultados para “{q}”.</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={i}>
                {header && <div className="px-4 pb-1 pt-3 panel-title">{header}</div>}
                <button onMouseEnter={() => setActive(i)} onClick={() => choose(i)} className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
                  <it.icon className="h-4 w-4 flex-none text-slate-400" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{it.title}</span><span className="block truncate text-xs text-slate-500">{it.sub}</span></span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
