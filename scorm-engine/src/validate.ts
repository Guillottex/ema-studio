import { flattenScreens, type ComponentData, type CourseDoc, type Question } from './types';
import { getDef, isTrackable } from './registry';
import { validateQuestion } from './assessment/grading';

export type IssueLevel = 'ok' | 'warning' | 'error';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  where?: string;
  screenId?: string;
  componentId?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: Issue[];
  checks: { name: string; level: IssueLevel; detail: string }[];
}

/** Recorre recursivamente cualquier valor y devuelve las referencias "asset:..." */
export function collectAssetRefs(value: any, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('asset:')) out.add(value.slice(6));
    else if (value.includes('asset:')) {
      const re = /asset:([A-Za-z0-9._-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value))) out.add(m[1]);
    }
  } else if (Array.isArray(value)) value.forEach((v) => collectAssetRefs(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectAssetRefs(v, out));
  return out;
}

const stripHtml = (s: string) => String(s || '').replace(/<[^>]*>/g, '').trim();

/**
 * Valida un curso antes de exportar.
 * @param assetExists función que indica si un recurso (nombre interno) existe en la biblioteca
 */
export function validateCourse(doc: CourseDoc, assetExists: (name: string) => boolean = () => true): ValidationReport {
  const issues: Issue[] = [];
  const add = (level: IssueLevel, code: string, message: string, extra: Partial<Issue> = {}) => issues.push({ level, code, message, ...extra });
  const flat = flattenScreens(doc);

  // --- Estructura ---
  if (!doc.title?.trim()) add('error', 'course.title', 'El curso no tiene nombre');
  if (!doc.modules.length) add('error', 'course.empty', 'El curso no tiene módulos');
  doc.modules.forEach((m, mi) => {
    if (!m.lessons.length) add('warning', 'module.empty', `El módulo "${m.title}" no tiene lecciones`, { where: `Módulo ${mi + 1}` });
    m.lessons.forEach((l, li) => {
      if (!l.screens.length) add('warning', 'lesson.empty', `La lección "${l.title}" no tiene pantallas`, { where: `Módulo ${mi + 1} › Lección ${li + 1}` });
    });
  });
  if (!flat.length) add('error', 'course.noscreens', 'El curso no tiene pantallas');

  // --- Identificadores únicos ---
  const ids = new Map<string, string>();
  const dup = (id: string, label: string) => {
    if (ids.has(id)) add('error', 'id.duplicate', `Identificador duplicado "${id}" (${label} y ${ids.get(id)})`);
    else ids.set(id, label);
  };
  doc.modules.forEach((m) => {
    dup(m.id, `módulo ${m.title}`);
    m.lessons.forEach((l) => {
      dup(l.id, `lección ${l.title}`);
      l.screens.forEach((s) => {
        dup(s.id, `pantalla ${s.title}`);
        s.components.forEach((c) => dup(c.id, `componente en ${s.title}`));
      });
    });
  });

  const allNavIds = new Set<string>();
  doc.modules.forEach((m) => { allNavIds.add(m.id); m.lessons.forEach((l) => { allNavIds.add(l.id); l.screens.forEach((s) => allNavIds.add(s.id)); }); });

  let finalQuizzes = 0;
  const allAssets = collectAssetRefs({ settings: doc.settings, coverImage: doc.coverImage });

  flat.forEach((f, idx) => {
    const s = f.screen;
    const where = `${f.module.title} › ${f.lesson.title} › ${s.title}`;
    const base = { where, screenId: s.id };
    const compIds = new Set(s.components.map((c) => c.id));
    if (!s.components.length) add('error', 'screen.empty', 'Pantalla sin contenido', base);
    if (!s.title?.trim()) add('warning', 'screen.title', 'Pantalla sin título', base);
    collectAssetRefs(s.background, allAssets);

    const hasNavButton = s.components.some((c) => c.type === 'navButton' || (c.type === 'quiz' && (c.props.passScreen || c.props.failScreen)) || (c.events || []).some((e) => e.actions.some((a) => ['next', 'goto'].includes(a.type))));
    if (s.settings?.hideNav && !hasNavButton && idx < flat.length - 1) add('error', 'nav.deadend', 'La pantalla oculta la navegación y no tiene botones para avanzar', base);
    if (s.settings?.requireCompletion && !s.components.some(isTrackable)) add('warning', 'nav.requireNoActivities', 'Requiere completar actividades pero no tiene actividades', base);

    s.components.forEach((c: ComponentData) => {
      const cb = { ...base, componentId: c.id };
      const def = getDef(c.type);
      const label = def?.label || c.type;
      if (!def) { add('error', 'component.unknown', `Tipo de componente desconocido "${c.type}"`, cb); return; }
      collectAssetRefs(c.props, allAssets);
      const d = c.layout?.desktop;
      if (!d || [d.x, d.y, d.w, d.h].some((n) => typeof n !== 'number' || isNaN(n))) add('error', 'component.layout', `${label}: posición/tamaño inválidos`, cb);
      else if (d.x + d.w > 1200 + 20 || d.y + d.h > s.height + 20) add('warning', 'component.outside', `${label} queda fuera del área visible`, cb);

      // contenido vacío
      if (['image', 'video', 'audio', 'pdf'].includes(c.type) && !c.props.src) add('error', 'media.missing', `${label} sin archivo seleccionado`, cb);
      if (c.type === 'embed') {
        if (!c.props.url) add('error', 'media.missing', 'Video YouTube/Vimeo sin URL', cb);
        else add('warning', 'media.online', 'El video de YouTube/Vimeo requiere conexión a Internet para reproducirse', cb);
      }
      if (['heading', 'subheading', 'text'].includes(c.type) && !String(c.props.text || '').trim()) add('warning', 'text.empty', `${label} vacío`, cb);
      if (c.type === 'richtext' && !stripHtml(c.props.html)) add('warning', 'text.empty', 'Texto enriquecido vacío', cb);

      // links
      const html = JSON.stringify(c.props);
      const hrefRe = /href=\\"([^"\\]*)\\"/g;
      let m: RegExpExecArray | null;
      while ((m = hrefRe.exec(html))) {
        const href = m[1];
        if (!href || href === '#' || /^javascript:/i.test(href)) add('error', 'link.broken', `Enlace vacío o inválido en ${label}`, cb);
        else if (/^https?:\/\//i.test(href)) add('warning', 'link.external', `Enlace externo (requiere Internet): ${href}`, cb);
      }

      // navegación
      if (c.type === 'navButton' && c.props.target === 'screen' && !allNavIds.has(c.props.targetId)) add('error', 'nav.target', 'Botón de navegación sin destino válido', cb);
      (c.events || []).forEach((e) =>
        e.actions.forEach((a) => {
          if (a.type === 'goto' && !allNavIds.has(a.screenId || '')) add('error', 'nav.target', `Acción "Ir a pantalla" de ${label} sin destino válido`, cb);
          if (['show', 'hide', 'toggle', 'playMedia', 'pauseMedia', 'animate'].includes(a.type) && (!a.target || !compIds.has(a.target))) add('error', 'action.target', `Acción "${a.type}" de ${label} apunta a un componente inexistente`, cb);
          if (a.type === 'setVar' && !a.varName) add('error', 'action.var', `Acción "variable" de ${label} sin nombre de variable`, cb);
        })
      );
      const cond = c.visibility?.condition;
      if (cond && cond.type !== 'always') {
        if (cond.type === 'componentComplete' && !ids.has(cond.target || '')) add('error', 'condition.target', `Condición de ${label} apunta a un componente inexistente`, cb);
        if ((cond.type === 'screenVisited' || (cond.type === 'screenComplete' && cond.target)) && !allNavIds.has(cond.target || '')) add('error', 'condition.target', `Condición de ${label} apunta a una pantalla inexistente`, cb);
      }

      // evaluaciones
      if (c.type === 'question') {
        const q: Question = c.props.question;
        if (!q) add('error', 'question.missing', 'Pregunta sin configurar', cb);
        else {
          validateQuestion(q).forEach((msg) => add('error', 'question.invalid', `Pregunta: ${msg}`, cb));
          collectAssetRefs(q.media, allAssets);
        }
      }
      if (c.type === 'quiz') {
        const qs: Question[] = c.props.questions || [];
        if (c.props.isFinal) finalQuizzes++;
        if (!qs.length) add('error', 'quiz.empty', `Evaluación "${c.props.title}" sin preguntas`, cb);
        qs.forEach((q, i) => validateQuestion(q).forEach((msg) => add('error', 'question.invalid', `Evaluación "${c.props.title}", pregunta ${i + 1}: ${msg}`, cb)));
        if (c.props.drawCount > qs.length) add('warning', 'quiz.draw', `La evaluación muestra ${c.props.drawCount} preguntas pero sólo tiene ${qs.length}`, cb);
        if (!(c.props.passingScore >= 0 && c.props.passingScore <= 100)) add('error', 'quiz.passing', 'Puntaje mínimo fuera de rango (0-100)', cb);
        if (c.props.passScreen && !allNavIds.has(c.props.passScreen)) add('error', 'nav.target', 'Pantalla de aprobación inexistente', cb);
        if (c.props.failScreen && !allNavIds.has(c.props.failScreen)) add('error', 'nav.target', 'Pantalla de desaprobación inexistente', cb);
      }
    });
  });

  const crit = doc.settings.completion?.criteria;
  if ((crit === 'quiz' || crit === 'both') && finalQuizzes === 0) add('warning', 'completion.noquiz', 'El criterio de finalización requiere evaluación final, pero el curso no tiene ninguna. Se usará "pantallas vistas".');
  if (finalQuizzes > 1) add('warning', 'completion.multifinal', 'Hay más de una evaluación final; se reportará el mejor puntaje.');

  // --- Recursos ---
  allAssets.forEach((name) => {
    if (!assetExists(name)) add('error', 'asset.missing', `Recurso faltante en la biblioteca: ${name}`);
  });

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const lvl = (codes: string[]): IssueLevel => {
    const rel = issues.filter((i) => codes.some((c) => i.code.startsWith(c)));
    return rel.some((i) => i.level === 'error') ? 'error' : rel.length ? 'warning' : 'ok';
  };
  const count = (codes: string[]) => issues.filter((i) => codes.some((c) => i.code.startsWith(c))).length;
  const checks = [
    { name: 'Estructura del curso', codes: ['course.', 'module.', 'lesson.'] },
    { name: 'Identificadores', codes: ['id.'] },
    { name: 'Pantallas con contenido', codes: ['screen.', 'text.', 'component.'] },
    { name: 'Recursos multimedia', codes: ['asset.', 'media.'] },
    { name: 'Links', codes: ['link.'] },
    { name: 'Navegación e interacciones', codes: ['nav.', 'action.', 'condition.'] },
    { name: 'Evaluaciones', codes: ['question.', 'quiz.', 'completion.'] },
  ].map((ch) => ({ name: ch.name, level: lvl(ch.codes), detail: count(ch.codes) ? `${count(ch.codes)} observación(es)` : 'Correcto' }));

  return { valid: errors === 0, errors, warnings, issues, checks };
}
