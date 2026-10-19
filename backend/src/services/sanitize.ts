import sanitizeHtml from 'sanitize-html';
import { getDef, type FieldDef, type CourseDoc, type ComponentData, type Question } from '@engine';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'span', 'mark', 'code', 'sub', 'sup', 'div'],
  allowedAttributes: { a: ['href', 'target', 'rel'], span: ['style'], p: ['style'], div: ['style'] },
  allowedStyles: { '*': { color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i], 'text-align': [/^(left|right|center|justify)$/], 'background-color': [/^#[0-9a-f]{3,8}$/i] } },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
  },
};

export const cleanHtml = (html: any): string => sanitizeHtml(String(html ?? ''), OPTIONS);
export const cleanText = (s: any): string => String(s ?? '').replace(/<\/?script[^>]*>/gi, '');

function cleanQuestion(q: Question): Question {
  if (!q || typeof q !== 'object') return q;
  return { ...q, prompt: cleanHtml(q.prompt) };
}

function cleanFields(fields: FieldDef[], props: Record<string, any>) {
  for (const f of fields) {
    const v = props[f.key];
    if (v === undefined || v === null) continue;
    if (f.type === 'richtext') props[f.key] = cleanHtml(v);
    else if (f.type === 'question') props[f.key] = cleanQuestion(v);
    else if (f.type === 'questions' && Array.isArray(v)) props[f.key] = v.map(cleanQuestion);
    else if (f.type === 'list' && Array.isArray(v) && f.itemFields) props[f.key] = v.map((it) => (it && typeof it === 'object' ? (cleanFields(f.itemFields!, it), it) : it));
  }
}

/** Sanitiza HTML de los campos enriquecidos de un componente (según su definición en el registro). */
export function sanitizeComponent(c: ComponentData): ComponentData {
  const def = getDef(c.type);
  const props = JSON.parse(JSON.stringify(c.props || {}));
  if (def) cleanFields(def.fields, props);
  return { ...c, props };
}

export function sanitizeDoc(doc: CourseDoc): CourseDoc {
  doc.modules.forEach((m) => m.lessons.forEach((l) => l.screens.forEach((s) => {
    s.components = (s.components || []).map(sanitizeComponent);
  })));
  return doc;
}

/** Sanitiza SVG subidos: elimina scripts, manejadores de eventos y referencias javascript: */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '')
    .replace(/<!ENTITY[^>]*>/gi, '');
}
