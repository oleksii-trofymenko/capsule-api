import { LOCALES } from '../locale.js';
import { buildQuiz } from './build-quiz.js';
import { profileAnswersSchema } from './profile.schemas.js';

describe.each(LOCALES)('quiz for %s', (locale) => {
  const quiz = buildQuiz(locale);

  it('asks exactly one question per profile answer', () => {
    const fields = Object.keys(profileAnswersSchema.shape).sort();
    expect(quiz.questions.map((q) => q.id).sort()).toEqual(fields);
  });

  it('labels every option and question in this locale', () => {
    const texts = [quiz.title, quiz.intro];
    for (const q of quiz.questions) {
      texts.push(q.question);
      const lists = q.type === 'sizes' ? [q.parts, q.systems] : [q.options];
      for (const list of lists) {
        expect(list.length, q.id).toBeGreaterThan(0);
        texts.push(...list.map((o) => o.label));
      }
    }
    for (const text of texts) expect(text.trim()).not.toBe('');
  });
});
