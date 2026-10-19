import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser, Heading3 } from 'lucide-react';
import { promptDialog } from '../../components/ui';

export const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'span', 'mark', 'code', 'sub', 'sup', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
  });

/** Editor de texto enriquecido liviano (contentEditable + sanitización). */
export function RichTextEditor({ value, onChange, minHeight = 110, placeholder }: { value: string; onChange(v: string): void; minHeight?: number; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);

  useEffect(() => {
    if (ref.current && value !== last.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || '';
      last.current = value;
    }
  }, [value]);
  useEffect(() => { if (ref.current) ref.current.innerHTML = value || ''; }, []); // eslint-disable-line

  const emit = () => {
    const html = sanitize(ref.current?.innerHTML || '');
    last.current = html;
    onChange(html);
  };
  const cmd = (c: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(c, false, arg);
    emit();
  };
  const link = async () => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const url = await promptDialog({ title: 'Insertar enlace', label: 'URL (https://…)', value: 'https://' });
    if (!url) return;
    ref.current?.focus();
    if (range) { sel!.removeAllRanges(); sel!.addRange(range); }
    if (/^(https?:|mailto:)/i.test(url)) cmd('createLink', url);
  };
  const B = ({ title, onClick, children }: any) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="icon-btn h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5">{children}</button>
  );
  return (
    <div className="rte rounded-lg border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-1 py-0.5 dark:border-slate-700">
        <B title="Negrita" onClick={() => cmd('bold')}><Bold /></B>
        <B title="Cursiva" onClick={() => cmd('italic')}><Italic /></B>
        <B title="Subrayado" onClick={() => cmd('underline')}><Underline /></B>
        <B title="Subtítulo" onClick={() => cmd('formatBlock', 'h3')}><Heading3 /></B>
        <B title="Viñetas" onClick={() => cmd('insertUnorderedList')}><List /></B>
        <B title="Lista numerada" onClick={() => cmd('insertOrderedList')}><ListOrdered /></B>
        <B title="Enlace" onClick={link}><Link2 /></B>
        <label title="Color de texto" className="icon-btn relative h-7 w-7 cursor-pointer">
          <span className="text-[13px] font-bold underline decoration-red-500 decoration-2">A</span>
          <input type="color" className="absolute inset-0 opacity-0" onChange={(e) => cmd('foreColor', e.target.value)} />
        </label>
        <B title="Quitar formato" onClick={() => { cmd('removeFormat'); cmd('formatBlock', 'p'); }}><Eraser /></B>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder || 'Escribí el contenido…'}
        className="px-3 py-2 text-sm leading-relaxed outline-none" style={{ minHeight }} onInput={emit} onBlur={emit}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }} />
    </div>
  );
}
