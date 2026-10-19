import { createComponent } from './registry';
import { newQuestion, newQuiz } from './assessment/factory';
import type { ComponentData, ScreenBackground } from './types';

export interface LayoutDef {
  id: string;
  name: string;
  description: string;
  /** mini-diagrama: lista de rectángulos [x,y,w,h] en % para la miniatura */
  thumb: [number, number, number, number, string?][];
  build(): { components: ComponentData[]; height?: number; background?: ScreenBackground };
}

const c = createComponent;
const T = (text: string, x = 80, y = 50, w = 1040, size = 40) => {
  const k = c('heading', { x, y, w, h: 70, props: { text } });
  k.style.fontSize = size;
  return k;
};
const P = (text: string, x: number, y: number, w: number, h: number, size = 18) => {
  const k = c('text', { x, y, w, h, props: { text } });
  k.style.fontSize = size;
  return k;
};
const LOREM = 'Desarrollá aquí el contenido principal de la pantalla. Usá frases cortas, ejemplos concretos y un lenguaje claro para tu audiencia.';

export const LAYOUTS: LayoutDef[] = [
  {
    id: 'title-text',
    name: 'Título + texto',
    description: 'Título destacado y un bloque de texto.',
    thumb: [[8, 10, 70, 12, 'h'], [8, 30, 84, 50, 't']],
    build: () => ({ components: [c('label', { x: 80, y: 50, w: 200, h: 36 }), T('Título de la pantalla', 80, 100), P(LOREM, 80, 200, 1040, 300, 20)] }),
  },
  {
    id: 'title-text-image',
    name: 'Título + texto + imagen',
    description: 'Título arriba, texto e imagen debajo.',
    thumb: [[8, 8, 84, 12, 'h'], [8, 28, 84, 18, 't'], [20, 52, 60, 40, 'i']],
    build: () => ({ components: [T('Título de la pantalla', 80, 40), P(LOREM, 80, 125, 1040, 90), c('image', { x: 300, y: 235, w: 600, h: 390 })] }),
  },
  {
    id: 'image-left',
    name: 'Imagen izquierda + texto',
    description: 'Imagen a la izquierda, contenido a la derecha.',
    thumb: [[6, 10, 42, 80, 'i'], [54, 15, 40, 12, 'h'], [54, 35, 40, 45, 't']],
    build: () => ({ components: [c('image', { x: 60, y: 60, w: 520, h: 555 }), T('Título', 630, 110, 510, 36), P(LOREM, 630, 210, 510, 260), c('navButton', { x: 630, y: 520, w: 200, h: 52, props: { text: 'Continuar' } })] }),
  },
  {
    id: 'image-right',
    name: 'Texto + imagen derecha',
    description: 'Contenido a la izquierda, imagen a la derecha.',
    thumb: [[6, 15, 40, 12, 'h'], [6, 35, 40, 45, 't'], [52, 10, 42, 80, 'i']],
    build: () => ({ components: [T('Título', 60, 110, 510, 36), P(LOREM, 60, 210, 510, 260), c('image', { x: 620, y: 60, w: 520, h: 555 })] }),
  },
  {
    id: 'video-text',
    name: 'Video + texto',
    description: 'Video protagonista con texto de apoyo.',
    thumb: [[6, 10, 58, 70, 'v'], [68, 15, 26, 12, 'h'], [68, 35, 26, 45, 't']],
    build: () => ({ components: [c('video', { x: 60, y: 90, w: 720, h: 405 }), T('Mirá el video', 820, 110, 320, 32), P('Observá con atención los pasos que se muestran. Luego vas a practicarlos.', 820, 190, 320, 220)] }),
  },
  {
    id: 'two-columns',
    name: 'Dos columnas',
    description: 'Título y dos columnas de texto.',
    thumb: [[8, 8, 84, 12, 'h'], [8, 30, 40, 60, 't'], [52, 30, 40, 60, 't']],
    build: () => ({
      components: [T('Título de la pantalla', 80, 50), c('subheading', { x: 80, y: 160, w: 500, h: 45, props: { text: 'Columna 1' } }), P(LOREM, 80, 220, 500, 300), c('subheading', { x: 620, y: 160, w: 500, h: 45, props: { text: 'Columna 2' } }), P(LOREM, 620, 220, 500, 300)],
    }),
  },
  {
    id: 'three-columns',
    name: 'Tres columnas',
    description: 'Tres bloques con ícono, título y texto.',
    thumb: [[8, 8, 84, 12, 'h'], [6, 30, 27, 60, 'c'], [37, 30, 27, 60, 'c'], [68, 30, 27, 60, 'c']],
    build: () => {
      const out: ComponentData[] = [T('Título de la pantalla', 80, 50)];
      [0, 1, 2].forEach((i) => {
        const x = 80 + i * 360;
        out.push(c('icon', { x: x + 120, y: 170, w: 80, h: 80, props: { icon: ['lightbulb', 'target', 'rocket'][i] } }));
        const st = c('subheading', { x, y: 270, w: 320, h: 45, props: { text: `Concepto ${i + 1}` } });
        st.style.textAlign = 'center';
        const tx = P('Descripción breve del concepto.', x, 325, 320, 140);
        tx.style.textAlign = 'center';
        out.push(st, tx);
      });
      return { components: out };
    },
  },
  {
    id: 'cards',
    name: 'Tarjetas',
    description: 'Grilla de tarjetas.',
    thumb: [[8, 8, 84, 12, 'h'], [6, 28, 27, 64, 'c'], [37, 28, 27, 64, 'c'], [68, 28, 27, 64, 'c']],
    build: () => ({
      components: [T('Explorá los temas', 80, 40), ...[0, 1, 2].map((i) => c('card', { x: 80 + i * 360, y: 150, w: 320, h: 440, props: { icon: ['book', 'calculator', 'chart'][i], title: `Tema ${i + 1}`, text: 'Descripción breve del tema de esta tarjeta.' } }))],
    }),
  },
  {
    id: 'bg-title',
    name: 'Imagen de fondo + título',
    description: 'Portada con imagen de fondo, título y texto.',
    thumb: [[0, 0, 100, 100, 'b'], [10, 30, 60, 14, 'h'], [10, 50, 50, 18, 't']],
    build: () => {
      const bg = c('background', { x: 0, y: 0, w: 1200, h: 675, props: { gradient: true } });
      const t = T('Título de portada', 100, 220, 800, 52);
      t.style.color = '#ffffff';
      const p = P('Subtítulo o bajada de la portada', 100, 320, 700, 80, 22);
      p.style.color = '#ffffff';
      return { components: [bg, t, p, c('navButton', { x: 100, y: 440, w: 220, h: 56, props: { text: 'Comenzar', variant: 'secondary' } })] };
    },
  },
  {
    id: 'fullscreen',
    name: 'Pantalla completa',
    description: 'Imagen a pantalla completa con mensaje central.',
    thumb: [[0, 0, 100, 100, 'i'], [25, 40, 50, 18, 'h']],
    build: () => {
      const bg = c('background', { x: 0, y: 0, w: 1200, h: 675, props: { color: '#0f172a' } });
      const t = T('Un mensaje poderoso', 150, 270, 900, 48);
      t.style.color = '#ffffff';
      t.style.textAlign = 'center';
      return { components: [bg, t] };
    },
  },
  {
    id: 'timeline',
    name: 'Línea de tiempo',
    description: 'Título y línea de tiempo interactiva.',
    thumb: [[8, 8, 84, 12, 'h'], [6, 45, 88, 4, 'l'], [10, 38, 4, 18, 'c'], [40, 38, 4, 18, 'c'], [70, 38, 4, 18, 'c']],
    build: () => ({ components: [T('Evolución', 80, 50), c('timeline', { x: 80, y: 170, w: 1040, h: 400 })] }),
  },
  {
    id: 'comparison',
    name: 'Comparación',
    description: 'Dos opciones lado a lado (correcto vs. incorrecto, antes vs. después).',
    thumb: [[8, 8, 84, 12, 'h'], [6, 28, 42, 64, 'g'], [52, 28, 42, 64, 'r']],
    build: () => {
      const a = c('banner', { x: 80, y: 160, w: 500, h: 420, props: { title: 'Correcto', text: 'Describí aquí la práctica recomendada y por qué funciona.', icon: 'check-circle', variant: 'success' } });
      const b = c('banner', { x: 620, y: 160, w: 500, h: 420, props: { title: 'Incorrecto', text: 'Describí aquí el error frecuente y sus consecuencias.', icon: 'alert', variant: 'danger' } });
      return { components: [T('Compará las opciones', 80, 50), a, b] };
    },
  },
  {
    id: 'questions',
    name: 'Preguntas',
    description: 'Actividad de práctica con pregunta y feedback.',
    thumb: [[8, 8, 84, 12, 'h'], [12, 28, 76, 64, 'q']],
    build: () => ({ height: 760, components: [T('Comprobá lo aprendido', 80, 40), c('question', { x: 190, y: 140, w: 820, h: 560, props: { question: newQuestion('single') } })] }),
  },
  {
    id: 'case-study',
    name: 'Caso práctico',
    description: 'Situación, imagen y decisión del alumno.',
    thumb: [[6, 8, 50, 12, 'h'], [6, 26, 50, 30, 't'], [62, 8, 32, 48, 'i'], [6, 62, 88, 32, 'q']],
    build: () => {
      const q = newQuestion('single');
      q.prompt = '¿Qué harías en esta situación?';
      return {
        height: 1000,
        components: [
          c('label', { x: 80, y: 40, w: 220, h: 36, props: { text: 'CASO PRÁCTICO' } }),
          T('Situación', 80, 90, 620, 38),
          P('Describí el contexto del caso: quién está involucrado, qué ocurrió y cuál es el desafío a resolver.', 80, 175, 620, 200),
          c('image', { x: 760, y: 60, w: 360, h: 320 }),
          c('question', { x: 80, y: 420, w: 1040, h: 520, props: { question: q } }),
        ],
      };
    },
  },
  {
    id: 'summary',
    name: 'Resumen',
    description: 'Puntos clave para cerrar la lección.',
    thumb: [[8, 8, 84, 12, 'h'], [8, 28, 60, 60, 't'], [72, 28, 20, 30, 'i']],
    build: () => ({
      components: [
        T('Resumen', 80, 50),
        c('list', { x: 80, y: 160, w: 680, h: 300, props: { marker: 'check', items: [{ text: 'Idea clave número uno' }, { text: 'Idea clave número dos' }, { text: 'Idea clave número tres' }, { text: 'Idea clave número cuatro' }] } }),
        c('icon', { x: 880, y: 180, w: 200, h: 200, props: { icon: 'award' } }),
        c('navButton', { x: 80, y: 520, w: 240, h: 52, props: { text: 'Continuar' } }),
      ],
    }),
  },
  {
    id: 'evaluation',
    name: 'Evaluación',
    description: 'Evaluación con puntaje, intentos y aprobación.',
    thumb: [[15, 8, 70, 84, 'q']],
    build: () => ({ height: 800, components: [c('quiz', { x: 170, y: 40, w: 860, h: 720, props: newQuiz() as any })] }),
  },
];

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** SVG de miniatura de layout (para editor y tabla layouts) */
export function layoutThumbSvg(l: LayoutDef, primary = '#2563eb'): string {
  const fill: Record<string, string> = { h: primary, t: '#94a3b8', i: '#cbd5e1', v: '#475569', c: '#e2e8f0', b: primary, q: '#bfdbfe', l: primary, g: '#bbf7d0', r: '#fecaca' };
  const rects = l.thumb
    .map(([x, y, w, h, k]) => `<rect x="${x}" y="${y * 0.5625}" width="${w}" height="${h * 0.5625}" rx="1.5" fill="${fill[k || 't'] || '#cbd5e1'}"${k === 'b' ? ' opacity="0.25"' : ''}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 56.25"><rect width="100" height="56.25" fill="#f8fafc"/>${rects}</svg>`;
}
