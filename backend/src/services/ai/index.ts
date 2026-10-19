import {
  createComponent, defaultCourseSettings, newQuestion, newQuiz, uid, SCHEMA_VERSION, DEFAULT_THEME,
  type CourseDoc, type ModuleData, type ScreenData, type Question, type Theme, type ComponentData,
} from '@engine';
import { config } from '../../config';
import { HttpError } from '../../middleware/error';
import { llmProvider } from './llm';
import type { AICourseOutline, AIQuestionOutline, AIScreenOutline, CourseBrief, AIProvider } from './types';

export * from './types';

export function aiStatus() {
  const configured = config.ai.provider !== 'none' && !!config.ai.apiKey;
  return { provider: config.ai.provider, configured, model: config.ai.model || null };
}

export function getProvider(): AIProvider {
  if (!aiStatus().configured) throw new HttpError(400, 'La generación con IA no está configurada. Definí AI_PROVIDER y AI_API_KEY en el archivo .env.');
  return llmProvider;
}

/* ------------------------- conversión outline → curso ------------------------- */

function toQuestion(q: AIQuestionOutline): Question {
  const base = newQuestion(q.type === 'multiple' ? 'multiple' : q.type === 'truefalse' ? 'truefalse' : 'single');
  const opts = (q.options || []).filter((o) => o && o.text).slice(0, 6);
  if (opts.length >= 2) base.options = opts.map((o) => ({ id: uid(6), text: String(o.text), correct: !!o.correct }));
  if ((base.type === 'single' || base.type === 'truefalse') && base.options.filter((o) => o.correct).length !== 1) {
    base.options.forEach((o, i) => (o.correct = i === 0));
  }
  base.prompt = String(q.prompt || base.prompt);
  base.explanation = q.explanation || '';
  return base;
}

function text(t: string, x: number, y: number, w: number, h: number, size = 18): ComponentData {
  const c = createComponent('text', { x, y, w, h, props: { text: t } });
  c.style.fontSize = size;
  return c;
}

function heading(t: string, y = 50, size = 38, w = 1040): ComponentData {
  const c = createComponent('heading', { x: 80, y, w, h: 70, props: { text: t } });
  c.style.fontSize = size;
  return c;
}

function buildScreen(s: AIScreenOutline, isFirst: boolean): ScreenData {
  const comps: ComponentData[] = [];
  let height = 675;
  const kind = s.kind || 'content';
  if (isFirst && kind === 'intro') {
    comps.push(createComponent('background', { x: 0, y: 0, w: 1200, h: 675, props: { gradient: true } }));
    const h1 = heading(s.heading || s.title, 220, 50, 900);
    h1.style.color = '#ffffff';
    comps.push(h1);
    if (s.body) { const t = text(s.body, 80, 320, 800, 120, 22); t.style.color = '#ffffff'; comps.push(t); }
    comps.push(createComponent('navButton', { x: 80, y: 470, w: 220, h: 56, props: { text: 'Comenzar', variant: 'secondary' } }));
  } else if (kind === 'practice' && s.question) {
    height = 760;
    comps.push(heading(s.heading || s.title, 40));
    comps.push(createComponent('question', { x: 190, y: 140, w: 820, h: 560, props: { question: toQuestion(s.question) } }));
  } else if ((kind === 'list' || kind === 'summary') && s.bullets?.length) {
    comps.push(heading(s.heading || s.title));
    if (s.body) comps.push(text(s.body, 80, 135, 1040, 70));
    comps.push(createComponent('list', { x: 80, y: s.body ? 215 : 150, w: 760, h: 380, props: { marker: kind === 'summary' ? 'check' : 'disc', items: s.bullets.slice(0, 8).map((b) => ({ text: b })) } }));
    comps.push(createComponent('icon', { x: 920, y: 220, w: 180, h: 180, props: { icon: kind === 'summary' ? 'award' : 'lightbulb' } }));
  } else if (kind === 'image') {
    comps.push(heading(s.heading || s.title, 110, 34, 520));
    comps.push(text(s.body || '', 80, 210, 520, 300));
    comps.push(createComponent('image', { x: 640, y: 60, w: 500, h: 555 }));
  } else {
    comps.push(heading(s.heading || s.title));
    comps.push(text(s.body || '', 80, 150, 1040, s.bullets?.length ? 150 : 400, 20));
    if (s.bullets?.length) comps.push(createComponent('list', { x: 80, y: 320, w: 1040, h: 300, props: { items: s.bullets.slice(0, 6).map((b) => ({ text: b })) } }));
  }
  return { id: uid(10), title: s.title || 'Pantalla', layout: undefined, height, background: {}, settings: {}, components: comps };
}

