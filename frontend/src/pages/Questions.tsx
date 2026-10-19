import { useSearchParams } from 'react-router-dom';
import { CircleHelp, ClipboardCheck, ListChecks } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PageHeader, Tabs } from '../components/ui';
import { QuestionsBank } from './parts/questions-bank';
import { QuizzesTab } from './parts/questions-quizzes';

type Tab = 'preguntas' | 'evaluaciones';

export default function Questions() {
  const { can } = useAuth();
  const canManage = can('questions.manage');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'evaluaciones' ? 'evaluaciones' : 'preguntas';
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'preguntas') next.delete('tab'); else next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        icon={<CircleHelp className="h-5 w-5" />}
        title="Banco de preguntas"
        description="Preguntas reutilizables y evaluaciones listas para insertar en tus cursos."
      />
      <Tabs className="mb-5" value={tab} onChange={setTab}
        tabs={[
          { id: 'preguntas', label: 'Preguntas', icon: <ListChecks className="h-4 w-4" /> },
          { id: 'evaluaciones', label: 'Evaluaciones', icon: <ClipboardCheck className="h-4 w-4" /> },
        ]} />
      {!canManage && (
        <p className="mb-4 text-xs text-slate-500">Tu rol permite consultar el banco, pero no crear ni modificar preguntas o evaluaciones.</p>
      )}
      {tab === 'preguntas' ? <QuestionsBank canManage={canManage} /> : <QuizzesTab canManage={canManage} />}
    </div>
  );
}
