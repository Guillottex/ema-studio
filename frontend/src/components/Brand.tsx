import { useState } from 'react';
import clsx from 'clsx';

/**
 * Logo de EMA Servicios. Usa /brand/logo-color.png (descargado de www.emaservicios.com.ar al construir
 * la imagen Docker o con scripts/fetch-brand.sh). Si no está disponible, muestra el logotipo tipográfico.
 */
export function EmaLogo({ className, variant = 'color' }: { className?: string; variant?: 'color' | 'white' }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img src="/brand/logo-color.png" alt="EMA Servicios" onError={() => setFailed(true)}
        className={clsx('h-9 w-auto select-none', variant === 'white' && 'rounded-lg bg-white px-2 py-1', className)} draggable={false} />
    );
  }
  return <EmaWordmark className={className} variant={variant} />;
}

export function EmaWordmark({ className, variant = 'color' }: { className?: string; variant?: 'color' | 'white' }) {
  const main = variant === 'white' ? '#ffffff' : '#282964';
  return (
    <span className={clsx('inline-flex items-end gap-1.5 leading-none select-none', className)} aria-label="EMA Servicios">
      <span className="font-display text-[28px] font-extrabold italic tracking-tight" style={{ color: main }}>
        E<span style={{ color: '#76C6E2' }}>M</span>A
      </span>
      <span className="mb-0.5 flex flex-col">
        <span className="flex gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-[5px] w-[7px] -skew-x-12" style={{ background: i % 2 ? '#76C6E2' : main }} />)}
        </span>
        <span className="mt-1 font-display text-[10px] font-bold italic uppercase tracking-[0.08em]" style={{ color: main }}>Servicios</span>
      </span>
    </span>
  );
}