export function outlineToDoc(o: AICourseOutline, theme: Theme = DEFAULT_THEME): CourseDoc {
  if (!o || !Array.isArray(o.modules) || !o.modules.length) throw new HttpError(502, 'La estructura generada no tiene módulos');
  let first = true;
  const modules: ModuleData[] = o.modules.map((m) => ({
    id: uid(10),
    title: m.title || 'Módulo',
    description: '',
    lessons: (m.lessons || []).map((l) => ({
      id: uid(10),
      title: l.title || 'Lección',
      description: '',
      screens: (l.screens || []).map((s) => {
        const sc = buildScreen(s, first);
        first = false;
        return sc;
      }),
    })),
  }));
  if (o.finalQuiz?.length) {
    const quiz = { ...newQuiz(), title: 'Evaluación final', isFinal: true, attempts: 3, questions: o.finalQuiz.map(toQuestion) };
    const passId = uid(10);
    const quizComp = createComponent('quiz', { x: 170, y: 40, w: 860, h: 720, props: { ...quiz, passScreen: passId } });
    const done = createComponent('score', { x: 300, y: 180, w: 600, h: 260 });
    modules.push({
      id: uid(10), title: 'Evaluación', description: '',
      lessons: [{ id: uid(10), title: 'Evaluación final', description: '', screens: [
        { id: uid(10), title: 'Evaluación final', height: 800, background: {}, settings: { requireCompletion: true }, components: [quizComp] },
        { id: passId, title: 'Resultado', height: 675, background: {}, settings: {}, components: [heading('¡Curso finalizado!', 60), done] },
      ] }],
    });
  }
  const settings = defaultCourseSettings(theme);
  if (o.finalQuiz?.length) settings.completion = { criteria: 'quiz', visitedPercent: 100 };
  return {
    schemaVersion: SCHEMA_VERSION, id: uid(10), title: o.title || 'Curso generado', description: o.description || '', author: '',
    objectives: o.objectives || [], requirements: [], language: 'es', level: 'Básico', version: '1.0', duration: '', settings, modules,
  };
}

/* ---------------------- generador de estructura (sin IA) ---------------------- */

/** Crea un esqueleto de curso editable a partir de los parámetros (no requiere IA). */
export function structureOutline(b: CourseBrief): AICourseOutline {
  const n = Math.max(1, Math.min(12, b.modules || 3));
  const topic = (b.prompt || 'Nuevo curso').split(/[.\n]/)[0].trim().slice(0, 120);
  return {
    title: topic.charAt(0).toUpperCase() + topic.slice(1),
    description: b.prompt,
    objectives: ['Comprender los conceptos principales', 'Aplicar lo aprendido en situaciones reales', 'Evaluar el propio desempeño'],
    modules: Array.from({ length: n }, (_, i) => ({
      title: `Módulo ${i + 1}`,
      lessons: [1, 2].map((li) => ({
        title: `Lección ${li}`,
        screens: [
          ...(i === 0 && li === 1 ? [{ title: 'Portada', kind: 'intro' as const, heading: topic, body: `Nivel ${b.level || 'básico'} · Duración estimada: ${b.duration || '1 hora'}` }] : []),
          { title: 'Introducción', kind: 'content' as const, heading: 'Introducción', body: '[Completar] Presentá el tema de la lección y por qué es importante para el participante.' },
          { title: 'Conceptos clave', kind: 'list' as const, heading: 'Conceptos clave', bullets: ['[Completar] Concepto 1', '[Completar] Concepto 2', '[Completar] Concepto 3'] },
          { title: 'Práctica', kind: 'practice' as const, heading: 'Comprobá lo aprendido', question: { type: 'single' as const, prompt: '[Completar] Pregunta de práctica', options: [{ text: 'Respuesta correcta', correct: true }, { text: 'Distractor 1' }, { text: 'Distractor 2' }] } },
          { title: 'Resumen', kind: 'summary' as const, heading: 'Resumen', bullets: ['[Completar] Idea principal 1', '[Completar] Idea principal 2'] },
        ],
      })),
    })),
    finalQuiz: Array.from({ length: 5 }, (_, i) => ({ type: 'single' as const, prompt: `[Completar] Pregunta ${i + 1} de la evaluación final`, options: [{ text: 'Respuesta correcta', correct: true }, { text: 'Opción B' }, { text: 'Opción C' }] })),
  };
}

