import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextMenu, type MenuItem } from '../../components/ui';

let seq = 0;

/**
 * Menú desplegable anclado a un botón.
 * A diferencia del `Dropdown` del kit, cada apertura recibe su propio `onClose`: el ContextMenu registra el
 * listener de `mousedown` dentro de un `setTimeout` que no se cancela en el cleanup (con StrictMode queda
 * un listener colgado por apertura). Con un `onClose` atado a cada apertura, esos listeners viejos no
 * pueden cerrar el menú siguiente antes de que el clic llegue al ítem.
 */
export function ActionMenu({ trigger, items, width = 220 }: { trigger: (open: () => void) => ReactNode; items: MenuItem[]; width?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [st, setSt] = useState<{ x: number; y: number; id: number } | null>(null);
  const id = st?.id;
  const onClose = useMemo(() => () => setSt((cur) => (cur && cur.id === id ? null : cur)), [id]);
  const open = () => {
    const r = ref.current!.getBoundingClientRect();
    setSt({ x: Math.max(8, r.right - width), y: r.bottom + 4, id: ++seq });
  };
  return (
    <span ref={ref} className="inline-flex">
      {trigger(open)}
      {st && <ContextMenu key={st.id} x={st.x} y={st.y} items={items} onClose={onClose} />}
    </span>
  );
}
