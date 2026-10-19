import { ShieldCheck, PenTool, Eye, Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { clsx } from '../../components/ui';

export type RoleName = 'admin' | 'author' | 'viewer';

export const ROLE_INFO: Record<RoleName, { label: string; icon: ReactNode; color: string; summary: string }> = {
  admin: {
    label: 'Administrador', icon: <ShieldCheck className="h-4 w-4" />, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300',
    summary: 'Control total: usuarios, categorías, configuración, publicación y eliminación de cursos.',
  },
  author: {
    label: 'Autor', icon: <PenTool className="h-4 w-4" />, color: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300',
    summary: 'Crea y edita cursos, sube recursos, gestiona preguntas y temas, y exporta SCORM.',
  },
  viewer: {
    label: 'Visualizador', icon: <Eye className="h-4 w-4" />, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
    summary: 'Solo consulta: puede ver cursos, recursos y vistas previas sin modificar nada.',
  },
};

export const PERMISSION_LABELS: Record<string, string> = {
  'courses.create': 'Crear cursos',
  'courses.edit': 'Editar cursos',
  'courses.export': 'Exportar SCORM',
  'courses.publish': 'Publicar cursos',
  'courses.delete': 'Eliminar cursos',
  'templates.use': 'Usar plantillas',
  'templates.manage': 'Administrar plantillas',
  'media.upload': 'Subir y borrar recursos',
  'questions.manage': 'Gestionar preguntas y evaluaciones',
  'themes.manage': 'Gestionar temas visuales',
  'categories.manage': 'Gestionar categorías',
  'users.manage': 'Gestionar usuarios',
  'settings.manage': 'Configuración de la organización',
  view: 'Ver contenido',
};

export interface RoleRow { id: number; name: RoleName; label: string; permissions: string[] }

/** Tarjeta explicativa con la matriz de permisos por rol (datos reales de /users/roles) */
export function RolesCard({ roles }: { roles: RoleRow[] }) {
  const order: RoleName[] = ['admin', 'author', 'viewer'];
  const sorted = order.map((n) => roles.find((r) => r.name === n)).filter(Boolean) as RoleRow[];
  const perms = Object.keys(PERMISSION_LABELS).filter((p) => roles.some((r) => r.permissions.includes(p)));
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="font-semibold text-slate-900 dark:text-white">Roles y permisos</h2>
        <p className="text-xs text-slate-500">Cada usuario tiene un único rol. Los permisos se aplican tanto en la interfaz como en la API.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {sorted.map((r) => {
          const info = ROLE_INFO[r.name];
          return (
            <div key={r.name} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className={clsx('mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', info.color)}>{info.icon}{r.label}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{info.summary}</p>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 dark:bg-slate-800/60">
              <th className="px-4 py-2 text-left font-semibold">Permiso</th>
              {sorted.map((r) => <th key={r.name} className="w-28 px-2 py-2 text-center font-semibold">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">{PERMISSION_LABELS[p]}</td>
                {sorted.map((r) => (
                  <td key={r.name} className="px-2 py-1.5 text-center">
                    {r.permissions.includes(p) ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Sí" /> : <Minus className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="No" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
