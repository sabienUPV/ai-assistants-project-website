import { getCollection } from 'astro:content';
import { supportedLangs } from '../content.config';
import type { Lang } from '../content.config';

// 1. Load data once (Astro optimizes this at build time)
const i18nEntries = await getCollection('i18n');
const glossaryEntries = await getCollection('glossary');

// Re-export the supported languages for use in other parts of the app
export { supportedLangs };
export type { Lang };

// 2. Convert array of rows into a fast Lookup Map
// { en: { hero_title: "Welcome..." }, es: { ... } }
const i18nMap = supportedLangs.reduce((acc, lang) => {
  acc[lang] = Object.fromEntries(i18nEntries.map(e => [e.data.id, e.data[lang]]));
  return acc;
}, {} as Record<Lang, Record<string, string>>);

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

    // 3. The Glossary Injection Magic
    // We filter terms relevant to the current language
    const terms = glossaryEntries.map(g => ({
      term: g.data[`term_${lang}` as const], // e.g. "Neural Networks"
      def: g.data[`def_${lang}` as const]    // e.g. "Computer systems..."
    }));

    // Inject tooltips (only for the first occurrence of each term)
    terms.forEach(({ term, def }) => {
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