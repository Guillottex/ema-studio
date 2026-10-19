import {
  getLayout, defaultCourseSettings, PRESET_THEMES, SCHEMA_VERSION, uid, newQuestion,
  type CourseDoc, type ScreenData, type Theme, type ComponentData,
} from '@engine';

function fromLayout(title: string, layoutId: string, patch?: (c: ComponentData[]) => void): ScreenData {
  const l = getLayout(layoutId)!;
  const b = l.build();
  patch?.(b.components);
  return { id: uid(10), title, layout: layoutId, height: b.height || 675, background: b.background || {}, settings: {}, components: b.components };
}

const setText = (comps: ComponentData[], type: string, text: string, nth = 0) => {
  const c = comps.filter((x) => x.type === type)[nth];
  if (c) c.props.text = text;
};

interface Spec {
  name: string;
  description: string;
  category: string;
  themeId: string;
  modules: { title: string; lessons: { title: string; screens: [string, string][] }[] }[];
  cover: string;
}

const SPECS: Spec[] = [
  {
    name: 'Curso corporativo EMA', description: 'Con la identidad de EMA Servicios: comunicar políticas, procesos o cambios organizacionales.', category: 'Corporativo', themeId: 'ema-servicios', cover: 'Nombre del programa corporativo',
    modules: [
      { title: 'Presentación', lessons: [{ title: 'Bienvenida', screens: [['Objetivos', 'summary'], ['Mensaje de la dirección', 'video-text']] }] },
      { title: 'Contenido principal', lessons: [{ title: 'Tema 1', screens: [['Contexto', 'image-right'], ['Pilares', 'three-columns'], ['Antes y después', 'comparison'], ['Práctica', 'questions']] }] },
      { title: 'Cierre', lessons: [{ title: 'Conclusiones', screens: [['Resumen', 'summary'], ['Evaluación final', 'evaluation']] }] },
    ],
  },
  {
    name: 'Curso académico', description: 'Unidades temáticas con lecturas, ejemplos y autoevaluaciones.', category: 'Académico', themeId: 'academic', cover: 'Nombre de la materia',
    modules: [
      { title: 'Unidad 1', lessons: [{ title: 'Marco teórico', screens: [['Introducción', 'title-text'], ['Desarrollo', 'two-columns'], ['Línea histórica', 'timeline'], ['Autoevaluación', 'questions']] }] },
      { title: 'Unidad 2', lessons: [{ title: 'Aplicaciones', screens: [['Conceptos', 'title-text-image'], ['Caso de estudio', 'case-study'], ['Síntesis', 'summary']] }] },
      { title: 'Examen', lessons: [{ title: 'Evaluación integradora', screens: [['Examen final', 'evaluation']] }] },
    ],
  },
  {
    name: 'Curso de inducción', description: 'Onboarding para nuevos colaboradores: empresa, equipo, herramientas y primeros pasos.', category: 'Recursos Humanos', themeId: 'onboarding', cover: '¡Bienvenido/a al equipo!',
    modules: [
      { title: 'Nuestra empresa', lessons: [{ title: 'Quiénes somos', screens: [['Historia', 'timeline'], ['Misión y valores', 'cards']] }] },
      { title: 'Tu puesto', lessons: [{ title: 'Primeros días', screens: [['Tu equipo', 'image-left'], ['Herramientas', 'three-columns'], ['Checklist', 'summary']] }] },
      { title: 'Cierre', lessons: [{ title: 'Validación', screens: [['Cuestionario de inducción', 'evaluation']] }] },
    ],
  },
  {
    name: 'Curso de seguridad', description: 'Seguridad e higiene: riesgos, elementos de protección, procedimientos y evaluación.', category: 'Seguridad e Higiene', themeId: 'safety', cover: 'Seguridad e higiene en el trabajo',
    modules: [
      { title: 'Riesgos', lessons: [{ title: 'Identificación', screens: [['Riesgos frecuentes', 'cards'], ['Correcto vs. incorrecto', 'comparison']] }] },
      { title: 'Prevención', lessons: [{ title: 'Elementos de protección', screens: [['EPP obligatorios', 'image-right'], ['Video de procedimiento', 'video-text'], ['Situación de riesgo', 'case-study']] }] },
      { title: 'Evaluación', lessons: [{ title: 'Evaluación obligatoria', screens: [['Evaluación de seguridad', 'evaluation']] }] },
    ],
  },
  {
    name: 'Curso de capacitación', description: 'Capacitación práctica orientada a habilidades: demostración, práctica y evaluación.', category: 'Capacitación', themeId: 'ema-servicios', cover: 'Nombre de la capacitación',
    modules: [
      { title: 'Fundamentos', lessons: [{ title: 'Conceptos', screens: [['Introducción', 'title-text-image'], ['Conceptos clave', 'two-columns']] }] },
      { title: 'Práctica', lessons: [{ title: 'Paso a paso', screens: [['Demostración', 'video-text'], ['Ejercicio', 'questions'], ['Caso práctico', 'case-study']] }] },
      { title: 'Cierre', lessons: [{ title: 'Evaluación', screens: [['Resumen', 'summary'], ['Evaluación final', 'evaluation']] }] },
    ],
  },
  {
    name: 'Curso de procedimientos', description: 'Documentá procesos internos paso a paso con responsables y controles.', category: 'Procesos', themeId: 'minimal-dark', cover: 'Procedimiento operativo',
    modules: [
      { title: 'Alcance', lessons: [{ title: 'Objetivo del procedimiento', screens: [['Alcance y responsables', 'two-columns']] }] },
      { title: 'Paso a paso', lessons: [{ title: 'Etapas', screens: [['Flujo del proceso', 'timeline'], ['Detalle de cada paso', 'image-right'], ['Errores frecuentes', 'comparison'], ['Ordenar el proceso', 'questions']] }] },
      { title: 'Control', lessons: [{ title: 'Verificación', screens: [['Resumen', 'summary'], ['Evaluación', 'evaluation']] }] },
    ],
  },
];

