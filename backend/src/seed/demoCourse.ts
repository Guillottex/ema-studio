import {
  createComponent, defaultCourseSettings, newQuestion, newQuiz, uid, PRESET_THEMES, SCHEMA_VERSION,
  type ComponentData, type CourseDoc, type ScreenData, type Question, type AnimationConfig, type ComponentEvent,
} from '@engine';

type A = Record<string, string>; // nombre del archivo de demo → "asset:stored_name"

function comp(type: string, x: number, y: number, w: number, h: number, props: Record<string, any> = {}, extra: Partial<ComponentData> = {}): ComponentData {
  const c = createComponent(type, { x, y, w, h, props });
  if (extra.style) c.style = { ...c.style, ...extra.style };
  if (extra.animation) c.animation = { ...c.animation!, ...extra.animation } as AnimationConfig;
  if (extra.events) c.events = extra.events as ComponentEvent[];
  if (extra.visibility) c.visibility = extra.visibility;
  if (extra.name) c.name = extra.name;
  return c;
}

const anim = (type: AnimationConfig['type'], delay = 0, direction: AnimationConfig['direction'] = 'up', duration = 600): Partial<ComponentData> => ({ animation: { type, delay, direction, duration, trigger: 'load' } });

function screen(title: string, components: ComponentData[], opts: Partial<ScreenData> = {}): ScreenData {
  return { id: uid(10), title, height: 675, background: {}, settings: {}, components, ...opts };
}

function q(type: Question['type'], prompt: string, patch: Partial<Question>): Question {
  return { ...newQuestion(type), prompt, ...patch };
}
const opt = (text: string, correct = false) => ({ id: uid(6), text, correct });

