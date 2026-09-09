export function getLocaleForDate(locale: string): string {
  return locale === 'en' ? 'en-GB' : locale;
}