import { getCollection } from 'astro:content';

import glossaryTermIconSvg from '@assets/icons/glossary-term.svg?raw';
import tooltipArrowSvg from '@assets/icons/arrow.svg?raw';

import { locales, type Locale } from '@languages';

// Load data once (Astro optimizes this at build time)
const glossaryEntries = await getCollection('glossary');

// Fast Glossary Lookup Map
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

export function injectGlossariesHtml(locale: Locale, text: string): string {
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
  // Generate a unique ID for aria-describedby to link the term to its tooltip
  const tooltipId = `glossary-${generateUniqueId()}`;

  return `
  <${containerEl} class="tooltip-container">
    ${glossaryTermIconSvg}
    
    <${textEl} class="pid-text" tabindex="0" aria-describedby="${tooltipId}">
      ${term}
    </${textEl}>${punctuation || ''}
    
    <span id="${tooltipId}" role="tooltip" class="tooltip-content">
      
      <span class="sr-only"> - </span>
      
      ${definition}
      ${tooltipArrowSvg}
    </span>
  </${containerEl}>
  `;
}

function generateUniqueId() {
  // Generate a unique ID safely: use native Web Crypto if available, otherwise fallback to Base36
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 11);
}