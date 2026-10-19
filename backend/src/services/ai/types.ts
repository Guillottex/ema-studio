/** Estructura que debe devolver un proveedor de IA al generar un curso. */
export interface AIScreenOutline {
  title: string;
  kind?: 'intro' | 'content' | 'list' | 'image' | 'practice' | 'summary';
  heading?: string;
  body?: string;
  bullets?: string[];
  question?: AIQuestionOutline;
}

export interface AIQuestionOutline {
  type: 'single' | 'truefalse' | 'multiple';
  prompt: string;
  options: { text: string; correct?: boolean }[];
  explanation?: string;
}

export interface AICourseOutline {
  title: string;
  description?: string;
  objectives?: string[];
  modules: { title: string; lessons: { title: string; screens: AIScreenOutline[] }[] }[];
  finalQuiz?: AIQuestionOutline[];
}

export interface CourseBrief {
  prompt: string;
  audience?: string;
  duration?: string;
  level?: string;
  modules?: number;
  language?: string;
}

/**
 * Interfaz de proveedores de IA. Para sumar un proveedor nuevo alcanza con implementarla
 * y registrarla en services/ai/index.ts.
 */
export interface AIProvider {
  id: string;
  label: string;
  generateCourse(brief: CourseBrief): Promise<AICourseOutline>;
  generateQuestions(text: string, count: number): Promise<AIQuestionOutline[]>;
  summarize(text: string): Promise<string>;
}
