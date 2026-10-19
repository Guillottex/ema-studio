# EMA Servicios · Estudio e-learning — Autoría con exportación SCORM 1.2

El Estudio e-learning de EMA Servicios (EMA Studio) es una herramienta de autor (*authoring tool*) para crear cursos e-learning de forma visual
—módulos, lecciones y pantallas con layouts, componentes interactivos, animaciones y evaluaciones— y exportarlos
como **paquete SCORM 1.2 (ZIP)** listo para subir a cualquier LMS (Moodle, Canvas, Chamilo, SCORM Cloud, etc.).

- **Editor visual** drag & drop con lienzo idéntico a lo que ve el alumno, guías de alineación, deshacer/rehacer,
  copiar/pegar, edición de texto en el lienzo y vistas Escritorio / Tablet / Celular.
- **16 layouts** y **más de 40 componentes**: textos, multimedia, visuales, interactivos (acordeón, pestañas,
  hotspots, flip cards, carrusel, línea de tiempo…), navegación y evaluaciones.
- **Interacciones** por eventos (clic, hover, al completar) y **condiciones** de visibilidad.
- **Evaluaciones**: 7 tipos de pregunta (+ multimedia), banco de preguntas, evaluación final con puntaje mínimo,
  intentos, tiempo y mensajes de aprobación/desaprobación.
- **SCORM 1.2** con progreso, puntaje, tiempo, `lesson_location`, `suspend_data` y **reanudación**.
- **Simulador de LMS** integrado para probar la comunicación SCORM antes de exportar.
- Proyecto editable **.json**, **versionado**, **plantillas**, **temas**, **biblioteca multimedia**, **modo oscuro**,
  buscador global, roles (Administrador / Autor / Visualizador) y arquitectura preparada para **IA**.

---

## Contenido

