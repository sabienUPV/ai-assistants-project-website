// Define your languages here as a single source of truth
export const locales = ['en', 'es', 'de', 'pt', 'it', 'hr'] as const;
export const defaultLocale = 'en';
export type Locale = typeof locales[number];