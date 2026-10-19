import { uid, type Question, type QuestionType, type QuizConfig } from '../types';

export function newQuestion(type: QuestionType = 'single'): Question {
  const base: Question = {
    id: uid(8),
    type,
    prompt: '¿Cuál es la respuesta correcta?',
    media: null,
    options: [],
    points: 1,
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Respuesta incorrecta.',
    explanation: '',
    attempts: 2,
    shuffle: true,
    timeLimit: 0,
    partialCredit: false,
  };
  switch (type) {
    case 'single':
      base.options = [
        { id: uid(6), text: 'Opción correcta', correct: true },
        { id: uid(6), text: 'Opción incorrecta' },
        { id: uid(6), text: 'Otra opción incorrecta' },
      ];
      break;
    case 'truefalse':
      base.prompt = 'Indicá si la afirmación es verdadera o falsa.';
      base.options = [
        { id: uid(6), text: 'Verdadero', correct: true },
        { id: uid(6), text: 'Falso' },
      ];
      base.shuffle = false;
      break;
    case 'multiple':
      base.prompt = 'Seleccioná todas las opciones correctas.';
      base.options = [
        { id: uid(6), text: 'Correcta A', correct: true },
        { id: uid(6), text: 'Correcta B', correct: true },
        { id: uid(6), text: 'Incorrecta' },
      ];
      break;
    case 'order':
      base.prompt = 'Ordená los pasos correctamente.';
      base.options = [
        { id: uid(6), text: 'Primer paso' },
        { id: uid(6), text: 'Segundo paso' },
        { id: uid(6), text: 'Tercer paso' },
      ];
      break;
    case 'match':
      base.prompt = 'Relacioná cada concepto con su definición.';
      base.options = [
        { id: uid(6), text: 'Concepto 1', match: 'Definición 1' },
        { id: uid(6), text: 'Concepto 2', match: 'Definición 2' },
        { id: uid(6), text: 'Concepto 3', match: 'Definición 3' },
      ];
      break;
    case 'fill':
      base.prompt = 'Completá los espacios en blanco.';
      base.fillText = 'La función {{SUMA|SUM}} permite sumar un rango de celdas.';
      break;
    case 'short':
      base.prompt = '¿Qué símbolo inicia una fórmula en Excel?';
      base.acceptedAnswers = ['=', 'igual'];
      break;
  }
  return base;
}

export function newQuiz(): QuizConfig {
  return {
    title: 'Evaluación',
    intro: 'Respondé las siguientes preguntas.',
    questions: [newQuestion('single'), newQuestion('truefalse')],
    drawCount: 0,
    randomize: false,
    passingScore: 70,
    attempts: 2,
    timeLimit: 0,
    showAnswers: true,
    showResult: true,
    passMessage: '¡Felicitaciones! Aprobaste la evaluación.',
    failMessage: 'No alcanzaste el puntaje mínimo.',
    isFinal: false,
  };
}
