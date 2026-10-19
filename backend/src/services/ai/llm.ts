import { config } from '../../config';
import { HttpError } from '../../middleware/error';
import type { AIProvider, AICourseOutline, AIQuestionOutline, CourseBrief } from './types';

const OUTLINE_SPEC = `Respondé SOLO con JSON válido (sin markdown) con esta forma:
{"title":string,"description":string,"objectives":string[],
 "modules":[{"title":string,"lessons":[{"title":string,"screens":[{"title":string,"kind":"intro"|"content"|"list"|"image"|"practice"|"summary","heading":string,"body":string,"bullets":string[],"question":{"type":"single"|"truefalse"|"multiple","prompt":string,"options":[{"text":string,"correct":boolean}],"explanation":string}}]}]}],
 "finalQuiz":[{"type":"single"|"truefalse"|"multiple","prompt":string,"options":[{"text":string,"correct":boolean}],"explanation":string}]}
Reglas: textos breves y claros para e-learning, 3 a 5 pantallas por lección, una pantalla "practice" con pregunta por lección, 6 a 10 preguntas en finalQuiz.`;

function extractJson(text: string): any {
  const start = text.indexOf('{') >= 0 && (text.indexOf('[') < 0 || text.indexOf('{') < text.indexOf('[')) ? text.indexOf('{') : text.indexOf('[');
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start < 0 || end < 0) throw new HttpError(502, 'La IA no devolvió JSON');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, 'La IA devolvió un JSON inválido');
  }
}

async function complete(system: string, user: string): Promise<string> {
  const { provider, apiKey, model, baseUrl } = config.ai;
  if (!apiKey) throw new HttpError(400, 'Falta AI_API_KEY en la configuración');
  if (provider === 'anthropic') {
    const r = await fetch((baseUrl || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model || 'claude-sonnet-4-5', max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw new HttpError(502, `Error del proveedor de IA (${r.status}): ${(await r.text()).slice(0, 300)}`);
    const j: any = await r.json();
    return (j.content || []).map((c: any) => c.text || '').join('');
  }
  if (provider === 'openai') {
    const r = await fetch((baseUrl || 'https://api.openai.com/v1') + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }),
    });
    if (!r.ok) throw new HttpError(502, `Error del proveedor de IA (${r.status}): ${(await r.text()).slice(0, 300)}`);
    const j: any = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  throw new HttpError(400, 'No hay un proveedor de IA configurado');
}

export const llmProvider: AIProvider = {
  id: 'llm',
  label: 'Modelo de lenguaje',
  async generateCourse(b: CourseBrief): Promise<AICourseOutline> {
    const user = `Creá un curso e-learning en ${b.language || 'español'}.
Pedido: ${b.prompt}
Audiencia: ${b.audience || 'general'} · Duración: ${b.duration || '1 hora'} · Nivel: ${b.level || 'básico'} · Cantidad de módulos: ${b.modules || 3}`;
    return extractJson(await complete(`Sos un diseñador instruccional experto. ${OUTLINE_SPEC}`, user));
  },
  async generateQuestions(text: string, count: number): Promise<AIQuestionOutline[]> {
    const out = extractJson(await complete(
      'Sos un experto en evaluación. Respondé SOLO con JSON: {"questions":[{"type":"single"|"truefalse"|"multiple","prompt":string,"options":[{"text":string,"correct":boolean}],"explanation":string}]}',
      `Generá ${count} preguntas sobre este contenido:\n\n${text.slice(0, 20000)}`
    ));
    return Array.isArray(out) ? out : out.questions || [];
  },
  async summarize(text: string): Promise<string> {
    return complete('Resumí el contenido en español, en viñetas breves para un curso e-learning.', text.slice(0, 30000));
  },
};
