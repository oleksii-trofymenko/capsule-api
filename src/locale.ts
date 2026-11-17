/** Locales with user-facing text. English only for now; others come later (T27). */
export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];
