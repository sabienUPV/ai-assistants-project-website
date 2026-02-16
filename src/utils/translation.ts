import { getCollection } from 'astro:content';

import glossaryTermIconSvg from '@assets/icons/search.svg?raw';
import tooltipArrowSvg from '@assets/icons/arrow.svg?raw';

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
const glossaryTermsByLanguage = glossaryEntries.reduce((acc, entry) => {
  locales.forEach(locale => {
    const term = entry.data[`term_${locale}` as const];
    const def = entry.data[`def_${locale}` as const];
    if (term && def) {
      if (!acc[locale]) acc[locale] = {};
      acc[locale][term.toLowerCase()] = def;
    }
  });
  return acc;
}, {} as Record<Locale, Record<string, string>>);

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

    // 1. Get all terms for this language
    const terms = glossaryTermsByLanguage[locale];
    if (!terms) return text;

    // 2. Create ONE regex matching ANY of the terms: \b(term1|term2|term3)\b([.,;:!?]?)
    const escapedTerms = Object.keys(terms).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const combinedRegex = new RegExp(`\\b(${escapedTerms.join('|')})\\b([.,;:!?]?)`, 'gi');

    // Keep track of what we've replaced so we only do the first occurrence
    const replacedTerms = new Set<string>();

    // 3. Run a single replace pass
    text = text.replace(combinedRegex, (match, termMatch, punctuation) => {
      const lowerTerm = termMatch.toLowerCase();
      
      // If we already added a tooltip for this word, just return the word normally
      if (replacedTerms.has(lowerTerm)) {
        return match; 
      }

      // Find the definition
      const definition = terms[lowerTerm];
      if (!definition) return match;

      replacedTerms.add(lowerTerm);

      // 4. Inject using the ?raw SVG variables!
      return `
        <span class="tooltip-container">
          ${glossaryTermIconSvg}
          <span class="pid-text">${termMatch}</span>${punctuation}      
          <span class="tooltip-content">
            ${definition}
            ${tooltipArrowSvg}
          </span>
        </span>
      `;
    });

    return text;
  };
}