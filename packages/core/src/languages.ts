// Define your languages here as a single source of truth
export const locales = ['en', 'es', 'de', 'pt', 'it', 'hr', 'fr'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';

export const localeEnglishNames: Record<Locale, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  hr: 'Croatian',
  fr: 'French',
};