#!/usr/bin/env python3
"""Genera docs/openapi.yaml y docs/API.md a partir de la tabla de endpoints. Uso: python3 scripts/gen-api-docs.py"""
import json, re, os
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EPS = [
 ("Autenticación","post","/auth/login","Iniciar sesión (devuelve JWT)",False,'{"email":"admin@ema.local","password":"Admin123!"}'),
 ("Autenticación","get","/auth/me","Usuario actual",True,None),
 ("Autenticación","put","/auth/preferences","Guardar preferencias (tema claro/oscuro)",True,'{"theme":"dark"}'),
 ("Autenticación","post","/auth/password","Cambiar contraseña",True,'{"current":"...","next":"..."}'),
 ("Dashboard","get","/dashboard","Estadísticas y últimos cursos",True,None),
 ("Búsqueda","get","/search?q=","Buscador global (cursos, módulos, lecciones, pantallas, plantillas, recursos, preguntas)",True,None),
 ("Cursos","get","/courses?q=&status=&category=","Listar cursos",True,None),
 ("Cursos","post","/courses","Crear curso (en blanco o desde plantilla: templateId)",True,'{"title":"Mi curso","categoryId":1}'),
 ("Cursos","get","/courses/{id}","Detalle del curso + configuración",True,None),
 ("Cursos","patch","/courses/{id}","Actualizar metadatos (título, descripción, estado, etc.)",True,'{"status":"published"}'),
 ("Cursos","delete","/courses/{id}","Eliminar curso",True,None),
 ("Cursos","put","/courses/{id}/settings","Configuración: tema, navegación, finalización, reanudación, logo",True,'{"navigation":{"mode":"linear"}}'),
 ("Cursos","post","/courses/{id}/duplicate","Duplicar curso",True,None),
 ("Cursos","get","/courses/{id}/tree","Árbol módulos/lecciones/pantallas",True,None),
 ("Cursos","get","/courses/{id}/doc","Documento JSON completo del curso",True,None),
 ("Cursos","put","/courses/{id}/structure","Reordenar / mover (drag & drop del árbol)",True,'{"modules":[{"id":"m1","lessons":[{"id":"l1","screens":["s1","s2"]}]}]}'),
 ("Proyecto editable","get","/courses/{id}/export-json?media=","Descargar proyecto .json (media=0 para no embeber recursos)",True,None),
 ("Proyecto editable","post","/courses/import","Importar proyecto .json (multipart: file)",True,None),
 ("SCORM","post","/courses/{id}/validate","Validar curso y paquete SCORM",True,None),
 ("SCORM","post","/courses/{id}/export-scorm","Generar ZIP SCORM 1.2 (422 si hay errores)",True,None),
 ("SCORM","get","/courses/{id}/exports","Historial de exportaciones",True,None),
 ("SCORM","get","/exports/{exportId}/download","Descargar ZIP",True,None),
 ("SCORM","delete","/exports/{exportId}","Eliminar exportación",True,None),
 ("SCORM","post","/courses/{id}/preview-token","Token de previsualización (paquete servido al vuelo)",True,None),
 ("SCORM","get","/preview/{token}/index.html","Paquete de previsualización (token en la URL)",False,None),
 ("Versiones","get","/courses/{id}/versions","Listar versiones",True,None),
 ("Versiones","post","/courses/{id}/versions","Crear versión (bump minor|major|custom|current)",True,'{"bump":"minor","notes":"Revisión"}'),
 ("Versiones","get","/versions/{versionId}","Ver snapshot",True,None),
 ("Versiones","post","/versions/{versionId}/restore","Restaurar versión (con respaldo automático)",True,None),
 ("Versiones","post","/versions/{versionId}/duplicate","Crear curso nuevo desde una versión",True,None),
 ("Versiones","delete","/versions/{versionId}","Eliminar versión",True,None),
 ("Estructura","post","/courses/{id}/modules","Crear módulo",True,'{"title":"Módulo 2"}'),
 ("Estructura","patch","/modules/{moduleId}","Renombrar módulo",True,'{"title":"Nuevo nombre"}'),
 ("Estructura","delete","/modules/{moduleId}","Eliminar módulo",True,None),
 ("Estructura","post","/modules/{moduleId}/duplicate","Duplicar módulo",True,None),
 ("Estructura","post","/modules/{moduleId}/lessons","Crear lección",True,'{"title":"Lección 2"}'),
 ("Estructura","patch","/lessons/{lessonId}","Renombrar lección",True,'{"title":"..."}'),
 ("Estructura","delete","/lessons/{lessonId}","Eliminar lección",True,None),
 ("Estructura","post","/lessons/{lessonId}/duplicate","Duplicar lección",True,None),
 ("Estructura","post","/lessons/{lessonId}/screens","Crear pantalla (layout o templateId)",True,'{"title":"Nueva","layout":"two-columns"}'),
 ("Pantallas","get","/screens/{screenId}","Pantalla con componentes (JSON)",True,None),
 ("Pantallas","put","/screens/{screenId}","Guardado completo (auto-guardado del editor)",True,'{"title":"...","height":675,"background":{},"settings":{},"tabletMode":"auto","mobileMode":"auto","components":[]}'),
 ("Pantallas","patch","/screens/{screenId}","Renombrar pantalla",True,'{"title":"..."}'),
 ("Pantallas","delete","/screens/{screenId}","Eliminar pantalla",True,None),
 ("Pantallas","post","/screens/{screenId}/duplicate","Duplicar pantalla",True,None),
 ("Plantillas y layouts","get","/layouts","Layouts predefinidos (16)",True,None),
 ("Plantillas y layouts","get","/templates?kind=","Listar plantillas (kind=course|screen)",True,None),
 ("Plantillas y layouts","get","/templates/{templateId}","Ver plantilla",True,None),
 ("Plantillas y layouts","post","/templates/from-screen","Guardar pantalla como plantilla",True,'{"screenId":"...","name":"Mi plantilla"}'),
 ("Plantillas y layouts","post","/templates/from-course","Guardar curso como plantilla (admin)",True,'{"courseId":"...","name":"..."}'),
 ("Plantillas y layouts","patch","/templates/{templateId}","Renombrar plantilla",True,'{"name":"..."}'),
 ("Plantillas y layouts","post","/templates/{templateId}/duplicate","Duplicar plantilla",True,None),
 ("Plantillas y layouts","delete","/templates/{templateId}","Eliminar plantilla",True,None),
 ("Temas","get","/themes","Listar temas",True,None),
 ("Temas","post","/themes","Crear tema",True,'{"name":"Mi tema","data":{"colors":{"primary":"#0055aa"}}}'),
 ("Temas","put","/themes/{themeId}","Actualizar tema personalizado",True,'{"name":"...","data":{}}'),
 ("Temas","delete","/themes/{themeId}","Eliminar tema personalizado",True,None),
 ("Biblioteca multimedia","get","/media?q=&kind=","Listar recursos (con uso)",True,None),
 ("Biblioteca multimedia","post","/media","Subir archivos (multipart: files) JPG PNG SVG WEBP GIF MP4 MP3 PDF",True,None),
 ("Biblioteca multimedia","patch","/media/{mediaId}","Renombrar recurso",True,'{"name":"..."}'),
 ("Biblioteca multimedia","delete","/media/{mediaId}?force=","Eliminar recurso (409 si está en uso; force=1 para forzar)",True,None),
 ("Preguntas","get","/questions?q=&type=&category=","Banco de preguntas",True,None),
 ("Preguntas","post","/questions","Crear pregunta",True,'{"type":"single","prompt":"¿...?","options":[{"text":"A","correct":true},{"text":"B"}],"points":1}'),
 ("Preguntas","get","/questions/{questionId}","Ver pregunta",True,None),
 ("Preguntas","put","/questions/{questionId}","Actualizar pregunta",True,None),
 ("Preguntas","post","/questions/{questionId}/duplicate","Duplicar pregunta",True,None),
 ("Preguntas","delete","/questions/{questionId}","Eliminar pregunta",True,None),
 ("Preguntas","get","/quizzes","Evaluaciones del banco",True,None),
 ("Preguntas","post","/quizzes","Crear evaluación",True,'{"title":"...","settings":{"passingScore":70},"questionIds":[]}'),
 ("Preguntas","get","/quizzes/{quizId}","Ver evaluación con preguntas",True,None),
 ("Preguntas","put","/quizzes/{quizId}","Actualizar evaluación",True,None),
 ("Preguntas","post","/quizzes/{quizId}/duplicate","Duplicar evaluación",True,None),
 ("Preguntas","delete","/quizzes/{quizId}","Eliminar evaluación",True,None),
 ("Categorías","get","/categories","Listar categorías",True,None),
 ("Categorías","post","/categories","Crear categoría",True,'{"name":"Seguridad","color":"#ea580c"}'),
 ("Categorías","patch","/categories/{categoryId}","Actualizar categoría",True,None),
 ("Categorías","delete","/categories/{categoryId}","Eliminar categoría",True,None),
 ("Usuarios","get","/users","Listar usuarios (admin)",True,None),
 ("Usuarios","get","/users/roles","Roles y permisos",True,None),
 ("Usuarios","post","/users","Crear usuario (admin)",True,'{"email":"autor@empresa.com","name":"Autor","password":"Clave1234","role":"author"}'),
 ("Usuarios","patch","/users/{userId}","Editar usuario (admin)",True,None),
 ("Usuarios","delete","/users/{userId}","Eliminar usuario (admin)",True,None),
 ("Configuración","get","/settings","Configuración general y límites",True,None),
 ("Configuración","put","/settings","Guardar configuración de la organización (admin)",True,'{"organization":{"name":"EMA Servicios"}}'),
 ("IA (preparado)","get","/ai/status","Estado del proveedor de IA",True,None),
 ("IA (preparado)","post","/ai/generate-course","Generar curso (mode ai | structure)",True,'{"prompt":"Seguridad e higiene para empleados","duration":"2 horas","level":"básico","modules":5,"mode":"structure"}'),
 ("IA (preparado)","post","/ai/import-content","Crear curso desde txt/md/docx/pdf o texto (multipart)",True,None),
 ("IA (preparado)","post","/ai/questions","Generar preguntas a partir de un texto (requiere IA)",True,'{"text":"...","count":5}'),
 ("IA (preparado)","post","/ai/summarize","Resumir contenido (requiere IA)",True,'{"text":"..."}'),
 ("Sistema","get","/health","Estado del servicio",False,None),
]