export function buildDemoCourse(a: A): CourseDoc {
  const theme = PRESET_THEMES.find((t) => t.id === 'ema-servicios')!;

  /* ---------------- Módulo 1 ---------------- */
  const portada = screen('Portada', [
    comp('background', 0, 0, 1200, 675, { image: a['excel-portada.jpg'], overlay: 'rgba(20,21,60,0.45)' }),
    comp('label', 80, 150, 220, 40, { text: 'CURSO E-LEARNING', variant: 'secondary' }, anim('fade', 100)),
    comp('heading', 80, 205, 760, 90, { text: 'Excel Básico' }, { style: { fontSize: 72, color: '#ffffff' }, ...anim('slide', 250, 'right', 700) }),
    comp('text', 80, 310, 640, 90, { text: 'Aprendé a crear planillas, usar fórmulas y leer gráficos paso a paso.' }, { style: { fontSize: 24, color: '#eef8fc' }, ...anim('fade', 500) }),
    comp('badge', 80, 410, 260, 44, { text: '2 horas · Nivel básico', icon: 'clock', color: '#76C6E2' }, anim('zoom', 700)),
    comp('navButton', 80, 485, 240, 58, { text: 'Comenzar curso', variant: 'secondary' }, anim('bounce', 900)),
  ], { layout: 'bg-title' });

  const objetivos = screen('Objetivos', [
    comp('label', 80, 50, 160, 34, { text: 'OBJETIVOS', variant: 'muted' }),
    comp('heading', 80, 95, 700, 70, { text: '¿Qué vas a aprender?' }, { style: { fontSize: 42 } }),
    comp('list', 80, 190, 700, 300, { marker: 'check', items: [
      { text: 'Reconocer las partes de la ventana de una hoja de cálculo.' },
      { text: 'Ingresar distintos tipos de datos en celdas y rangos.' },
      { text: 'Construir fórmulas con operadores y funciones básicas.' },
      { text: 'Interpretar gráficos sencillos para tomar decisiones.' },
    ] }, { style: { fontSize: 20 }, ...anim('slide', 200) }),
    comp('icon', 880, 170, 220, 220, { icon: 'target', bg: true }, anim('zoom', 400)),
    comp('banner', 80, 520, 1040, 100, { title: 'Requisitos', text: 'Manejo básico de computadora. No se necesita experiencia previa con planillas.', icon: 'info', variant: 'info' }, anim('fade', 600)),
  ], { layout: 'summary' });

  const navegar = screen('Cómo navegar el curso', [
    comp('heading', 80, 50, 1040, 70, { text: 'Cómo navegar el curso' }, { style: { fontSize: 40 } }),
    comp('card', 80, 160, 330, 330, { icon: 'menu', title: 'Menú', text: 'Abrí el menú para ver todos los módulos y saltar a cualquier pantalla.' }, anim('slide', 100)),
    comp('card', 435, 160, 330, 330, { icon: 'chart', title: 'Progreso', text: 'La barra superior muestra el porcentaje de pantallas que ya recorriste.' }, anim('slide', 250)),
    comp('card', 790, 160, 330, 330, { icon: 'check-circle', title: 'Guardado automático', text: 'Si salís, al volver el curso continúa en la última pantalla visitada.' }, anim('slide', 400)),
    comp('modal', 80, 530, 280, 54, { buttonText: 'Ver ayuda detallada', title: 'Ayuda de navegación', content: '<p>Usá los botones <strong>Anterior</strong> y <strong>Siguiente</strong> de la parte inferior.</p><p>Algunas pantallas tienen actividades obligatorias: el botón Siguiente se habilita al completarlas.</p>', size: 'md', variant: 'outline' }),
  ], { layout: 'three-columns' });

  const interfaz = screen('Partes de la ventana', [
    comp('heading', 60, 30, 1080, 60, { text: 'Explorá la interfaz' }, { style: { fontSize: 36 } }),
    comp('text', 60, 92, 1080, 40, { text: 'Hacé clic en cada marcador para conocer las partes principales de la ventana.' }, { style: { fontSize: 18, color: '#5d6f63' } }),
    comp('interactiveImage', 60, 145, 1080, 500, { image: a['excel-interfaz.svg'], markers: [
      { x: 18, y: 15, label: 'A', title: 'Cinta de opciones', content: '<p>Agrupa los comandos en pestañas: <strong>Inicio</strong>, Insertar, Fórmulas, Datos…</p>' },
      { x: 4, y: 30, label: 'B', title: 'Cuadro de nombres', content: '<p>Muestra la referencia de la celda activa, por ejemplo <strong>E6</strong>.</p>' },
      { x: 22, y: 30, label: 'C', title: 'Barra de fórmulas', content: '<p>Muestra y permite editar el contenido o la fórmula de la celda activa.</p>' },
      { x: 48, y: 60, label: 'D', title: 'Celda activa', content: '<p>Es la celda seleccionada. Se distingue por su borde resaltado.</p>' },
      { x: 5, y: 96, label: 'E', title: 'Pestañas de hojas', content: '<p>Un libro puede tener varias hojas. Con <strong>+</strong> agregás una nueva.</p>' },
    ] }),
  ], { settings: { requireCompletion: true }, layout: 'fullscreen' });

  const conceptos = screen('Conceptos clave', [
    comp('heading', 80, 40, 1040, 64, { text: 'Conceptos clave' }, { style: { fontSize: 40 } }),
    comp('accordion', 80, 125, 640, 470, { allowMultiple: false, items: [
      { title: 'Libro', content: '<p>Es el archivo completo. Contiene una o más hojas.</p>' },
      { title: 'Hoja', content: '<p>Cada pestaña del libro. Está formada por filas (números) y columnas (letras).</p>' },
      { title: 'Celda', content: '<p>Intersección de una fila y una columna, identificada por su referencia: <strong>B3</strong>.</p>' },
      { title: 'Rango', content: '<p>Conjunto de celdas contiguas, por ejemplo <strong>A1:C5</strong>.</p>' },
    ] }),
    comp('image', 760, 125, 360, 300, { src: a['formula-suma.svg'], fit: 'contain', alt: 'Ejemplo de rango y suma', zoom: true }, { style: { borderRadius: 16 } }),
    comp('tooltip', 760, 450, 360, 80, { text: 'Recordá qué es la', term: 'celda activa', tip: 'La celda seleccionada, donde se escribe al tipear.' }, { style: { fontSize: 18 } }),
  ], { settings: { requireCompletion: true } });

  const resumenId = uid(8);
  const video = screen('Video introductorio', [
    comp('heading', 60, 40, 1080, 60, { text: 'Mirá el video' }, { style: { fontSize: 38 } }),
    comp('video', 60, 120, 720, 405, { src: a['video-ejemplo.mp4'], controls: true }),
    comp('text', 820, 130, 320, 200, { text: 'En este video vas a ver cómo ingresar datos y escribir tu primera fórmula.' }, { style: { fontSize: 19 } }),
    comp('button', 820, 360, 280, 54, { text: 'Mostrar resumen', variant: 'secondary', icon: 'eye' }, { events: [{ trigger: 'click', actions: [{ type: 'toggle', target: resumenId }] }] }),
    { ...comp('banner', 60, 550, 1080, 95, { title: 'Resumen del video', text: 'Para escribir una fórmula, seleccioná la celda, escribí "=" y luego la operación. Presioná Enter para confirmar.', icon: 'lightbulb', variant: 'success' }, { visibility: { hidden: true }, ...anim('slide', 0, 'up') }), id: resumenId },
  ], { layout: 'video-text', height: 675 });
  // la animación del resumen se dispara al mostrarse
  video.components[4].animation!.trigger = 'action';

  const practica1 = screen('Práctica', [
    comp('heading', 80, 40, 1040, 60, { text: 'Comprobá lo aprendido' }, { style: { fontSize: 38 } }),
    comp('question', 190, 130, 820, 500, { question: q('single', '¿Cómo se llama la intersección entre una fila y una columna?', {
      options: [opt('Celda', true), opt('Rango'), opt('Hoja'), opt('Libro')],
      feedbackCorrect: '¡Correcto! Cada celda se identifica por su columna y fila.', feedbackIncorrect: 'No es correcto.', explanation: 'Un rango es un conjunto de celdas; la hoja y el libro son contenedores mayores.', attempts: 2,
    }) }),
  ], { layout: 'questions', height: 700, settings: { requireCompletion: true } });

  /* ---------------- Módulo 2 ---------------- */
  const tipos = screen('Tipos de datos', [
    comp('heading', 80, 40, 1040, 64, { text: 'Tipos de datos' }, { style: { fontSize: 40 } }),
    comp('tabs', 80, 130, 1040, 420, { variant: 'pills', items: [
      { title: 'Texto', content: '<p>Nombres, descripciones o códigos. Se alinean a la <strong>izquierda</strong>.</p><p>Ejemplo: <em>Cuadernos</em>.</p>' },
      { title: 'Números', content: '<p>Valores con los que se puede calcular. Se alinean a la <strong>derecha</strong>.</p><p>Ejemplo: <em>1250,50</em>.</p>' },
      { title: 'Fechas', content: '<p>Internamente son números, por eso se pueden restar para calcular días.</p><p>Ejemplo: <em>15/03/2025</em>.</p>' },
      { title: 'Fórmulas', content: '<p>Comienzan siempre con el signo <strong>=</strong> y devuelven un resultado.</p><p>Ejemplo: <em>=B2*C2</em>.</p>' },
    ] }, anim('fade', 100)),
  ], { settings: { requireCompletion: true } });

  const atajos = screen('Atajos de teclado', [
    comp('heading', 80, 40, 1040, 64, { text: 'Atajos que ahorran tiempo' }, { style: { fontSize: 40 } }),
    comp('text', 80, 105, 1040, 40, { text: 'Hacé clic en cada tarjeta para ver qué hace el atajo.' }, { style: { fontSize: 18 } }),
    comp('flipcards', 80, 160, 1040, 330, { columns: 3, cards: [
      { front: 'Ctrl + C', back: 'Copiar la selección' }, { front: 'Ctrl + V', back: 'Pegar' }, { front: 'Ctrl + Z', back: 'Deshacer la última acción' },
      { front: 'F2', back: 'Editar la celda activa' }, { front: 'Alt + =', back: 'Insertar Autosuma' }, { front: 'F4', back: 'Fijar referencia absoluta ($A$1)' },
    ] }),
    comp('pdf', 80, 520, 600, 110, { src: a['guia-atajos.pdf'], title: 'Guía rápida de atajos (PDF)', display: 'link' }),
  ], { settings: { requireCompletion: true } });

  const audio = screen('Consejo en audio', [
    comp('heading', 80, 40, 1040, 64, { text: 'Un consejo para empezar' }, { style: { fontSize: 40 } }),
    comp('audio', 80, 130, 520, 100, { src: a['consejo-audio.mp3'], title: 'Consejo: ordená tus datos en tablas' }),
    comp('banner', 80, 260, 520, 150, { title: 'Buenas prácticas', text: 'Una fila de encabezados, un dato por celda y sin filas vacías intermedias.', icon: 'check-circle', variant: 'success' }),
    comp('gallery', 640, 130, 480, 420, { columns: 2, images: [
      { src: a['excel-grafico.png'], caption: 'Gráfico' }, { src: a['formula-suma.svg'], caption: 'Fórmula' },
      { src: a['excel-portada.jpg'], caption: 'Planilla' }, { src: a['caso-oficina.svg'], caption: 'En la oficina' },
    ] }),
  ]);

  const primeraFormula = screen('Tu primera fórmula', [
    comp('image', 60, 60, 480, 555, { src: a['formula-suma.svg'], fit: 'contain', alt: 'Suma de un rango' }, { style: { borderRadius: 16, background: '#f3f7f4' } }),
    comp('heading', 590, 90, 550, 70, { text: 'Tu primera fórmula' }, { style: { fontSize: 38 } }),
    comp('richtext', 590, 180, 550, 230, { html: '<p>Toda fórmula empieza con el signo <strong>=</strong>.</p><p>Para sumar las celdas A1 a A5 escribí:</p><p><strong>=SUMA(A1:A5)</strong></p><p>El resultado se actualiza solo cuando cambian los valores.</p>' }, { style: { fontSize: 19 } }),
    comp('tooltip', 590, 430, 550, 60, { text: 'El signo dos puntos indica un', term: 'rango', tip: 'A1:A5 incluye A1, A2, A3, A4 y A5.' }),
    comp('navButton', 590, 520, 220, 54, { text: 'Continuar', target: 'next' }),
  ], { layout: 'image-left' });

  const operadores = screen('Operadores', [
    comp('heading', 80, 40, 1040, 64, { text: 'Operadores aritméticos' }, { style: { fontSize: 40 } }),
    comp('table', 80, 130, 1040, 330, { header: true, striped: true, data: [
      ['Operador', 'Operación', 'Ejemplo', 'Resultado'], ['+', 'Suma', '=5+3', '8'], ['-', 'Resta', '=10-4', '6'],
      ['*', 'Multiplicación', '=6*7', '42'], ['/', 'División', '=20/4', '5'], ['^', 'Potencia', '=2^3', '8'],
    ] }, { style: { fontSize: 18 } }),
    comp('banner', 80, 490, 1040, 100, { title: 'Orden de las operaciones', text: 'Primero potencias, luego multiplicaciones y divisiones, por último sumas y restas. Usá paréntesis para cambiar el orden.', icon: 'alert', variant: 'warning' }),
  ]);

  const fillQ = comp('question', 190, 120, 820, 360, { question: q('fill', 'Completá la fórmula que suma las celdas de A1 a A5.', {
    fillText: 'La fórmula correcta es ={{SUMA|SUM}}(A1{{:}}A5)', feedbackCorrect: '¡Excelente!', feedbackIncorrect: 'Revisá el nombre de la función y el separador del rango.', attempts: 3, explanation: 'La función SUMA recibe un rango indicado con dos puntos.',
  }) });
  const actividad = screen('Actividad: completar', [
    comp('heading', 80, 30, 1040, 64, { text: 'Actividad' }, { style: { fontSize: 38 } }),
    fillQ,
    comp('banner', 190, 500, 820, 90, { title: '¡Bien hecho!', text: 'Completaste la actividad. Ya podés continuar.', icon: 'trophy', variant: 'success' }, { visibility: { condition: { type: 'componentComplete', target: fillQ.id } }, animation: { type: 'bounce', duration: 700, delay: 0, direction: 'up', trigger: 'action' } }),
    comp('navButton', 790, 610, 220, 52, { text: 'Continuar', target: 'next' }, { visibility: { condition: { type: 'screenComplete' } } }),
  ], { height: 690, settings: { requireCompletion: true } });

  const ordenar = screen('Ordenar pasos', [
    comp('heading', 80, 30, 1040, 64, { text: 'Ordená los pasos' }, { style: { fontSize: 38 } }),
    comp('question', 190, 120, 820, 520, { question: q('order', 'Ordená los pasos para calcular un total con Autosuma.', {
      options: [opt('Seleccionar la celda donde va el resultado'), opt('Hacer clic en Autosuma (Σ)'), opt('Verificar el rango propuesto'), opt('Presionar Enter')],
      feedbackCorrect: '¡Perfecto!', feedbackIncorrect: 'El orden no es correcto.', attempts: 2, shuffle: false,
    }) }),
  ], { height: 680, settings: { requireCompletion: true } });

  /* ---------------- Módulo 3 ---------------- */
  const funciones = screen('Funciones esenciales', [
    comp('heading', 80, 40, 1040, 64, { text: 'Funciones esenciales' }, { style: { fontSize: 40 } }),
    comp('card', 80, 140, 330, 380, { icon: 'plus', title: 'SUMA', text: 'Suma todos los valores de un rango.\n=SUMA(B2:B10)' }, anim('slide', 100)),
    comp('card', 435, 140, 330, 380, { icon: 'calculator', title: 'PROMEDIO', text: 'Calcula la media aritmética.\n=PROMEDIO(B2:B10)' }, anim('slide', 250)),
    comp('card', 790, 140, 330, 380, { icon: 'chart', title: 'MAX y MIN', text: 'Devuelven el mayor y el menor valor.\n=MAX(B2:B10)' }, anim('slide', 400)),
    comp('navButton', 80, 560, 280, 52, { text: 'Repasar fórmulas', target: 'screen', targetId: primeraFormula.id, variant: 'outline' }),
  ], { layout: 'cards' });

  const grafico = screen('Leer un gráfico', [
    comp('heading', 60, 30, 1080, 60, { text: 'Leer un gráfico' }, { style: { fontSize: 36 } }),
    comp('hotspots', 160, 110, 880, 495, { image: a['excel-grafico.png'], spots: [
      { x: 54, y: 24, title: 'Valor máximo', content: 'Abril fue el mes con más ventas (90 unidades).' },
      { x: 12, y: 50, title: 'Eje de valores', content: 'Las líneas horizontales ayudan a estimar cada valor.' },
      { x: 72, y: 8, title: 'Leyenda', content: 'Indica qué representa cada color.' },
    ] }),
  ], { settings: { requireCompletion: true } });

  const historia = screen('Historia de las planillas', [
    comp('heading', 80, 40, 1040, 64, { text: 'Un poco de historia' }, { style: { fontSize: 40 } }),
    comp('timeline', 80, 150, 1040, 400, { orientation: 'horizontal', interactive: true, items: [
      { date: '1979', title: 'VisiCalc', content: 'La primera planilla electrónica para computadoras personales.' },
      { date: '1983', title: 'Lotus 1-2-3', content: 'Se convierte en el estándar de las oficinas.' },
      { date: '1985', title: 'Excel', content: 'Aparece la primera versión para Macintosh.' },
      { date: 'Hoy', title: 'En la nube', content: 'Planillas colaborativas y accesibles desde cualquier dispositivo.' },
    ] }),
  ]);

  const caso = screen('Caso práctico', [
    comp('label', 80, 40, 220, 36, { text: 'CASO PRÁCTICO' }),
    comp('heading', 80, 90, 620, 56, { text: 'Los totales de Marta' }, { style: { fontSize: 34 } }),
    comp('text', 80, 160, 620, 160, { text: 'Marta lleva el registro de compras de su área. Cada mes suma a mano los importes y a veces se equivoca. Necesita que la planilla calcule los totales automáticamente.' }, { style: { fontSize: 18 } }),
    comp('reveal', 80, 330, 620, 170, { buttonText: 'Ver sugerencia', hideText: 'Ocultar sugerencia', content: '<p>Usá <strong>=SUMA()</strong> al final de cada columna y <strong>Autosuma</strong> para acelerar el trabajo.</p>' }),
    comp('image', 760, 60, 360, 330, { src: a['caso-oficina.svg'], fit: 'contain', alt: 'Oficina' }),
    comp('question', 80, 520, 1040, 470, { question: q('match', 'Relacioná cada función con su uso.', {
      options: [{ id: uid(6), text: 'SUMA', match: 'Total de compras del mes' }, { id: uid(6), text: 'PROMEDIO', match: 'Gasto típico por compra' }, { id: uid(6), text: 'MAX', match: 'Compra más cara' }],
      feedbackCorrect: '¡Muy bien!', feedbackIncorrect: 'Revisá las relaciones.', attempts: 2,
    }) }),
  ], { layout: 'case-study', height: 1030, settings: { requireCompletion: true } });

  const evalId = uid(10);
  const resumen = screen('Resumen', [
    comp('heading', 80, 50, 1040, 64, { text: 'Resumen del curso' }, { style: { fontSize: 40 } }),
    comp('list', 80, 150, 700, 320, { marker: 'check', items: [
      { text: 'Un libro contiene hojas; las hojas, celdas.' }, { text: 'Las fórmulas comienzan con "=".' },
      { text: 'SUMA, PROMEDIO, MAX y MIN resuelven la mayoría de los cálculos.' }, { text: 'Los gráficos ayudan a comunicar los datos.' },
    ] }, { style: { fontSize: 20 }, ...anim('slide', 100) }),
    comp('icon', 860, 170, 220, 220, { icon: 'award', bg: true }, anim('bounce', 300)),
    comp('navButton', 80, 510, 280, 56, { text: 'Ir a la evaluación', target: 'screen', targetId: evalId }),
  ], { layout: 'summary' });

  const aprobadoId = uid(10);
  const desaprobadoId = uid(10);
  const finalQuiz = {
    ...newQuiz(),
    title: 'Evaluación final',
    intro: 'Respondé las preguntas para aprobar el curso. Necesitás 70% o más.',
    isFinal: true,
    randomize: true,
    attempts: 3,
    passingScore: 70,
    showAnswers: true,
    passScreen: aprobadoId,
    failScreen: desaprobadoId,
    passMessage: '¡Felicitaciones! Aprobaste el curso Excel Básico.',
    failMessage: 'No alcanzaste el 70%. Podés repasar los contenidos e intentarlo nuevamente.',
    questions: [
      q('single', '¿Con qué signo comienza toda fórmula?', { options: [opt('=', true), opt('+'), opt('#'), opt('@')], explanation: 'Las fórmulas siempre comienzan con "=".' }),
      q('truefalse', 'Un rango es un conjunto de celdas contiguas.', { options: [opt('Verdadero', true), opt('Falso')] }),
      q('multiple', '¿Cuáles de estas son funciones de Excel?', { options: [opt('SUMA', true), opt('PROMEDIO', true), opt('CELDA AZUL'), opt('MAX', true)], partialCredit: true }),
      q('fill', 'Completá la función que calcula el promedio.', { fillText: '={{PROMEDIO|AVERAGE}}(B2:B10)' }),
      q('order', 'Ordená de menor a mayor jerarquía.', { options: [opt('Celda'), opt('Hoja'), opt('Libro')], shuffle: false }),
      q('match', 'Relacioná el operador con su operación.', { options: [{ id: uid(6), text: '*', match: 'Multiplicación' }, { id: uid(6), text: '/', match: 'División' }, { id: uid(6), text: '^', match: 'Potencia' }] }),
      q('short', '¿Qué tecla permite editar la celda activa?', { acceptedAnswers: ['F2'] }),
      q('single', 'Según el gráfico, ¿qué mes tuvo más ventas?', { media: { kind: 'image', src: a['excel-grafico.png'] }, options: [opt('Abril', true), opt('Enero'), opt('Junio'), opt('Marzo')] }),
    ],
  };
  const evaluacion: ScreenData = { ...screen('Evaluación final', [comp('quiz', 170, 30, 860, 760, finalQuiz)], { height: 820, layout: 'evaluation', settings: { requireCompletion: true, hideNav: true } }), id: evalId };

  const aprobado: ScreenData = { ...screen('Curso aprobado', [
    comp('background', 0, 0, 1200, 675, { gradient: true }),
    comp('icon', 520, 50, 160, 160, { icon: 'trophy', color: '#76C6E2', bg: false }, anim('bounce', 100)),
    comp('heading', 200, 220, 800, 70, { text: '¡Felicitaciones!' }, { style: { fontSize: 52, color: '#ffffff', textAlign: 'center' }, ...anim('zoom', 300) }),
    comp('score', 300, 310, 600, 200, { title: 'Curso aprobado', text: 'Obtuviste {score}% en la evaluación final. Estado: {status}.' }),
    comp('navButton', 470, 550, 260, 56, { text: 'Volver al inicio', target: 'home', variant: 'secondary' }),
  ], { settings: { hideNav: true } }), id: aprobadoId };

  const desaprobado: ScreenData = { ...screen('Curso no aprobado', [
    comp('icon', 540, 50, 120, 120, { icon: 'retry', bg: true }),
    comp('heading', 200, 190, 800, 70, { text: 'Seguí practicando' }, { style: { fontSize: 46, textAlign: 'center' } }),
    comp('score', 300, 280, 600, 200, { title: 'Resultado', text: 'Obtuviste {score}%. Estado: {status}. Repasá los módulos y consultá a tu tutor.' }),
    comp('navButton', 340, 530, 250, 56, { text: 'Repasar el curso', target: 'home', variant: 'outline' }),
    comp('navButton', 610, 530, 250, 56, { text: 'Ver la evaluación', target: 'screen', targetId: evalId }),
  ], { settings: { hideNav: true } }), id: desaprobadoId };

  const settings = defaultCourseSettings(theme);
  settings.logo = a['logo-ema-servicios.png'] || a['logo-curso.svg'];
  settings.completion = { criteria: 'quiz', visitedPercent: 100 };

  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid(10),
    title: 'Excel Básico',
    description: 'Curso introductorio de planillas de cálculo: interfaz, datos, fórmulas, funciones y gráficos. Incluye actividades interactivas y evaluación final.',
    author: 'EMA Servicios · Capacitación',
    category: 'Ofimática',
    coverImage: a['excel-portada.jpg'],
    duration: '2 horas',
    level: 'Básico',
    language: 'es',
    version: '1.0',
    objectives: ['Reconocer la interfaz de una planilla de cálculo', 'Ingresar y dar formato a datos', 'Crear fórmulas y usar funciones básicas', 'Interpretar gráficos simples'],
    requirements: ['Manejo básico de computadora'],
    status: 'published',
    settings,
    modules: [
      { id: uid(10), title: 'Introducción a Excel', description: '', lessons: [
        { id: uid(10), title: 'Bienvenida', screens: [portada, objetivos, navegar] },
        { id: uid(10), title: 'La interfaz', screens: [interfaz, conceptos, video, practica1] },
      ] },
      { id: uid(10), title: 'Datos y fórmulas', description: '', lessons: [
        { id: uid(10), title: 'Ingresar datos', screens: [tipos, atajos, audio] },
        { id: uid(10), title: 'Fórmulas básicas', screens: [primeraFormula, operadores, actividad, ordenar] },
      ] },
      { id: uid(10), title: 'Funciones y gráficos', description: '', lessons: [
        { id: uid(10), title: 'Funciones', screens: [funciones, grafico, historia, caso, resumen] },
        { id: uid(10), title: 'Evaluación final', screens: [evaluacion, aprobado, desaprobado] },
      ] },
    ],
  };
}

/** Preguntas de ejemplo para el banco */
export function bankQuestions(): Question[] {
  return [
    q('single', '¿Qué función devuelve el valor más alto de un rango?', { options: [opt('MAX', true), opt('MIN'), opt('SUMA'), opt('CONTAR')] }),
    q('truefalse', 'Las fechas se almacenan internamente como números.', { options: [opt('Verdadero', true), opt('Falso')] }),
    q('multiple', '¿Cuáles son operadores aritméticos?', { options: [opt('+', true), opt('*', true), opt('&'), opt('^', true)] }),
    q('fill', 'Completá la referencia absoluta.', { fillText: 'Para fijar la celda A1 se escribe {{$A$1}}' }),
    q('short', '¿Cómo se llama el conjunto de hojas de un archivo?', { acceptedAnswers: ['Libro', 'Libro de trabajo'] }),
    q('order', 'Ordená los pasos para insertar un gráfico.', { options: [opt('Seleccionar los datos'), opt('Ir a Insertar'), opt('Elegir el tipo de gráfico'), opt('Ajustar títulos')], shuffle: false }),
  ];
}
