import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { ConfirmHost, PromptHost, Toaster, PageLoader } from './components/ui';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const Templates = lazy(() => import('./pages/Templates'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const Questions = lazy(() => import('./pages/Questions'));
const Categories = lazy(() => import('./pages/Categories'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const AIGenerate = lazy(() => import('./pages/AIGenerate'));
const EditorPage = lazy(() => import('./editor/EditorPage'));
const PreviewPage = lazy(() => import('./preview/PreviewPage'));

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cursos/:id/editor" element={<Protected><EditorPage /></Protected>} />
          <Route path="/cursos/:id/preview" element={<Protected><PreviewPage /></Protected>} />
          <Route element={<Protected><AppShell /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="/cursos" element={<Courses />} />
            <Route path="/plantillas" element={<Templates />} />
            <Route path="/biblioteca" element={<MediaLibrary />} />
            <Route path="/preguntas" element={<Questions />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/usuarios" element={<Users />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="/generar-ia" element={<AIGenerate />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
      <ConfirmHost />
      <PromptHost />
    </>
  );
}
