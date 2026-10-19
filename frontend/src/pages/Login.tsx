import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Layers, MonitorSmartphone, PackageCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field, Input } from '../components/ui';
import { EmaLogo } from '../components/Brand';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      nav(loc.state?.from || '/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#282964] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(118,198,226,.35),transparent_55%)]" />
        <svg className="absolute -right-10 bottom-0 h-[70%] opacity-[.12]" viewBox="0 0 200 300" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M100 10 L60 290 M100 10 L140 290 M70 80 H130 M62 150 H138 M55 220 H145 M70 80 L138 150 M130 80 L62 150 M62 150 L145 220 M138 150 L55 220 M20 60 H180 M20 60 L70 80 M180 60 L130 80" />
        </svg>
        <div className="relative flex items-center gap-3">
          <EmaLogo variant="white" className="h-12" />
        </div>
        <div className="relative max-w-lg">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#76C6E2]"><span className="h-2 w-2 rounded-full bg-[#76C6E2]" />Estudio e-learning</div>
          <h1 className="text-[44px] font-bold leading-[1.08]">Capacitación integral para potenciar a tu <span className="text-[#76C6E2]">equipo.</span></h1>
          <p className="mt-5 text-white/80">Creá cursos visuales e interactivos con la identidad de EMA Servicios y publicalos como SCORM 1.2 en cualquier LMS.</p>
          <ul className="mt-8 space-y-4 text-white/90">
            <li className="flex gap-3"><Layers className="h-5 w-5 flex-none text-[#76C6E2]" />Editor visual con layouts, componentes interactivos y evaluaciones.</li>
            <li className="flex gap-3"><MonitorSmartphone className="h-5 w-5 flex-none text-[#76C6E2]" />Cursos responsive para PC, tablet y celular.</li>
            <li className="flex gap-3"><PackageCheck className="h-5 w-5 flex-none text-[#76C6E2]" />Paquetes SCORM con progreso, puntaje y reanudación.</li>
          </ul>
        </div>
        <div className="relative flex flex-wrap items-center gap-2 text-xs text-white/70">
          {['Calidad', 'Seguridad', 'Cuidado del ambiente'].map((t) => <span key={t} className="rounded-full border border-white/20 px-3 py-1">{t}</span>)}
          <span className="ml-auto">EMA Servicios S.A. · Más de 30 años de experiencia</span>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white p-6 dark:bg-slate-950">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden"><EmaLogo className="h-12" /></div>
          <div>
            <h2 className="text-3xl font-bold text-[#282964] dark:text-white">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Ingresá con tu usuario del Estudio e-learning.</p>
          </div>
          <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@emaservicios.com.ar" autoFocus /></Field>
          <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          <Button type="submit" variant="primary" size="lg" className="w-full uppercase tracking-wide" loading={loading} icon={<LogIn className="h-4 w-4" />}>Ingresar</Button>
          <p className="text-center text-xs text-slate-400">¿Problemas para ingresar? Escribí a info@emaservicios.com.ar</p>
        </form>
      </div>
    </div>
  );
}