lines = ["openapi: 3.0.3", "info:", "  title: EMA Studio API", "  version: 1.0.0", "  description: |",
         "    API REST de EMA Studio (autoría e-learning y exportación SCORM 1.2).",
         "    Autenticación: `Authorization: Bearer <token>` obtenido en `POST /api/auth/login`.",
         "    Los errores devuelven `{ \"error\": \"mensaje\", \"details\": [...] }`.",
         "servers:", "  - url: /api", "components:", "  securitySchemes:", "    bearer:", "      type: http", "      scheme: bearer", "      bearerFormat: JWT", "paths:"]
paths = OrderedDict()
for tag, m, path, summary, auth, body in EPS:
    paths.setdefault(path.split('?')[0], []).append((tag, m, summary, auth, body, path))
for p, ops in paths.items():
    lines.append(f"  {p}:")
    params = re.findall(r"\{(\w+)\}", p)
    for tag, m, summary, auth, body, full in ops:
        lines += [f"    {m}:", f"      tags: [{json.dumps(tag, ensure_ascii=False)}]", f"      summary: {json.dumps(summary, ensure_ascii=False)}"]
        if auth: lines.append("      security: [{ bearer: [] }]")
        qs = re.findall(r"[?&](\w+)=", full)
        if params or qs:
            lines.append("      parameters:")
            lines += [f"        - {{ name: {x}, in: path, required: true, schema: {{ type: string }} }}" for x in params]
            lines += [f"        - {{ name: {x}, in: query, required: false, schema: {{ type: string }} }}" for x in qs]
        if body:
            lines += ["      requestBody:", "        content:", "          application/json:", f"            example: {body}"]
        lines += ["      responses:", "        '200': { description: OK }"]
        if auth: lines.append("        '401': { description: No autenticado }")
open(os.path.join(ROOT, 'docs/openapi.yaml'), 'w').write("\n".join(lines) + "\n")

md = ["# API REST — EMA Studio", "", "Base: `/api` · Autenticación: `Authorization: Bearer <JWT>` (obtenido con `POST /api/auth/login`).",
      "Documentación interactiva (Swagger UI): **`/api/docs`** · Especificación: [`openapi.yaml`](openapi.yaml).", "",
      "Errores: `{ \"error\": \"mensaje\", \"details\": [...] }` — 400 validación, 401 no autenticado, 403 sin permisos, 404, 409 conflicto/en uso, 413 tamaño, 422 curso con errores al exportar, 500."]
cur = None
for tag, m, path, summary, auth, body in EPS:
    if tag != cur:
        md += ["", f"## {tag}", "", "| Método | Ruta | Descripción |", "|---|---|---|"]
        cur = tag
    md.append(f"| `{m.upper()}` | `/api{path}` | {summary}{'' if auth else ' (público)'} |")
open(os.path.join(ROOT, 'docs/API.md'), 'w').write("\n".join(md) + "\n")
print("docs generados")
