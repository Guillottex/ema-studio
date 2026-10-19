# API REST — EMA Studio

Base: `/api` · Autenticación: `Authorization: Bearer <JWT>` (obtenido con `POST /api/auth/login`).
Documentación interactiva (Swagger UI): **`/api/docs`** · Especificación: [`openapi.yaml`](openapi.yaml).

Errores: `{ "error": "mensaje", "details": [...] }` — 400 validación, 401 no autenticado, 403 sin permisos, 404, 409 conflicto/en uso, 413 tamaño, 422 curso con errores al exportar, 500.

## Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Iniciar sesión (devuelve JWT) (público) |
| `GET` | `/api/auth/me` | Usuario actual |
| `PUT` | `/api/auth/preferences` | Guardar preferencias (tema claro/oscuro) |
| `POST` | `/api/auth/password` | Cambiar contraseña |

## Dashboard

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/dashboard` | Estadísticas y últimos cursos |

## Búsqueda

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/search?q=` | Buscador global (cursos, módulos, lecciones, pantallas, plantillas, recursos, preguntas) |

## Cursos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/courses?q=&status=&category=` | Listar cursos |
| `POST` | `/api/courses` | Crear curso (en blanco o desde plantilla: templateId) |
| `GET` | `/api/courses/{id}` | Detalle del curso + configuración |
| `PATCH` | `/api/courses/{id}` | Actualizar metadatos (título, descripción, estado, etc.) |
| `DELETE` | `/api/courses/{id}` | Eliminar curso |
| `PUT` | `/api/courses/{id}/settings` | Configuración: tema, navegación, finalización, reanudación, logo |
| `POST` | `/api/courses/{id}/duplicate` | Duplicar curso |
| `GET` | `/api/courses/{id}/tree` | Árbol módulos/lecciones/pantallas |
| `GET` | `/api/courses/{id}/doc` | Documento JSON completo del curso |
| `PUT` | `/api/courses/{id}/structure` | Reordenar / mover (drag & drop del árbol) |

## Proyecto editable

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/courses/{id}/export-json?media=` | Descargar proyecto .json (media=0 para no embeber recursos) |
| `POST` | `/api/courses/import` | Importar proyecto .json (multipart: file) |

## SCORM

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/courses/{id}/validate` | Validar curso y paquete SCORM |
| `POST` | `/api/courses/{id}/export-scorm` | Generar ZIP SCORM 1.2 (422 si hay errores) |
| `GET` | `/api/courses/{id}/exports` | Historial de exportaciones |
| `GET` | `/api/exports/{exportId}/download` | Descargar ZIP |
| `DELETE` | `/api/exports/{exportId}` | Eliminar exportación |
| `POST` | `/api/courses/{id}/preview-token` | Token de previsualización (paquete servido al vuelo) |
| `GET` | `/api/preview/{token}/index.html` | Paquete de previsualización (token en la URL) (público) |

## Versiones

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/courses/{id}/versions` | Listar versiones |
| `POST` | `/api/courses/{id}/versions` | Crear versión (bump minor|major|custom|current) |
| `GET` | `/api/versions/{versionId}` | Ver snapshot |
| `POST` | `/api/versions/{versionId}/restore` | Restaurar versión (con respaldo automático) |
| `POST` | `/api/versions/{versionId}/duplicate` | Crear curso nuevo desde una versión |
| `DELETE` | `/api/versions/{versionId}` | Eliminar versión |

## Estructura

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/courses/{id}/modules` | Crear módulo |
| `PATCH` | `/api/modules/{moduleId}` | Renombrar módulo |
| `DELETE` | `/api/modules/{moduleId}` | Eliminar módulo |
| `POST` | `/api/modules/{moduleId}/duplicate` | Duplicar módulo |
| `POST` | `/api/modules/{moduleId}/lessons` | Crear lección |
| `PATCH` | `/api/lessons/{lessonId}` | Renombrar lección |
| `DELETE` | `/api/lessons/{lessonId}` | Eliminar lección |
| `POST` | `/api/lessons/{lessonId}/duplicate` | Duplicar lección |
| `POST` | `/api/lessons/{lessonId}/screens` | Crear pantalla (layout o templateId) |

