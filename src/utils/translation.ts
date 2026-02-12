import { getCollection } from 'astro:content';

// 1. Load data once (Astro optimizes this at build time)
const i18nEntries = await getCollection('i18n');
const glossaryEntries = await getCollection('glossary');

// 2. Convert array of rows into a fast Lookup Map
// { en: { hero_title: "Welcome..." }, es: { ... } }
const i18nMap = {
  en: Object.fromEntries(i18nEntries.map(e => [e.data.id, e.data.en])),
  es: Object.fromEntries(i18nEntries.map(e => [e.data.id, e.data.es])),
};

export type Lang = 'en' | 'es';

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
      const regex = new RegExp(`\\b(${term})\\b`, 'i');
      
      if (text.match(regex)) {
        const tooltipHtml = `
          <span class="group relative cursor-help border-b border-dotted border-gray-500">
            $1
            <span class="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-50">
              ${def}
              <svg class="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon class="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </span>
          </span>
        `;
        text = text.replace(regex, tooltipHtml);
      }
    });

    return text;
  };
}