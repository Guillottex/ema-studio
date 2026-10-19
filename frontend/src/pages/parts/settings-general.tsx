import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, KeyRound, Building2, Server, Sparkles, ExternalLink, FileCode2, Package, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { applyMode, currentMode, type ThemeMode } from '../../lib/darkmode';
import { toast } from '../../lib/toast';
import { Badge, Button, Field, Input, PageLoader, Select, clsx } from '../../components/ui';
import { ROLE_INFO, PERMISSION_LABELS, type RoleName } from './users-roles';

function Panel({ title, description, icon, children, footer }: { title: string; description?: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        {icon && <div className="mt-0.5 text-brand-600 dark:text-brand-300">{icon}</div>}
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">{footer}</div>}
    </section>
  );
}

/* ------------------------------- Mi perfil ------------------------------- */

export function ProfileTab() {
  const { user, refresh } = useAuth();
  const [mode, setMode] = useState<ThemeMode>(currentMode());
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [rep, setRep] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  if (!user) return null;
  const role = ROLE_INFO[user.role as RoleName];

  const changeMode = async (m: ThemeMode) => {
    setMode(m);
    applyMode(m, false);
    setModeSaving(true);
    try {
      await api.put('/auth/preferences', { theme: m });
      await refresh();
    } catch (e) { toast.error(e); } finally { setModeSaving(false); }
  };

  const pwError = next && next.length < 8 ? 'Mínimo 8 caracteres' : rep && rep !== next ? 'Las contraseñas no coinciden' : undefined;
  const canSubmit = cur && next.length >= 8 && rep === next;
  const changePassword = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.post('/auth/password', { current: cur, next });
      toast.success('Contraseña actualizada');
      setCur(''); setNext(''); setRep('');
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="Datos de la cuenta" description="Para cambiar tu nombre, email o rol, pedíselo a un administrador.">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
            {user.name.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900 dark:text-white">{user.name}</div>
            <div className="truncate text-sm text-slate-500">{user.email}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><Input value={user.name} readOnly disabled /></Field>
          <Field label="Email"><Input value={user.email} readOnly disabled /></Field>
        </div>
        <div className="mt-4">
          <div className="label">Rol</div>
          <div className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', role?.color)}>{role?.icon}{role?.label || user.role}</div>
          {role && <p className="mt-1.5 text-xs text-slate-500">{role.summary}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {user.permissions.filter((p) => PERMISSION_LABELS[p]).map((p) => <Badge key={p} className="!text-[11px]">{PERMISSION_LABELS[p]}</Badge>)}
          </div>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Apariencia" description="Se guarda en tu perfil y se aplica en cualquier dispositivo.">
          <div className="grid grid-cols-2 gap-3">
            {([['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" disabled={modeSaving} onClick={() => changeMode(m)}
                className={clsx('overflow-hidden rounded-xl border-2 text-left transition', mode === m ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
                <div className={clsx('flex h-20 gap-1.5 p-2', m === 'dark' ? 'bg-slate-950' : 'bg-slate-100')}>
                  <div className={clsx('w-1/4 rounded', m === 'dark' ? 'bg-slate-800' : 'bg-white')} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className={clsx('h-3 rounded', m === 'dark' ? 'bg-slate-800' : 'bg-white')} />
                    <div className={clsx('flex-1 rounded', m === 'dark' ? 'bg-slate-900' : 'bg-white')} />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium"><Icon className="h-4 w-4" />{label}{mode === m && <CheckCircle2 className="ml-auto h-4 w-4 text-brand-600" />}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Cambiar contraseña" icon={<KeyRound className="h-5 w-5" />}
          footer={<Button variant="primary" loading={saving} disabled={!canSubmit} onClick={changePassword}>Actualizar contraseña</Button>}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); changePassword(); }}>
            <input type="text" autoComplete="username" value={user.email} readOnly hidden />
            <Field label="Contraseña actual">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" className="pr-10" />
                <button type="button" className="icon-btn absolute right-1 top-0.5" title={show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onClick={() => setShow((v) => !v)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nueva contraseña" hint="Mínimo 8 caracteres."><Input type={show ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
              <Field label="Repetí la nueva contraseña" error={pwError}><Input type={show ? 'text' : 'password'} value={rep} onChange={(e) => setRep(e.target.value)} autoComplete="new-password" /></Field>
            </div>
            <button type="submit" className="hidden" />
          </form>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------- Organización ------------------------------- */

interface AppSettings {
  organization: { name: string; defaultAuthor?: string; defaultLanguage?: string };
  limits: { maxUploadMb: number; maxImageMb: number; imageMaxWidth: number };
  ai: { provider: string; configured: boolean; model: string | null };
  cors: string[];
}
interface AiStatus { provider: string; configured: boolean; model: string | null; importFormats?: string[] }

const LANGS = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' }, { value: 'pt', label: 'Portugués' }];
const PROVIDERS: Record<string, string> = { none: 'Sin proveedor', openai: 'OpenAI (o compatible)', anthropic: 'Anthropic (Claude)' };

export function OrganizationTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<AppSettings>('/settings') });
  const { data: ai } = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<AiStatus>('/ai/status') });
  const [org, setOrg] = useState({ name: '', defaultAuthor: '', defaultLanguage: 'es' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setOrg({ name: data.organization.name || '', defaultAuthor: data.organization.defaultAuthor || '', defaultLanguage: data.organization.defaultLanguage || 'es' });
  }, [data]);

  if (isLoading || !data) return <PageLoader />;
  const dirty = org.name !== (data.organization.name || '') || org.defaultAuthor !== (data.organization.defaultAuthor || '') || org.defaultLanguage !== (data.organization.defaultLanguage || 'es');

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { organization: { name: org.name.trim(), defaultAuthor: org.defaultAuthor.trim(), defaultLanguage: org.defaultLanguage } });
      await qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Configuración guardada');
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };
  const aiInfo = ai || data.ai;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="Organización" icon={<Building2 className="h-5 w-5" />} description={canManage ? 'Valores por defecto para los cursos nuevos y los paquetes SCORM.' : 'Solo los administradores pueden modificar estos datos.'}
        footer={canManage ? <><Button disabled={!dirty || saving} onClick={() => setOrg({ name: data.organization.name || '', defaultAuthor: data.organization.defaultAuthor || '', defaultLanguage: data.organization.defaultLanguage || 'es' })}>Descartar</Button><Button variant="primary" loading={saving} disabled={!dirty || !org.name.trim()} onClick={save}>Guardar cambios</Button></> : undefined}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canManage && dirty) save(); }}>
          <Field label="Nombre de la organización" hint="Aparece en el manifiesto SCORM y en los metadatos de los cursos.">
            <Input value={org.name} maxLength={120} disabled={!canManage} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
          </Field>
          <Field label="Autor por defecto" hint="Se completa automáticamente al crear un curso nuevo.">
            <Input value={org.defaultAuthor} maxLength={120} disabled={!canManage} placeholder="Ej.: Área de Capacitación" onChange={(e) => setOrg({ ...org, defaultAuthor: e.target.value })} />
          </Field>
          <Field label="Idioma por defecto de los cursos">
            <Select value={org.defaultLanguage} disabled={!canManage} onChange={(e) => setOrg({ ...org, defaultLanguage: e.target.value })} options={LANGS} />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </Panel>

      <div className="space-y-6">
        <Panel title="Servidor" icon={<Server className="h-5 w-5" />} description={<>Estos valores se definen en el archivo <code className="kbd">.env</code> del backend y requieren reiniciar el servicio para cambiar.</>}>
          <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <Row k="Tamaño máximo por archivo" v={`${data.limits.maxUploadMb} MB`} env="MAX_UPLOAD_MB" />
            <Row k="Tamaño máximo de imágenes" v={`${data.limits.maxImageMb} MB`} env="MAX_IMAGE_MB" />
            <Row k="Ancho máximo de imágenes" v={`${data.limits.imageMaxWidth} px (se redimensionan al subir)`} env="IMAGE_MAX_WIDTH" />
            <div className="py-2.5">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Orígenes CORS permitidos</dt><code className="text-[11px] text-slate-400">CORS_ORIGIN</code></div>
              <dd className="mt-1.5 flex flex-wrap gap-1">{data.cors.length ? data.cors.map((o) => <Badge key={o} className="font-mono !text-[11px]">{o}</Badge>) : <span className="text-slate-400">—</span>}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Inteligencia artificial" icon={<Sparkles className="h-5 w-5" />}>
          <div className="flex items-start gap-3">
            {aiInfo.configured ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-amber-500" />}
            <div className="text-sm">
              <div className="font-medium">{aiInfo.configured ? 'Proveedor configurado' : 'IA no configurada'}</div>
              <div className="text-slate-500">
                Proveedor: <b>{PROVIDERS[aiInfo.provider] || aiInfo.provider}</b>{aiInfo.model ? <> · Modelo: <code className="text-xs">{aiInfo.model}</code></> : null}
              </div>
              {ai?.importFormats && <div className="mt-1 text-xs text-slate-500">Formatos de importación: {ai.importFormats.map((f) => f.toUpperCase()).join(', ')}</div>}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Para habilitar la generación de cursos con IA, definí <code className="kbd">AI_PROVIDER</code> (<code>anthropic</code> u <code>openai</code>), <code className="kbd">AI_API_KEY</code> y opcionalmente <code className="kbd">AI_MODEL</code> / <code className="kbd">AI_BASE_URL</code> en el <code className="kbd">.env</code> del backend y reiniciá el servicio. La clave nunca se envía al navegador.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v, env }: { k: string; v: React.ReactNode; env: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2.5">
      <dt className="text-slate-500">{k}</dt>
      <dd className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">{v}<code className="text-[11px] font-normal text-slate-400">{env}</code></dd>
    </div>
  );
}

