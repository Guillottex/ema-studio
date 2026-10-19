# Arquitectura de EMA Studio

## Módulos

```
ema-studio/
├── scorm-engine/   Motor compartido (TypeScript, sin dependencias de framework)
│   ├── src/types.ts            Esquema JSON del curso (contrato único)
│   ├── src/registry/           Registro de componentes (definición + campos + renderizado)
│   ├── src/layouts.ts          16 layouts predefinidos
│   ├── src/themes.ts           Temas, fuentes embebidas y variables CSS
│   ├── src/assessment/         Calificación, vista de preguntas, fábricas
│   ├── src/render/stage.ts     Reglas de escenario (absoluto/flujo, responsive)
│   ├── src/runtime/            Player del alumno, SCORM 1.2 (API), seguimiento y reanudación
│   ├── src/validate.ts         Validador de contenido
│   ├── src/export.ts           Plan del paquete: imsmanifest.xml, index.html, datos, archivos
│   └── src/css/player.css      Estilos únicos del curso (editor, preview y SCORM)
├── backend/        API REST (Express + PostgreSQL)
├── frontend/       Aplicación de autoría (React + Vite + Tailwind)
├── database/       Migraciones SQL y medios del curso demo
├── docker/         Dockerfiles y nginx
└── docs/           Documentación (API, OpenAPI, arquitectura)
```

### Un solo renderizador = "lo que ves es lo que obtiene el alumno"

El editor, la previsualización y el paquete SCORM usan **las mismas funciones de renderizado** (`renderInner` del
registro de componentes) y la **misma hoja de estilos** (`player.css`). El editor sólo agrega una capa de selección,
arrastre y redimensionado. Por eso la pantalla que se diseña es prácticamente idéntica a la que verá el alumno.

### Contenido basado en JSON

Cada pantalla es un objeto `ScreenData` con una lista de `ComponentData`:

```json
{
  "id": "k3j2h1g9f8", "title": "Introducción", "layout": "two-columns", "height": 675,
  "settings": { "requireCompletion": true },
  "components": [
    { "id": "a1b2c3d4", "type": "heading", "props": { "text": "Introducción" },
      "style": { "fontSize": 32, "textAlign": "left" },
      "layout": { "desktop": { "x": 80, "y": 40, "w": 1040, "h": 70 }, "mobile": { "x": 16, "y": 20, "w": 343, "h": 60 } },
      "animation": { "type": "fade", "duration": 600, "delay": 0, "direction": "up", "trigger": "load" },
      "events": [], "visibility": { "hidden": false } }
  ]
}
```

En la base de datos los componentes se guardan en `screen_components` con `type` (texto) y `props/style/layout/events`
en JSONB: **agregar un tipo de componente nuevo no requiere migraciones**.

### Agregar un componente nuevo

1. Crear un `ComponentDef` (ver `scorm-engine/src/registry/components/*.ts`): `type`, `label`, `category`, `icon`,
   `defaultSize`, `defaultProps`, `fields` (definen el panel de propiedades automáticamente), `render(comp, ctx)`.
2. Sumarlo a `COMPONENTS` en `registry/index.ts` (o llamar a `registerComponent`).
3. Agregar estilos en `player.css`.

El editor (paleta + propiedades), el validador, el player y la exportación SCORM lo toman sin más cambios.

## Responsive

- Diseño base: escenario de **1200 px** de ancho (alto configurable por pantalla).
- **Tablet**: automático (se escala el diseño de escritorio) o personalizado (cajas propias de 768 px).
- **Celular**: automático (los componentes se apilan en orden de lectura, con tipografías reducidas) o personalizado
  (cajas propias de 375 px). Cada componente puede ocultarse por dispositivo.
- El player elige el breakpoint según el ancho de la ventana (<640 celular, <1024 tablet).

## SCORM 1.2

- Un único SCO (`index.html`) con `imsmanifest.xml` (ADL SCORM 1.2, `adlcp:masteryscore` si hay evaluación final).
- `scorm/scorm12.js` busca la API del LMS (`window.API` en la cadena de ventanas) y, si no la encuentra, funciona en
  modo local (localStorage) para poder abrir el curso sin LMS.
- Datos reportados: `cmi.core.lesson_status`, `score.raw/min/max`, `session_time`, `lesson_location` (`M2-L3-P7`),
  `cmi.suspend_data` (JSON compacto ≤ 4096 caracteres: pantalla actual, pantallas vistas en rangos, actividades
  completadas, estados de componentes, variables, resultado final), `cmi.core.exit=suspend` y `cmi.interactions.n.*`.
- Reanudación: al volver, el curso pregunta “¿Continuar donde lo dejaste?” y abre la pantalla exacta.
- Todo el contenido (fuentes, íconos, imágenes, videos, audio, PDF) viaja dentro del ZIP; sólo los videos de
  YouTube/Vimeo requieren Internet (el validador lo advierte).

## Backend

- Express + `pg`, validación con `zod`, sanitización HTML con `sanitize-html` (sólo en campos de texto enriquecido,
  según la definición del registro), JWT, control de permisos por rol, `helmet`, CORS configurable, límites de subida,
  verificación de firma binaria de archivos, optimización de imágenes con `sharp` (redimensión, recompresión y miniaturas).
- Versionado: `course_versions` guarda snapshots JSON completos; restaurar crea antes un respaldo automático.
- Exportación: `planScormPackage()` (motor) → validación de manifest y archivos → ZIP con `archiver`.

## IA (preparada)

`backend/src/services/ai/` define la interfaz `AIProvider` (`generateCourse`, `generateQuestions`, `summarize`),
un proveedor LLM (Anthropic u OpenAI-compatible, por variables de entorno) y el conversor `outlineToDoc()` que
transforma la estructura generada en un curso editable. Sin IA configurada siguen disponibles el **generador de
estructura** y la **importación de contenido** (txt, md, docx, pdf).
