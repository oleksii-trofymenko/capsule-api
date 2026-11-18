import { notesToKeep } from './notes.js';
import { stylistPrompts } from './stylist.prompts.js';

const words = stylistPrompts.en.lastingWords;
const yellow = [{ kind: 'dislike', text: 'yellow' }];

describe('notesToKeep', () => {
  it.each([
    'By the way, I never wear yellow.',
    'I love navy.',
    "I can't stand turtlenecks.",
    "I'm a UK 12 in dresses.",
    'My size is M.',
  ])('keeps notes from a lasting statement: %s', (message) => {
    expect(notesToKeep(yellow, message, words)).toEqual([
      { kind: 'dislike', text: 'yellow' },
    ]);
  });

  it.each([
    'That felt too stiff. It was the blazer.',
    'No jeans for this wedding, please.',
    "It's raining today, what should I wear?",
  ])('drops notes from a one-off remark: %s', (message) => {
    expect(notesToKeep(yellow, message, words)).toEqual([]);
  });

  it('drops invalid notes and keeps at most three', () => {
    const notes = [
      { kind: 'opinion', text: 'boots' },
      { kind: 'like', text: 'x'.repeat(500) },
      { kind: 'like', text: '  green ' },
      { kind: 'like', text: 'camel' },
      { kind: 'dislike', text: 'orange' },
      { kind: 'dislike', text: 'lilac' },
    ];
    expect(notesToKeep(notes, 'I always wear colour.', words)).toEqual([
      { kind: 'like', text: 'green' },
      { kind: 'like', text: 'camel' },
      { kind: 'dislike', text: 'orange' },
    ]);
  });
});