/* ------------------------------- Acerca de ------------------------------- */

export function AboutTab() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="EMA Servicios · Estudio e-learning" icon={<Package className="h-5 w-5" />}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 7h12M6 12h8M6 17h12" /></svg>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">EMA Servicios · Estudio e-learning</div>
            <div className="text-sm text-slate-500">Versión <b>1.0.0</b> · Autoría e-learning</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Herramienta de autoría para crear cursos interactivos con editor visual, banco de preguntas, biblioteca multimedia compartida, plantillas y temas, y exportarlos como paquetes SCORM listos para cualquier LMS.
        </p>
      </Panel>

      <Panel title="Exportación SCORM 1.2" icon={<FileCode2 className="h-5 w-5" />}>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>• Cada curso se exporta como un <b>.zip SCORM 1.2</b> autocontenido (manifiesto <code className="text-xs">imsmanifest.xml</code>, reproductor, recursos y fuentes embebidas).</li>
          <li>• Reporta al LMS el estado de finalización, el puntaje de la evaluación final, el tiempo de sesión y las interacciones de cada pregunta.</li>
          <li>• Guarda el progreso (<code className="text-xs">suspend_data</code>) para que el participante retome donde dejó.</li>
          <li>• Funciona sin conexión a internet: no depende de servicios externos.</li>
        </ul>
      </Panel>

      <Panel title="API REST" icon={<ExternalLink className="h-5 w-5" />} description="Toda la funcionalidad está disponible mediante una API documentada con OpenAPI.">
        <a href="/api/docs" target="_blank" rel="noreferrer" className="btn btn-secondary"><ExternalLink className="h-4 w-4" />Abrir documentación de la API</a>
        <p className="mt-2 text-xs text-slate-500">Se abre en una pestaña nueva. Las rutas requieren el token JWT del usuario (encabezado <code>Authorization: Bearer …</code>).</p>
      </Panel>
    </div>
  );
}
