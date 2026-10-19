import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, BookOpen, LayoutTemplate, Images, CircleHelp, Tags, Users, Settings, Moon, Sun, LogOut, Search, Menu, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../lib/auth';
import { applyMode, currentMode } from '../../lib/darkmode';
import { GlobalSearch } from './GlobalSearch';
import { EmaLogo } from '../Brand';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/plantillas', label: 'Plantillas', icon: LayoutTemplate },
  { to: '/biblioteca', label: 'Biblioteca multimedia', icon: Images },
  { to: '/preguntas', label: 'Preguntas', icon: CircleHelp },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/usuarios', label: 'Usuarios', icon: Users, perm: 'users.manage' },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <EmaLogo className="h-10 dark:rounded-lg dark:bg-white dark:px-2 dark:py-1" />
      {!compact && <div className="pl-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">Estudio e-learning</div>}
    </div>
  );
}

export function AppShell() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState(currentMode());
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const pref = user?.preferences?.theme;
    if (pref === 'dark' || pref === 'light') { applyMode(pref, false); setMode(pref); }
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleMode = () => {
    const m = mode === 'dark' ? 'light' : 'dark';
    applyMode(m);
    setMode(m);
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-20 items-center justify-between px-5"><Logo />
        <button className="icon-btn lg:hidden" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X className="h-4 w-4" /></button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMobileNav(false)}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/20 dark:bg-sky-400 dark:text-brand-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100')}>
            <n.icon className="h-[18px] w-[18px]" />{n.label}
          </NavLink>
        ))}
        {can('courses.create') && (
          <NavLink to="/generar-ia" onClick={() => setMobileNav(false)}
            className={({ isActive }) => clsx('mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium border border-dashed transition-colors',
              isActive ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200' : 'border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20')}>
            <Sparkles className="h-[18px] w-[18px]" />Generar con IA
          </NavLink>
        )}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">{user?.name?.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-slate-500">{user?.role === 'admin' ? 'Administrador' : user?.role === 'author' ? 'Autor' : 'Visualizador'}</div>
          </div>
          <button className="icon-btn" title="Cerrar sesión" onClick={() => { logout(); nav('/login'); }}><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileNav && <div className="fixed inset-0 z-50 flex lg:hidden"><div className="h-full">{sidebar}</div><div className="flex-1 bg-black/40" onClick={() => setMobileNav(false)} /></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-1 flex-none bg-gradient-to-r from-[#282964] via-[#1E2D8A] to-[#76C6E2]" />
        <header className="flex h-16 flex-none items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <button onClick={() => setSearchOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60">
            <Search className="h-4 w-4" /><span className="flex-1 text-left">Buscar cursos, pantallas, recursos…</span><span className="kbd hidden sm:inline">Ctrl K</span>
          </button>
          <div className="flex-1" />
          <button className="icon-btn" onClick={toggleMode} title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}>{mode === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8"><Outlet /></div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
