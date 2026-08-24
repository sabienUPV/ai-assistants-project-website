import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import { parse as parseCsv } from 'csv-parse/sync';

import fs from 'node:fs';

import { postSchema } from '@schemas/posts';
import { courseSchema } from '@schemas/courses';
import { aiSolutionSchema } from '@schemas/ai-solutions';

// 1. Import the supported languages and their types
// from a single source of truth
import { locales } from '@languages';
import type { Locale } from '@languages';

// 2. Dynamically create the shape for the translations
// We want: { en: z.string(), es: z.string(), ... }
const langFields = locales.reduce((acc, locale) => {
  acc[locale] = z.string();
  return acc;
}, {} as Record<Locale, z.ZodString>);

const i18n = defineCollection({
  // Load the CSV and parse it into rows
  loader: file("src/content/translations.csv", {
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

// Create one posts_<locale> collection for each supported locale
const posts = locales.reduce((acc, locale) => {
  acc[`posts_${locale}`] = defineCollection({
    // Load all .md and .mdoc files in the locale-specific posts directory
    loader: glob({ pattern: `${locale}/posts/*.{md,mdoc}`, base: '../admin/src/content' }),
    // Type-check frontmatter using the shared postSchema from core
    schema: postSchema,
  });
  return acc;
}, {} as Record<`posts_${Locale}`, ReturnType<typeof defineCollection>>); // Type assertion for strict typing

// Create one courses_<locale> collection for each supported locale
const courses = locales.reduce((acc, locale) => {
  acc[`courses_${locale}`] = defineCollection({
    // Load all .md and .mdoc files in the locale-specific courses directory
    loader: glob({ pattern: `${locale}/courses/*.{md,mdoc}`, base: '../admin/src/content' }),
    // Type-check frontmatter using the shared courseSchema from core
    schema: courseSchema,
  });
  return acc;
}, {} as Record<`courses_${Locale}`, ReturnType<typeof defineCollection>>); // Type assertion for strict typing

// Create one ai-solutions_<locale> collection for each supported locale
// (Note: Unlike posts and courses, we have localized CSV files for each locale in a single ai-solutions directory (e.g. ai-solutions/ai-solutions_en.csv, ai-solutions/ai-solutions_es.csv, etc.))
const aiSolutions = locales.reduce((acc, locale) => {
  const csvFilePath = `src/content/ai-solutions/ai-solutions_${locale}.csv`;
  // Load the CSV file for the current locale if it exists, otherwise return an empty object
  acc[`ai-solutions_${locale}`] = fs.existsSync(csvFilePath)
    ? defineCollection({
      // Load the CSV and parse it into rows
      loader: file(csvFilePath, {
        parser: (text) => parseCsv(text, {
          // Get the keys of the schema as an array of strings, so that the first column matches the first header, and so on
          // This way, we do not need to have the header names in the CSV match the schema keys exactly, and we can have a more user-friendly header in the CSV.
          // The only caveat: We need to ensure that the order of the columns in the CSV matches the order of the keys in the schema, otherwise the data will be misaligned. This is a trade-off for having more user-friendly headers in the CSV.
          columns: aiSolutionSchema.keyof().options,
          skip_empty_lines: true,
          trim: true,
          // Skip the first 2 rows (header name and description) and start parsing from the actual data
          // Row 1: header name, Row 3: header description, Row 3: actual data
          from_line: 3,
        }),
      }),
      schema: aiSolutionSchema,
    })
    : {};
  return acc;
}, {} as Record<`ai-solutions_${Locale}`, ReturnType<typeof defineCollection>>); // Type assertion for strict typing

// Export the created collections for use in the Astro project
export const collections = { i18n, glossary, ...posts, ...courses, ...aiSolutions };