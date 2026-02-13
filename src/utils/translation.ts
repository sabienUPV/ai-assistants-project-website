import { getCollection } from 'astro:content';

import { locales } from '@languages';
import type { Locale } from '@languages';

export function getStaticPathsFromLocales() {
		return locales.map(locale => ({ params: { locale } }));
}

// 1. Load data once (Astro optimizes this at build time)
const i18nEntries = await getCollection('i18n');
const glossaryEntries = await getCollection('glossary');

// 2. Convert array of rows into a fast Lookup Map
// { en: { hero_title: "Welcome..." }, es: { ... } }
const i18nMap = locales.reduce((acc, locale) => {
  acc[locale] = Object.fromEntries(i18nEntries.map(e => [e.data.id, e.data[locale]]));
  return acc;
}, {} as Record<Locale, Record<string, string>>);

// 3. The Glossary Injection Magic
// We create a fast lookup map for each language to find definitions by term
type GlossaryEntry = { term: string; def: string };
const glossaryTermsByLanguage = glossaryEntries.reduce((acc, entry) => {
  locales.forEach(locale => {
    const term = entry.data[`term_${locale}` as const];
    const def = entry.data[`def_${locale}` as const];
    if (term && def) {
      if (!acc[locale]) acc[locale] = [];
      acc[locale].push({ term, def });
    }
  });
  return acc;
}, {} as Record<Locale, GlossaryEntry[]>);

export type TranslationHelper = ReturnType<typeof getFormatter>;
export function getFormatter(locale: Locale) {
  return function t(key: string, htmlWithGlossaries: boolean = false) {
    let text = i18nMap[locale][key];

    if (!text) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }

    if (!htmlWithGlossaries) {
      return text;
    }

    // Inject tooltips (only for the first occurrence of each term)
    glossaryTermsByLanguage[locale]?.forEach(({ term, def }) => {
      // Create a regex that finds the term as a whole word, case-insensitive
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'i');
      
      if (text.match(regex)) {
        const tooltipHtml = `
          <span class="tooltip-container">
            <svg class="pid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span class="pid-text">$1</span>
            <span class="tooltip-content">
              ${def}
              <svg class="tooltip-arrow" viewBox="0 0 255 255" preserveAspectRatio="none">
                <polygon points="0,0 127.5,127.5 255,0"/>
              </svg>
            </span>
          </span>
        `;
        text = text.replace(regex, tooltipHtml);
      }
    });

    return text;
  };
}