export function templateThumb(theme: Theme, title: string): string {
  const c = theme.colors;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g-${c.primary.slice(1)}-${title.length}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.secondary}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g-${c.primary.slice(1)}-${title.length})"/><rect x="20" y="118" width="70" height="8" rx="4" fill="#fff" opacity=".6"/><text x="20" y="100" font-family="Arial" font-size="20" font-weight="bold" fill="#fff">${esc(title)}</text><circle cx="270" cy="50" r="28" fill="${c.accent}" opacity=".85"/><rect x="200" y="110" width="100" height="50" rx="8" fill="#fff" opacity=".2"/></svg>`;
}

export function courseTemplates(): { name: string; description: string; category: string; thumbnail: string; data: CourseDoc }[] {
  return SPECS.map((s) => {
    const theme = PRESET_THEMES.find((t) => t.id === s.themeId) || PRESET_THEMES[0];
    const cover = fromLayout('Portada', 'bg-title', (cs) => setText(cs, 'heading', s.cover));
    const modules = s.modules.map((m, mi) => ({
      id: uid(10),
      title: m.title,
      description: '',
      lessons: m.lessons.map((l, li) => ({
        id: uid(10),
        title: l.title,
        description: '',
        screens: [
          ...(mi === 0 && li === 0 ? [cover] : []),
          ...l.screens.map(([title, layout]) => fromLayout(title, layout, (cs) => {
            setText(cs, 'heading', title);
            const quiz = cs.find((c) => c.type === 'quiz');
            if (quiz) { quiz.props.isFinal = true; quiz.props.title = title; quiz.props.questions = [newQuestion('single'), newQuestion('truefalse'), newQuestion('multiple')]; }
          })),
        ],
      })),
    }));
    const settings = defaultCourseSettings(theme);
    settings.completion = { criteria: 'quiz', visitedPercent: 100 };
    const doc: CourseDoc = {
      schemaVersion: SCHEMA_VERSION, id: uid(10), title: s.name, description: s.description, author: '', category: '', duration: '1 hora', level: 'Básico',
      language: 'es', version: '1.0', objectives: [], requirements: [], status: 'draft', settings, modules,
    };
    return { name: s.name, description: s.description, category: s.category, thumbnail: templateThumb(theme, s.name), data: doc };
  });
}

export function screenTemplates(): { name: string; description: string; data: Partial<ScreenData> }[] {
  const mk = (title: string, layout: string, patch?: (c: ComponentData[]) => void) => {
    const s = fromLayout(title, layout, patch);
    return { height: s.height, background: s.background, settings: s.settings, layout: s.layout, components: s.components };
  };
  return [
    { name: 'Portada con degradé', description: 'Título grande, bajada y botón Comenzar.', data: mk('Portada', 'bg-title') },
    { name: 'Pregunta de repaso', description: 'Pregunta de opción múltiple con feedback.', data: mk('Repaso', 'questions') },
    { name: 'Cierre con resumen', description: 'Ideas clave e ícono de logro.', data: mk('Resumen', 'summary') },
    { name: 'Correcto vs. incorrecto', description: 'Comparación de buenas y malas prácticas.', data: mk('Comparación', 'comparison') },
  ];
}
