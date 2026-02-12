import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { parse as parseCsv } from 'csv-parse/sync';

// 1. Define your languages in one place
const langEnum = z.enum(['en', 'es', 'de', 'pt', 'it', 'hr']);
export const supportedLangs = langEnum.options;
export type Lang = z.infer<typeof langEnum>;

// 2. Dynamically create the shape for the translations
// We want: { en: z.string(), es: z.string(), ... }
const langFields = supportedLangs.reduce((acc, lang) => {
  acc[lang] = z.string();
  return acc;
}, {} as Record<Lang, z.ZodString>);

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
const glossaryFields = supportedLangs.reduce((acc, lang) => {
  acc[`term_${lang}`] = z.string();
  acc[`def_${lang}`] = z.string();
  return acc;
}, {} as Record<`term_${Lang}` | `def_${Lang}`, z.ZodString>);

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