// Define your languages here as a single source of truth
export const locales = ['en', 'es', 'de', 'pt', 'it', 'hr'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';