/* --------------------- importación de contenido (texto/Word/PDF) --------------------- */

function words(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Convierte texto estructurado (Markdown simple) en un outline:
 * "# " = módulo, "## " = lección, "### " = pantalla, "- " = viñetas.
 * Sin títulos, divide el texto en pantallas de ~150 palabras.
 */
export function textToOutline(raw: string, title = 'Curso importado'): AICourseOutline {
  const lines = raw.replace(/\r/g, '').split('\n');
  const hasHeadings = lines.some((l) => /^#{1,3}\s+\S/.test(l));
  const outline: AICourseOutline = { title, modules: [] };
  if (hasHeadings) {
    type Mod = AICourseOutline['modules'][0];
    type Les = Mod['lessons'][0];
    const st: { mod: Mod | null; les: Les | null; scr: AIScreenOutline | null } = { mod: null, les: null, scr: null };
    const ensure = (): AIScreenOutline => {
      if (!st.mod) { st.mod = { title: 'Módulo 1', lessons: [] }; outline.modules.push(st.mod); }
      if (!st.les) { st.les = { title: 'Lección 1', screens: [] }; st.mod.lessons.push(st.les); }
      if (!st.scr) { st.scr = { title: st.les.title, heading: st.les.title, body: '', kind: 'content' }; st.les.screens.push(st.scr); }
      return st.scr;
    };
    for (const line of lines) {
      const t = line.trim();
      let m: RegExpExecArray | null;
      if ((m = /^#\s+(.+)/.exec(t))) { st.mod = { title: m[1], lessons: [] }; outline.modules.push(st.mod); st.les = null; st.scr = null; continue; }
      if ((m = /^##\s+(.+)/.exec(t))) {
        if (!st.mod) { st.mod = { title: 'Módulo 1', lessons: [] }; outline.modules.push(st.mod); }
        st.les = { title: m[1], screens: [] }; st.mod.lessons.push(st.les); st.scr = null; continue;
      }
      if ((m = /^###\s+(.+)/.exec(t))) { ensure(); st.scr = { title: m[1], heading: m[1], body: '', kind: 'content' }; st.les!.screens.push(st.scr); continue; }
      if (!t) continue;
      let s = ensure();
      if ((m = /^[-*•]\s+(.+)/.exec(t))) { s.bullets = [...(s.bullets || []), m[1]]; if (!s.body) s.kind = 'list'; continue; }
      if (words(s.body || '') > 170) {
        s = { title: `${s.title} (cont.)`, heading: s.heading, body: '', kind: 'content' };
        st.scr = s;
        st.les!.screens.push(s);
      }
      s.body = s.body ? `${s.body}\n\n${t}` : t;
    }
  } else {
    const paras = raw.split(/\n\s*\n/).map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const screens: AIScreenOutline[] = [];
    let cur = '';
    for (const p of paras) {
      if (words(cur) + words(p) > 150 && cur) { screens.push({ title: `Parte ${screens.length + 1}`, heading: cur.split(/[.:]/)[0].slice(0, 70), body: cur }); cur = ''; }
      cur = cur ? `${cur}\n\n${p}` : p;
    }
    if (cur) screens.push({ title: `Parte ${screens.length + 1}`, heading: cur.split(/[.:]/)[0].slice(0, 70), body: cur });
    const lessons: AICourseOutline['modules'][0]['lessons'] = [];
    for (let i = 0; i < screens.length; i += 5) lessons.push({ title: `Lección ${lessons.length + 1}`, screens: screens.slice(i, i + 5) });
    outline.modules.push({ title: 'Contenido', lessons });
  }
  outline.modules = outline.modules.filter((m) => m.lessons.some((l) => l.screens.length));
  if (!outline.modules.length) throw new HttpError(400, 'No se encontró contenido para importar');
  return outline;
}

/** Extrae texto de un archivo (txt/md, docx o pdf) conservando títulos cuando es posible. */
export async function extractText(fileName: string, buf: Buffer): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'txt' || ext === 'md') return buf.toString('utf8');
  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const { value: html } = await mammoth.convertToHtml({ buffer: buf });
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  if (ext === 'pdf') {
    // @ts-ignore - sin tipos
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const out = await pdfParse(buf);
    return out.text;
  }
  throw new HttpError(400, 'Formato no soportado. Usá .txt, .md, .docx o .pdf');
}
