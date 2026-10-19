# Convenciones del frontend (para colaboradores)

- Stack: React 18 + TypeScript + Vite + Tailwind (darkMode: 'class') + react-router 6 + @tanstack/react-query 5 + zustand + lucide-react.
- Idioma de la UI: español rioplatense ("Creá", "Elegí", "Guardar"). Sin textos en inglés.
- Código compartido con el player: `import { ... } from '@engine'` (ver scorm-engine/src/index.ts): tipos `CourseDoc`, `Question`, `Theme`, `FONTS`, `PRESET_THEMES`, `newQuestion`, `newQuiz`, `QUESTION_TYPE_LABELS`, `validateQuestion`, `iconSvgString`, etc.
- HTTP: `import { api, assetUrl } from '../lib/api'` → `api.get/post/put/patch/del/upload(url, FormData)/download(url, nombre)`. Las URLs NO llevan `/api` (se agrega solo). Errores: `ApiError` con `.message` en castellano.
- Notificaciones: `import { toast } from '../lib/toast'` → `toast.success('…')`, `toast.error(err)`.
- UI kit en `src/components/ui/index.tsx`: Button (variant primary|secondary|ghost|danger|success, size xs|sm|md|lg, loading, icon), IconButton, Field, Input, Textarea, Select (options prop), Switch, ColorInput, Modal (open,onClose,title,description,footer,size sm|md|lg|xl|full), confirmDialog({title,message,danger,confirmText}) → Promise<boolean>, promptDialog({title,label,value}) → Promise<string|null>, Spinner, PageLoader, Empty, PageHeader, Badge (color slate|green|amber|red|blue|violet), Tabs, useMenu/ContextMenu, Dropdown({trigger:(open)=>node, items}).
- Clases utilitarias en `src/index.css`: `.btn .btn-primary .input .card .badge .label .panel-title .table-base .kbd .icon-btn`.
- Recursos: `MediaPicker`, `MediaField`, `KindIcon`, `useUpload` en `src/components/MediaPicker.tsx`.
- Preguntas: `QuestionEditor` en `src/editor/fields/QuestionEditor.tsx` (value: Question, onChange).
- Texto enriquecido: `RichTextEditor` en `src/editor/fields/RichTextEditor.tsx`.
- Autenticación/permisos: `useAuth()` → `{ user, can(perm) }`. Permisos: users.manage, courses.create, courses.edit, courses.delete, courses.publish, courses.export, templates.manage, templates.use, media.upload, questions.manage, categories.manage, themes.manage, settings.manage, view.
- Fechas/tamaños: `fmtDate, fmtRelative, fmtBytes, stripHtml` en `src/lib/format.ts`.
- Todo botón visible debe funcionar de verdad contra la API. Nada simulado.
- Soportar modo oscuro (`dark:`) y pantallas chicas.
