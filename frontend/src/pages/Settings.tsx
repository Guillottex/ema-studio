import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, User, Palette, Building2, Info } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PageHeader, Tabs } from '../components/ui';
import { ProfileTab, OrganizationTab, AboutTab } from './parts/settings-general';
import { ThemesTab } from './parts/settings-themes';

type Tab = 'perfil' | 'temas' | 'organizacion' | 'acerca';
const TABS: Tab[] = ['perfil', 'temas', 'organizacion', 'acerca'];

export default function Settings() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'perfil';
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'perfil') next.delete('tab'); else next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader icon={<SettingsIcon className="h-5 w-5" />} title="Configuración" description="Tu cuenta, temas visuales y parámetros de la organización." />
      <div className="mb-6 overflow-x-auto">
        <Tabs value={tab} onChange={setTab}
          tabs={[
            { id: 'perfil', label: 'Mi perfil', icon: <User className="h-4 w-4" /> },
            { id: 'temas', label: 'Temas', icon: <Palette className="h-4 w-4" /> },
            { id: 'organizacion', label: 'Organización', icon: <Building2 className="h-4 w-4" /> },
            { id: 'acerca', label: 'Acerca de', icon: <Info className="h-4 w-4" /> },
          ]} />
      </div>
      {tab === 'perfil' && <ProfileTab />}
      {tab === 'temas' && <ThemesTab canManage={can('themes.manage')} />}
      {tab === 'organizacion' && <OrganizationTab canManage={can('settings.manage')} />}
      {tab === 'acerca' && <AboutTab />}
    </div>
  );
}
