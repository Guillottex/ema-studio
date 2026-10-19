import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PALETTE_ICONS, FallbackIcon } from './iconMap';
import { Search } from 'lucide-react';
import { paletteItems, CATEGORY_LABELS, createComponent, getDef, LAYOUTS, layoutThumbSvg, STAGE_WIDTH, type PaletteItem } from '@engine';
import { api } from '../lib/api';
import { confirmDialog } from '../components/ui';
import { useEditor, addComponent, mutate, editableBp, stageSize } from './store';

/** Ícono lucide por nombre kebab-case (definido en el registro de componentes) */
export function DynIcon({ name, className }: { name: string; className?: string }) {
  const I = PALETTE_ICONS[name] || FallbackIcon;
  return <I className={className} />;
}

export function Palette() {
  const [q, setQ] = useState('');
  const items = useMemo(() => paletteItems().filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())), [q]);
  const cats = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

  const addAtCenter = (item: PaletteItem) => {
    const st = useEditor.getState();
    if (!st.screen) return;
    const def = getDef(item.type)!;
    const eb = editableBp(st.screen, st.bp) || 'desktop';
    const size = stageSize(st.screen, eb);
    const w = Math.min(item.size?.w ?? def.defaultSize.w, (eb === 'desktop' ? STAGE_WIDTH.desktop : size.w) - 40);
    const h = item.size?.h ?? def.defaultSize.h;
    const n = st.screen.components.length;
    addComponent(createComponent(item.type, { x: Math.max(0, Math.round((size.w - w) / 2) + (n % 5) * 10), y: Math.max(20, Math.round((size.h - h) / 2) + (n % 5) * 10), w, h, props: item.props }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <div className="relative"><Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><input className="input input-sm pl-8" placeholder="Buscar componente…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <p className="mt-2 text-[11px] text-slate-500">Arrastrá al lienzo o hacé clic para agregar.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {cats.map((cat) => {
          const list = items.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat}>
              <div className="panel-title mb-1.5">{CATEGORY_LABELS[cat]}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {list.map((it) => (
                  <button key={it.key} type="button" draggable title={it.label}
                    onDragStart={(e) => { e.dataTransfer.setData('application/x-ema-palette', it.key); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => addAtCenter(it)}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-center text-[10.5px] leading-tight text-slate-600 transition hover:border-brand-400 hover:text-brand-700 hover:shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500 cursor-grab">
                    <DynIcon name={it.icon} className="h-5 w-5" />
                    <span className="line-clamp-2">{it.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LayoutsPanel() {
  const screen = useEditor((s) => s.screen);
  const { data: tpls } = useQuery({ queryKey: ['templates', 'screen'], queryFn: () => api.get<any[]>('/templates?kind=screen') });

  const apply = async (build: () => { components: any[]; height?: number; background?: any }, layoutId: string | null, name: string) => {
    if (!screen) return;
    if (screen.components.length && !(await confirmDialog({ title: `Aplicar "${name}"`, message: 'Se reemplazarán los componentes de la pantalla actual. Podés deshacer con Ctrl+Z.', confirmText: 'Reemplazar' }))) return;
    const b = build();
    mutate((s) => {
      s.components = b.components;
      s.layout = layoutId || undefined;
      if (b.height) s.height = b.height;
      if (b.background) s.background = b.background;
      s.tabletMode = 'auto';
      s.mobileMode = 'auto';
    });
    useEditor.setState({ selected: [] });
  };

  const applyTemplate = async (t: any) => {
    const full = await api.get(`/templates/${t.id}`);
    const { uid } = await import('@engine');
    const d = full.data;
    await apply(() => ({ components: JSON.parse(JSON.stringify(d.components || [])).map((c: any) => ({ ...c, id: uid(8) })), height: d.height, background: d.background }), d.layout || null, t.name);
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="panel-title mb-2">Layouts predefinidos</div>
      <p className="mb-3 text-[11px] text-slate-500">Elegí una estructura y luego modificala libremente.</p>
      <div className="grid grid-cols-2 gap-2">
        {LAYOUTS.map((l, i) => (
          <button key={l.id} type="button" onClick={() => apply(l.build, l.id, l.name)} title={l.description}
            className={`group rounded-lg border p-1.5 text-left transition hover:border-brand-400 dark:border-slate-700 ${screen?.layout === l.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200'}`}>
            <div className="overflow-hidden rounded" dangerouslySetInnerHTML={{ __html: layoutThumbSvg(l) }} />
            <div className="mt-1 text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-300">{i + 1}. {l.name}</div>
          </button>
        ))}
      </div>
      {!!tpls?.length && (
        <>
          <div className="panel-title mb-2 mt-5">Plantillas de pantalla</div>
          <div className="space-y-1.5">
            {tpls.map((t) => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-brand-400 dark:border-slate-700">
                <div className="font-medium">{t.name}</div>
                <div className="text-slate-500">{t.is_system ? 'Sistema' : t.created_by_name || 'Mis plantillas'} · {t.summary?.components ?? 0} componentes</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
