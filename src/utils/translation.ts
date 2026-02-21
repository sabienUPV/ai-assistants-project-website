import { getCollection } from 'astro:content';

import glossaryTermIconSvg from '@assets/icons/glossary-term.svg?raw';
import tooltipArrowSvg from '@assets/icons/arrow.svg?raw';

import { locales } from '@languages';
import type { Locale } from '@languages';

export function getStaticPathsFromLocales() {
		return locales.map(locale => ({ params: { locale } }));
}

// 1. Load data once (Astro optimizes this at build time)
const i18nEntries = await getCollection('i18n');
const glossaryEntries = await getCollection('glossary');

// 2. Fast i18n Lookup Map
// { en: { hero_title: "Welcome..." }, es: { ... } }
const i18nMap = i18nEntries.reduce((acc, entry) => {
  locales.forEach(locale => {
    if (!acc[locale]) acc[locale] = {};
    acc[locale][entry.data.id] = entry.data[locale];
  });
  return acc;
}, {} as Record<Locale, Record<string, string>>);

// 3. Fast Glossary Lookup Map
// { en: { term1: "definition1", term2: "definition2" }, es: { ... } }
const glossaryTermsByLanguage = glossaryEntries.reduce((acc, entry) => {
  locales.forEach(locale => {
    const term = entry.data[`term_${locale}` as const];
    const def = entry.data[`def_${locale}` as const];
    
    // Validates existence AND safely normalizes the key to lowercase
    if (term && def) {
      if (!acc[locale]) acc[locale] = {};
      acc[locale][term.toLowerCase()] = def;
    }
  });
  return acc;
}, {} as Record<Locale, Record<string, string>>);

export type TranslationHelper = (key: string, htmlWithGlossaries?: boolean, ...args: Parameters<typeof formatString>[1][]) => string;
export function getTranslationHelperFn(locale: Locale) : TranslationHelper {
  return (key: string, htmlWithGlossaries: boolean = false, ...args: Parameters<typeof formatString>[1][]) => tForLocale(locale, key, htmlWithGlossaries, ...args);
}

export function tForLocale(locale: Locale, key: string, htmlWithGlossaries: boolean = false, ...args: Parameters<typeof formatString>[1][]) : string {
  const translations = i18nMap[locale];
  if (!translations) {
    console.warn(`Missing translations for locale: ${locale}`);
    return key;
  }

  const text = translations[key];
  if (!text) {
    console.warn(`Missing translation for key: ${key}`);
    return key;
  }

  const formattedText = args.length > 0 ? formatString(text, ...args) : text;

  return htmlWithGlossaries ? injectGlossariesHtml(locale, formattedText) : formattedText;
}

function injectGlossariesHtml(locale: Locale, text: string): string {
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
    return getGlossaryHtml(termMatch, definition, punctuation);
  });

  return text;
}

export type GlossaryHelper = ReturnType<typeof getGlossaryHtmlForTermFn>;
export function getGlossaryHtmlForTermFn(locale: Locale) {
  return (term: string, containerEl = 'span', textEl = 'span') => getGlossaryHtmlForTermInLocale(locale, term, containerEl, textEl);
}
export function getGlossaryHtmlForTermInLocale(locale: Locale, term: string, containerEl = 'span', textEl = 'span'): string | null {
  // Get all terms for this language
  const terms = glossaryTermsByLanguage[locale];
  if (!terms) return null;
  
  // Find the definition
  const definition = terms[term.toLowerCase()];
  if (!definition) return null;

  // Return the HTML for this term
  return getGlossaryHtml(term, definition, undefined, containerEl, textEl);
}

function getGlossaryHtml(term: string, definition: string, punctuation?: string, containerEl = 'span', textEl = 'span'): string {
  return `<${containerEl} class="tooltip-container">${glossaryTermIconSvg}<${textEl} class="pid-text">${term}</${textEl}>${punctuation || ''}<span class="tooltip-content">${definition}${tooltipArrowSvg}</span></${containerEl}>`;
}

/**
 * Simulates C# string.Format for positional arguments.
 * Usage: formatString("Hello {0}!", "World") => "Hello World!"
 */
export function formatString(template: string, ...args: (string | number)[]): string {
  return template.replace(/{(\d+)}/g, (match, number) => {
    return typeof args[+number] !== 'undefined' ? String(args[+number]) : match;
  });
}