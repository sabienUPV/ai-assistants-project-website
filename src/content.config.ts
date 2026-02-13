import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { parse as parseCsv } from 'csv-parse/sync';

// 1. Import the supported languages and their types
// from a single source of truth
import { locales } from './languages';
import type { Locale } from './languages';

// 2. Dynamically create the shape for the translations
// We want: { en: z.string(), es: z.string(), ... }
const langFields = locales.reduce((acc, locale) => {
  acc[locale] = z.string();
  return acc;
}, {} as Record<Locale, z.ZodString>);

const i18n = defineCollection({
  // Load the CSV and parse it into rows
  loader: file("src/content/i18n.csv", {
    parser: (text) => parseCsv(text, { 
      columns: true, // Use the header row for keys
      skip_empty_lines: true,
      trim: true,
    }),
  }),
  schema: z.object({
    id: z.string(),
    ...langFields, // Spread the dynamic language fields into the schema
  }).strict(), // Ensure no extra fields are present
});

// 3. Dynamically create the shape for the glossary
const glossaryFields = locales.reduce((acc, locale) => {
  acc[`term_${locale}`] = z.string();
  acc[`def_${locale}`] = z.string();
  return acc;
}, {} as Record<`term_${Locale}` | `def_${Locale}`, z.ZodString>);

const glossary = defineCollection({
  loader: file("src/content/glossary.csv", {
    parser: (text) => parseCsv(text, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true,
    }),
  }),
  schema: z.object({
    id: z.string(),
    ...glossaryFields, // Spread the dynamic language fields into the schema
  }),
});

export const collections = { i18n, glossary };