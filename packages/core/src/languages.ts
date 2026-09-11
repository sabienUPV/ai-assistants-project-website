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

export const localeRegionCodes: Record<Locale, string> = {
  en: 'en-GB', // Using 'en-GB' for English to represent the UK region (since this is a European project), but you can change it to 'en-US' or any other region code as needed.
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-PT',
  it: 'it-IT',
  hr: 'hr-HR',
  fr: 'fr-FR',
};