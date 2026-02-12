import { getCollection } from 'astro:content';

import { supportedLangs } from '@languages';
import type { Lang } from '@languages';

export function getStaticPathsFromLangs() {
		return supportedLangs.map(lang => ({ params: { lang } }));
}

// 1. Load data once (Astro optimizes this at build time)
const i18nEntries = await getCollection('i18n');
const glossaryEntries = await getCollection('glossary');

// 2. Convert array of rows into a fast Lookup Map
// { en: { hero_title: "Welcome..." }, es: { ... } }
const i18nMap = supportedLangs.reduce((acc, lang) => {
  acc[lang] = Object.fromEntries(i18nEntries.map(e => [e.data.id, e.data[lang]]));
  return acc;
}, {} as Record<Lang, Record<string, string>>);

// 3. The Glossary Injection Magic
// We create a fast lookup map for each language to find definitions by term
type GlossaryEntry = { term: string; def: string };
const glossaryTermsByLanguage = glossaryEntries.reduce((acc, entry) => {
  supportedLangs.forEach(lang => {
    const term = entry.data[`term_${lang}` as const];
    const def = entry.data[`def_${lang}` as const];
    if (term && def) {
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push({ term, def });
    }
  });
  return acc;
}, {} as Record<Lang, GlossaryEntry[]>);

export function getFormatter(lang: Lang) {
  return function t(key: string, htmlWithGlossaries: boolean = false) {
    let text = i18nMap[lang][key];

    if (!text) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }

    if (!htmlWithGlossaries) {
      return text;
    }

    // Inject tooltips (only for the first occurrence of each term)
    glossaryTermsByLanguage[lang]?.forEach(({ term, def }) => {
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