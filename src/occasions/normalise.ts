/**
 * Lower case, with every run of punctuation, dashes or spaces turned into one
 * space: "Black-Tie gala?" becomes "black tie gala". Phrases, item names and
 * colours are all compared in this form.
 */
export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