## Pantallas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/screens/{screenId}` | Pantalla con componentes (JSON) |
| `PUT` | `/api/screens/{screenId}` | Guardado completo (auto-guardado del editor) |
| `PATCH` | `/api/screens/{screenId}` | Renombrar pantalla |
| `DELETE` | `/api/screens/{screenId}` | Eliminar pantalla |
| `POST` | `/api/screens/{screenId}/duplicate` | Duplicar pantalla |

## Plantillas y layouts

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/layouts` | Layouts predefinidos (16) |
| `GET` | `/api/templates?kind=` | Listar plantillas (kind=course|screen) |
| `GET` | `/api/templates/{templateId}` | Ver plantilla |
| `POST` | `/api/templates/from-screen` | Guardar pantalla como plantilla |
| `POST` | `/api/templates/from-course` | Guardar curso como plantilla (admin) |
| `PATCH` | `/api/templates/{templateId}` | Renombrar plantilla |
| `POST` | `/api/templates/{templateId}/duplicate` | Duplicar plantilla |
| `DELETE` | `/api/templates/{templateId}` | Eliminar plantilla |

## Temas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/themes` | Listar temas |
| `POST` | `/api/themes` | Crear tema |
| `PUT` | `/api/themes/{themeId}` | Actualizar tema personalizado |
| `DELETE` | `/api/themes/{themeId}` | Eliminar tema personalizado |

## Biblioteca multimedia

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/media?q=&kind=` | Listar recursos (con uso) |
| `POST` | `/api/media` | Subir archivos (multipart: files) JPG PNG SVG WEBP GIF MP4 MP3 PDF |
| `PATCH` | `/api/media/{mediaId}` | Renombrar recurso |
| `DELETE` | `/api/media/{mediaId}?force=` | Eliminar recurso (409 si está en uso; force=1 para forzar) |

## Preguntas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/questions?q=&type=&category=` | Banco de preguntas |
| `POST` | `/api/questions` | Crear pregunta |
| `GET` | `/api/questions/{questionId}` | Ver pregunta |
| `PUT` | `/api/questions/{questionId}` | Actualizar pregunta |
| `POST` | `/api/questions/{questionId}/duplicate` | Duplicar pregunta |
| `DELETE` | `/api/questions/{questionId}` | Eliminar pregunta |
| `GET` | `/api/quizzes` | Evaluaciones del banco |
| `POST` | `/api/quizzes` | Crear evaluación |
| `GET` | `/api/quizzes/{quizId}` | Ver evaluación con preguntas |
| `PUT` | `/api/quizzes/{quizId}` | Actualizar evaluación |
| `POST` | `/api/quizzes/{quizId}/duplicate` | Duplicar evaluación |
| `DELETE` | `/api/quizzes/{quizId}` | Eliminar evaluación |

## Categorías

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/categories` | Listar categorías |
| `POST` | `/api/categories` | Crear categoría |
| `PATCH` | `/api/categories/{categoryId}` | Actualizar categoría |
| `DELETE` | `/api/categories/{categoryId}` | Eliminar categoría |

## Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/users` | Listar usuarios (admin) |
| `GET` | `/api/users/roles` | Roles y permisos |
| `POST` | `/api/users` | Crear usuario (admin) |
| `PATCH` | `/api/users/{userId}` | Editar usuario (admin) |
| `DELETE` | `/api/users/{userId}` | Eliminar usuario (admin) |

## Configuración

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/settings` | Configuración general y límites |
| `PUT` | `/api/settings` | Guardar configuración de la organización (admin) |

## IA (preparado)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/ai/status` | Estado del proveedor de IA |
| `POST` | `/api/ai/generate-course` | Generar curso (mode ai | structure) |
| `POST` | `/api/ai/import-content` | Crear curso desde txt/md/docx/pdf o texto (multipart) |
| `POST` | `/api/ai/questions` | Generar preguntas a partir de un texto (requiere IA) |
| `POST` | `/api/ai/summarize` | Resumir contenido (requiere IA) |

## Sistema

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio (público) |