1. [Cómo instalar](#1-cómo-instalar)
2. [Cómo levantar Docker](#2-cómo-levantar-docker)
3. [Cómo crear el usuario administrador](#3-cómo-crear-el-usuario-administrador)
4. [Cómo acceder](#4-cómo-acceder)
5. [Cómo crear un curso](#5-cómo-crear-un-curso)
6. [Cómo crear pantallas](#6-cómo-crear-pantallas)
7. [Cómo utilizar el editor](#7-cómo-utilizar-el-editor)
8. [Cómo crear evaluaciones](#8-cómo-crear-evaluaciones)
9. [Cómo previsualizar](#9-cómo-previsualizar)
10. [Cómo exportar SCORM 1.2](#10-cómo-exportar-scorm-12)
11. [Cómo subir el ZIP a un LMS](#11-cómo-subir-el-zip-a-un-lms)
12. [Estructura del proyecto y desarrollo](#estructura-del-proyecto-y-desarrollo)

---

## 1. Cómo instalar

Requisitos: **Docker 24+** con el plugin **docker compose** (Linux, Windows con Docker Desktop/WSL2 o macOS).
No hace falta instalar Node ni PostgreSQL: todo corre en contenedores.

```bash
# 1. Descomprimir el proyecto y entrar a la carpeta
cd ema-studio

# 2. Crear el archivo de configuración
cp .env.example .env
#    Editá .env: JWT_SECRET, POSTGRES_PASSWORD, ADMIN_EMAIL/ADMIN_PASSWORD, APP_PORT, CORS_ORIGIN…
```

Atajo (Linux/macOS/WSL): `./scripts/install.sh` crea el `.env` con secretos aleatorios, construye y levanta todo.

Variables principales del `.env`:

| Variable | Descripción |
|---|---|
| `APP_PORT` | Puerto público (por defecto 8080) |
| `JWT_SECRET` | Secreto de firma de sesiones (obligatorio cambiarlo) |
| `POSTGRES_*` | Base de datos |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador inicial |
| `CORS_ORIGIN` | Orígenes permitidos |
| `SEED_DEMO` | Carga el curso demo “Excel Básico” |
| `MAX_UPLOAD_MB`, `MAX_IMAGE_MB`, `IMAGE_MAX_WIDTH` | Límites de archivos |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | IA opcional (`anthropic` u `openai`) |

## 2. Cómo levantar Docker

```bash
docker compose up -d
```

La primera vez construye las imágenes (2–4 minutos). Se levantan tres servicios:

| Servicio | Descripción |
|---|---|
| `db` | PostgreSQL 16 (volumen `db_data`) |
| `backend` | API Node.js/Express. Al iniciar **aplica las migraciones** y **carga los datos iniciales** |
| `frontend` | Nginx con la aplicación React; publica el puerto `APP_PORT` y hace de proxy a `/api` |

Comandos útiles:

```bash
docker compose ps                 # estado
docker compose logs -f backend    # logs de la API
docker compose down               # detener (los datos quedan en los volúmenes)
docker compose up -d --build      # reconstruir tras cambios
./scripts/migrate.sh              # aplicar migraciones manualmente
./scripts/seed.sh                 # recargar datos iniciales (idempotente)
./scripts/backup.sh               # respaldo de base de datos y archivos
```

Los archivos subidos y los ZIP exportados se guardan en el volumen `app_data` (`/data` en el contenedor).

## 3. Cómo crear el usuario administrador

Al primer arranque se crea automáticamente el administrador definido en `.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, por defecto `admin@ema.local` / `Admin123!`).

Para crear otro administrador o restablecer una contraseña:

```bash
./scripts/create-admin.sh admin@miempresa.com 'ClaveSegura123' "Nombre Apellido"
# equivalente:
docker compose exec backend node dist/create-admin.js admin@miempresa.com 'ClaveSegura123' "Nombre Apellido"
```

Después, desde **Usuarios** el administrador puede crear Autores y Visualizadores.

| Rol | Puede |
|---|---|
| Administrador | Todo: usuarios, cursos, publicar, exportar SCORM, plantillas, categorías, configuración |
| Autor | Crear y editar cursos, contenidos, preguntas, temas y exportar |
| Visualizador | Ver cursos y previsualizarlos |

## 4. Cómo acceder

Abrí **http://localhost:8080** (o el `APP_PORT` configurado) e ingresá con el administrador.
La documentación interactiva de la API está en **http://localhost:8080/api/docs**.

El sistema incluye datos de demostración: el curso **Excel Básico** (3 módulos, 22 pantallas, video, audio, PDF,
interactivos, actividades, evaluación final con pantallas de aprobación y desaprobación), 6 plantillas de curso,
plantillas de pantalla, 6 temas y un banco de preguntas.

## 5. Cómo crear un curso

1. **Cursos → Nuevo curso** (o el botón del Dashboard).
2. Completá: nombre, descripción, autor, categoría, imagen de portada, duración, nivel, idioma, versión,
   objetivos, requisitos y estado (Borrador/Publicado).
3. Elegí un **tema** y si querés empezar **en blanco** o desde una **plantilla** (corporativo, académico,
   inducción, seguridad, capacitación, procedimientos).
4. Se abre el editor. En **⚙ Configuración del curso** podés ajustar colores, tipografías, botones, logo,
   barra de progreso, menú, navegación libre o lineal, criterio de finalización y reanudación.

Otras formas de crear cursos:

- **Duplicar** un curso existente.
- **Importar proyecto (.json)** exportado previamente (incluye los recursos multimedia).
- **Generar con IA**: “Crear estructura (sin IA)” genera módulos/lecciones/pantallas editables a partir de una
  descripción; con `AI_PROVIDER` configurado genera textos, actividades y evaluación final.
- **Importar contenido** desde `.txt`, `.md`, `.docx` o `.pdf` (`#` módulo, `##` lección, `###` pantalla, `-` viñetas).

## 6. Cómo crear pantallas

La estructura es **Curso → Módulos → Lecciones → Pantallas** y se gestiona en el panel **Estructura** del editor:

- **+ Módulo**, **+ Agregar lección**, **+ Agregar pantalla** (elegís uno de los 16 layouts o una plantilla).
- Clic derecho o “⋯” sobre un elemento: renombrar, duplicar, eliminar, insertar pantalla después.
- **Arrastrá y soltá** módulos, lecciones y pantallas para reordenarlos o moverlos entre lecciones/módulos.
- En el panel **Layouts** podés aplicar otro layout a la pantalla actual (y deshacer con Ctrl+Z).
- Desde las propiedades de la pantalla: título, alto (para pantallas con scroll), fondo, “exigir completar las
  actividades”, ocultar la barra de navegación y **Guardar como plantilla** (“Mis plantillas”).

## 7. Cómo utilizar el editor

```
┌ Barra: deshacer/rehacer · Escritorio/Tablet/Celular · zoom · cuadrícula · imán · Previsualizar · Validar · Exportar ┐
│ Estructura / Componentes / Layouts │            LIENZO (pantalla)            │   PROPIEDADES   │
```

- **Agregar componentes**: arrastralos desde **Componentes** al lienzo (o clic para agregarlos al centro).
- **Mover / redimensionar**: arrastrá el componente o sus manijas. Guías magnéticas al centro y bordes
  (Alt desactiva el imán; Shift mantiene la proporción). Flechas mueven 1 px (Shift: 10 px).
- **Selección múltiple**: Shift + clic o arrastrando un recuadro. Alinear y distribuir desde Propiedades.
- **Editar texto en el lienzo**: doble clic sobre títulos, textos, etiquetas y botones.
- **Copiar/pegar/duplicar/eliminar**: Ctrl+C / Ctrl+V / Ctrl+D / Supr, o clic derecho (también capas y bloqueo).
- **Propiedades** (panel derecho), por pestañas:
  - *Contenido*: los campos del componente (textos, imágenes, listas, preguntas…).
  - *Estilo*: fuente, tamaño, color, alineación, fondo, márgenes, bordes, sombra, opacidad, rotación, posición.
  - *Animación*: fade, slide, zoom, bounce, aparecer y desplazamiento; duración, retraso, dirección y activación.
  - *Interacción*: eventos (clic, hover, al completar) con acciones (mostrar/ocultar, abrir ventana, ir a pantalla,
    reproducir audio/video, mensaje, animación, completar, variables) y **condiciones** de visibilidad
    (ej.: “mostrar el botón Siguiente sólo cuando se completó la actividad”).
  - *Responsive*: ocultar por dispositivo.
- **Responsive**: en Tablet/Celular el diseño es automático; con **Personalizar para tablet/celular** se crean
  posiciones propias para ese dispositivo sin afectar el escritorio.
- **Guardado automático**: indica “Guardando…”, “Guardado · Último guardado: 14:32”. Si el navegador se cierra
  con cambios pendientes, se intentan enviar y además quedan respaldados localmente para recuperarlos al volver.
- **Versiones** (🕘): crear versión (1.0 → 1.1 → 2.0), restaurar (con respaldo automático) o duplicar como curso nuevo.
- **Exportar → proyecto editable (.json)**: copia de seguridad/transferencia del curso para seguir editándolo.

## 8. Cómo crear evaluaciones

- **Pregunta suelta** (paleta *Evaluación*): opción múltiple, verdadero/falso, selección múltiple, ordenar,
  relacionar, completar espacios (`{{respuesta|alternativa}}`) y respuesta corta; cada una con imagen, audio o video,
  puntaje, feedback, explicación, intentos, aleatorización y tiempo límite.
- **Evaluación** (componente o layout *Evaluación*): preguntas propias o tomadas del **banco**, cantidad a mostrar,
  orden aleatorio, puntaje mínimo (%), intentos, tiempo máximo, mostrar respuestas/resultado, mensajes de aprobación
  y desaprobación, y pantallas de destino al aprobar/desaprobar.
- Marcá **“Evaluación final del curso”** para que el puntaje se reporte al LMS (`cmi.core.score.raw`) y defina
  `passed/failed`. En Configuración → *Finalización* elegí el criterio: pantallas vistas, evaluación final o ambas.
- **Preguntas** (menú lateral): banco reutilizable con categorías y evaluaciones armadas que se cargan desde el editor.
- El componente **Resultado del curso** muestra el puntaje y estado final (`{score}`, `{status}`).

## 9. Cómo previsualizar

- **Previsualizar curso**: abre exactamente el paquete que se exportará, ejecutándose dentro de un **simulador de LMS
  SCORM 1.2**. Podés cambiar entre **Escritorio / Tablet / Celular** y ver en vivo: estado, puntaje, progreso, tiempo,
  `lesson_location`, `suspend_data`, interacciones y el registro de llamadas a la API.
- **Finalizar sesión y reabrir** cierra la sesión (LMSFinish) y vuelve a abrir el curso para comprobar la
  **reanudación** (“¿Continuar donde lo dejaste?”). **Reiniciar intento** borra los datos simulados.
- **Previsualizar pantalla** (ojo de la barra o propiedades de la pantalla) abre sólo la pantalla actual.

## 10. Cómo exportar SCORM 1.2

1. **Validar** (opcional): muestra ✅ correcto / ⚠️ advertencias / ❌ errores sobre manifest, identificadores,
   recursos y archivos faltantes, links, pantallas vacías, preguntas sin respuesta correcta y navegación.
   Hacé clic en un problema para ir a la pantalla.
2. **Exportar → Exportar SCORM 1.2 (.zip)** → **Exportar SCORM 1.2**. Se ejecutan los 10 pasos (validaciones,
   generación de archivos, `imsmanifest.xml`, JavaScript SCORM y empaquetado). Si hay errores se muestran y no se
   genera el ZIP.
3. Se descarga `nombre-del-curso-scorm12.zip`. El historial de exportaciones queda disponible para volver a descargar.

Contenido del ZIP:

```
imsmanifest.xml      Manifest SCORM 1.2 (1 SCO, masteryscore si hay evaluación final)
index.html           Punto de entrada del curso
js/                  player.js, course-data.js (curso en JSON), boot.js
css/                 player.css, fonts.css
scorm/               scorm12.js (comunicación con la API del LMS)
assets/fonts/        tipografías embebidas (funciona offline)
images/  media/      imágenes, videos MP4, audios MP3, PDF
```

## 11. Cómo subir el ZIP a un LMS

Subí el ZIP **sin descomprimirlo**.

- **Moodle**: en el curso, *Activar edición → Agregar una actividad o recurso → Paquete SCORM* → arrastrá el ZIP →
  en *Calificación* usá “Calificación más alta” y en *Gestión de intentos* habilitá “Mostrar estado de intentos”.
  Guardá y abrí la actividad.
- **Chamilo**: *Lecciones → Importar SCORM*.
- **Canvas / Blackboard / otros**: buscá “Importar paquete SCORM” o “SCORM 1.2” en el gestor de contenidos.
- **Prueba rápida**: [SCORM Cloud](https://cloud.scorm.com) permite verificar el paquete gratuitamente.

El curso informa al LMS: estado (`incomplete` → `completed`/`passed`/`failed`), puntaje, tiempo de sesión,
ubicación y datos de reanudación. Al volver a ingresar, el alumno continúa desde la última pantalla.

---

## Identidad visual EMA Servicios

La aplicación y los cursos usan la identidad de [www.emaservicios.com.ar](https://www.emaservicios.com.ar):

| Elemento | Valor |
|---|---|
| Azul marino (principal) | `#282964` |
| Celeste (acento) | `#76C6E2` |
| Azul intenso | `#1E2D8A` |
| Texto | `#3F3F3F` · fondos `#EEF8FC` / `#EEEFF0` |
| Tipografías | **Outfit** (títulos) y **Poppins** (textos), embebidas también en los SCORM |
| Botones | Píldora (redondeados), principales en mayúsculas |

- El tema **“EMA Servicios”** es el predeterminado para cursos nuevos, el curso demo y las plantillas corporativa y de capacitación.
- **Logo**: al construir la imagen del frontend se descarga `logo-color.png` y el favicon del sitio (`scripts/fetch-brand.mjs`);
  al cargar los datos iniciales el backend agrega el logo a la biblioteca y lo usa en el curso demo (`BRAND_LOGO_URL`).
  Sin conexión se usa un logotipo tipográfico equivalente. Para desarrollo local: `./scripts/fetch-brand.sh`.
- Para usar otro archivo de logo: reemplazá `frontend/public/brand/logo-color.png` y, en cada curso,
  *Configuración del curso → Apariencia → Logo*.

## Estructura del proyecto y desarrollo

```
/frontend       React + TypeScript + Vite + Tailwind (aplicación de autoría)
/backend        Node.js + Express + PostgreSQL (API REST, JWT, roles, exportación)
/scorm-engine   Motor compartido: esquema JSON, componentes, layouts, temas, player, SCORM 1.2, validador
/database       migrations/*.sql y seed-media/ (recursos del curso demo)
/docker         Dockerfiles y configuración de nginx
/docs           ARCHITECTURE.md, API.md, openapi.yaml
/scripts        install, create-admin, migrate, seed, backup, dev
docker-compose.yml · .env.example · README.md
```

Detalles técnicos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API: [docs/API.md](docs/API.md).

### Desarrollo local sin Docker

Requisitos: Node 20+ y PostgreSQL.

```bash
createdb ema_studio
(cd scorm-engine && npm install && npm run build)
(cd backend && npm install && DATABASE_URL=postgres://usuario:clave@localhost:5432/ema_studio npm run dev)   # :4000
(cd frontend && npm install && npm run dev)                                                              # :5173
```

Comprobaciones: `npm run typecheck` en cada paquete; `npm run build` en `scorm-engine` genera `dist/`
(player, CSS y fuentes que se copian en cada ZIP).

### Seguridad

Contraseñas con bcrypt, JWT con expiración, permisos por rol en cada endpoint, validación de entradas (zod),
sanitización del HTML enriquecido, verificación de extensión **y firma binaria** de archivos, SVG saneados,
límites de tamaño, rate limiting en el login, cabeceras de seguridad (helmet) y CORS configurable.
En producción: cambiá `JWT_SECRET` y las contraseñas, y publicá detrás de HTTPS.
