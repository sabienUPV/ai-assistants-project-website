import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { parse as parseCsv } from 'csv-parse/sync';

const i18n = defineCollection({
  // Load the CSV and parse it into rows
  loader: file("src/content/i18n.csv", {
    parser: (text) => parseCsv(text, { 
      columns: true, // Use the header row for keys
      skip_empty_lines: true,
      trim: true,
    }),
  }),
  // Validate every row!
  schema: z.object({
    id: z.string(),
    en: z.string(),
    es: z.string(),
  })
});

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
    term_en: z.string(),
    def_en: z.string(),
    term_es: z.string(),
    def_es: z.string(),
  })
});

export const collections = { i18n, glossary };