import { localeRegionCodes, type Locale } from '@languages';

export function getLocaleForDate(locale: Locale): string {
  return localeRegionCodes[locale] || locale;
}