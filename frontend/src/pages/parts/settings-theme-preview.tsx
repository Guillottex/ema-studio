import { fontStack, type Theme } from '@engine';

const SHADOWS = { none: 'none', sm: '0 1px 2px rgba(0,0,0,.08)', md: '0 4px 12px rgba(0,0,0,.10)', lg: '0 12px 28px rgba(0,0,0,.16)' } as const;

function barColors(style: 'light' | 'dark' | 'primary', t: Theme) {
  if (style === 'primary') return { bg: t.colors.primary, fg: '#ffffff', border: 'transparent' };
  if (style === 'dark') return { bg: '#1e293b', fg: '#f1f5f9', border: 'transparent' };
  return { bg: t.colors.surface, fg: t.colors.text, border: t.colors.border };
}

function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Miniatura fiel de un curso con el tema aplicado (encabezado, menú, tarjeta, botón y progreso). */
export function ThemePreview({ theme: t, compact }: { theme: Theme; compact?: boolean }) {
  const header = barColors(t.header?.style || 'primary', t);
  const menu = barColors(t.menu?.style || 'light', t);
  const btn = t.buttons || { radius: 8, style: 'filled', uppercase: false };
  const btnStyle: React.CSSProperties = {
    borderRadius: Math.min(btn.radius, 999),
    textTransform: btn.uppercase ? 'uppercase' : 'none',
    fontFamily: fontStack(t.fonts?.body),
    padding: compact ? '3px 9px' : '5px 12px',
    fontSize: compact ? 10 : 12,
    fontWeight: 600,
    letterSpacing: btn.uppercase ? '.04em' : undefined,
    ...(btn.style === 'outline' ? { background: 'transparent', color: t.colors.primary, border: `1.5px solid ${t.colors.primary}` }
      : btn.style === 'soft' ? { background: hexA(t.colors.primary, 0.15), color: t.colors.primary, border: '1.5px solid transparent' }
        : { background: t.colors.primary, color: '#fff', border: `1.5px solid ${t.colors.primary}` }),
  };
  const progressColor = t.progress?.color || t.colors.primary;
  const heading: React.CSSProperties = {
    fontFamily: fontStack(t.fonts?.heading), fontWeight: t.headings?.weight || 700, textTransform: t.headings?.transform === 'uppercase' ? 'uppercase' : 'none',
    color: t.headings?.color || t.colors.text, fontSize: compact ? 12 : 15, lineHeight: 1.2, margin: 0,
  };
  const card = t.cards || { radius: 12, shadow: 'md', border: false };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 text-left dark:border-slate-700" style={{ background: t.colors.background, fontFamily: fontStack(t.fonts?.body), color: t.colors.text }} aria-hidden>
      <div className="flex items-center justify-between" style={{ background: header.bg, color: header.fg, borderBottom: `1px solid ${header.border}`, padding: compact ? '5px 8px' : '8px 12px' }}>
        <span style={{ fontFamily: fontStack(t.fonts?.heading), fontWeight: 700, fontSize: compact ? 10 : 12 }}>Curso de ejemplo</span>
        {t.progress?.style === 'percent' && <span style={{ fontSize: compact ? 9 : 11, opacity: 0.9 }}>40%</span>}
      </div>
      <div className="flex">
        <div className="flex-none" style={{ width: compact ? 52 : 86, background: menu.bg, borderRight: `1px solid ${menu.border === 'transparent' ? 'transparent' : t.colors.border}`, padding: compact ? '6px 5px' : '10px 8px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: compact ? 5 : 7, borderRadius: 3, marginBottom: compact ? 5 : 7, width: i === 1 ? '70%' : '90%', background: i === 0 ? (t.menu?.style === 'light' ? t.colors.primary : '#ffffff') : hexA(menu.fg, 0.25) }} />
          ))}
        </div>
        <div className="min-w-0 flex-1" style={{ padding: compact ? 8 : 14 }}>
          <div style={{ background: t.colors.surface, borderRadius: card.radius, boxShadow: SHADOWS[card.shadow] || 'none', border: card.border ? `1px solid ${t.colors.border}` : '1px solid transparent', padding: compact ? 8 : 12 }}>
            <h4 style={heading}>Título de la pantalla</h4>
            <p style={{ color: t.colors.muted, fontSize: compact ? 9 : 11.5, margin: compact ? '3px 0 7px' : '5px 0 10px', lineHeight: 1.35 }}>Texto de cuerpo con la tipografía del tema.</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span style={btnStyle}>Continuar</span>
              {!compact && <span style={{ fontSize: 11, color: t.colors.success, fontWeight: 600 }}>✓ Correcto</span>}
              {!compact && <span style={{ fontSize: 11, color: t.colors.error, fontWeight: 600 }}>✗ Incorrecto</span>}
              <span className="ml-auto inline-block rounded-full" style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, background: t.colors.accent }} />
            </div>
          </div>
          <div style={{ marginTop: compact ? 7 : 12 }}>
            {t.progress?.style === 'steps' ? (
              <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex-1" style={{ height: compact ? 4 : 6, borderRadius: 3, background: i < 2 ? progressColor : t.colors.border }} />)}</div>
            ) : t.progress?.style === 'percent' ? (
              <div style={{ fontSize: compact ? 9 : 11, color: t.colors.muted, textAlign: 'right' }}>Progreso: <b style={{ color: progressColor }}>40%</b></div>
            ) : (
              <div style={{ height: compact ? 4 : 6, borderRadius: 4, background: t.colors.border, overflow: 'hidden' }}><div style={{ width: '40%', height: '100%', background: progressColor }} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ColorDots({ theme }: { theme: Theme }) {
  const keys: (keyof Theme['colors'])[] = ['primary', 'secondary', 'accent', 'background', 'text'];
  return (
    <div className="flex -space-x-1">
      {keys.map((k) => <span key={k} title={k} className="h-4 w-4 rounded-full border-2 border-white dark:border-slate-900" style={{ background: theme.colors?.[k] }} />)}
    </div>
  );
}
