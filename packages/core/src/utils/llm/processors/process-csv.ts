import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { performance } from 'node:perf_hooks';

import { localeEnglishNames, type Locale } from '@languages';
import {
  translateText,
  containsAnyLetterOrNumberRegex,
  DEFAULT_OLLAMA_URL,
  DEFAULT_LLM_MODEL,
  type TranslateOptions,
} from '../translator.js';

// ============================================================
// CSV-Specific Options
// ============================================================

export interface CsvTranslateOptions extends TranslateOptions {
  /**
   * Explicit list of column headers whose values should be translated.
   * When omitted **all** text columns are translated except those whose
   * lower-cased, trimmed header matches one of the entries in
   * {@link DEFAULT_SKIP_COLUMNS}.
   */
  columnsToTranslate?: string[];
}

/**
 * Column headers that are skipped by default because they contain
 * identifiers, URLs, booleans, or other non-translatable data.
 *
 * Matching is performed case-insensitively after trimming whitespace.
 */
export const DEFAULT_SKIP_COLUMNS = new Set([
  'id',
  'link',
  'url',
  'link/url',
  'registrationrequired',
  'registration required',
  'slug',
]);

// ============================================================
// Public API
// ============================================================

/**
 * Reads a CSV file, translates the requested columns row-by-row via the
 * Ollama LLM, and writes the result to `outputPath`.
 *
 * The output CSV preserves the exact same headers, column order, and
 * quoting style as the input.
 */
export async function processCsvDocument(
  inputPath: string,
  outputPath: string,
  sourceLang: Locale,
  targetLang: Locale,
  options?: CsvTranslateOptions,
): Promise<void>;
export async function processCsvDocument(
  inputPath: string,
  outputPath: string,
  sourceLang: Locale,
  targetLang: Locale,
  ollamaUrl?: string,
  llmModel?: string,
): Promise<void>;
export async function processCsvDocument(
  inputPath: string,
  outputPath: string,
  sourceLang: Locale,
  targetLang: Locale,
  optionsOrUrl?: CsvTranslateOptions | string,
  legacyModel?: string,
): Promise<void> {
  const options: CsvTranslateOptions =
    typeof optionsOrUrl === 'string'
      ? { ollamaUrl: optionsOrUrl, llmModel: legacyModel }
      : optionsOrUrl ?? {};
  const ollamaUrl = options.ollamaUrl ?? DEFAULT_OLLAMA_URL;
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL;

  console.log(`🌐 Using Ollama URL: ${ollamaUrl}`);
  console.log(`🤖 Using LLM model: ${llmModel}`);

  const fileStart = performance.now();
  console.log(`\n📄 Processing CSV: ${path.basename(inputPath)} -> Target: ${targetLang.toUpperCase()} (${localeEnglishNames[targetLang]})`);

  // 1. Read the raw CSV (handle optional BOM)
  let rawCsv = await fs.readFile(inputPath, 'utf-8');
  // Strip UTF-8 BOM if present
  if (rawCsv.charCodeAt(0) === 0xFEFF) {
    rawCsv = rawCsv.slice(1);
  }

  // 2. Parse into an array of objects keyed by header name
  const records: Record<string, string>[] = csvParse(rawCsv, {
    columns: true,       // first row = headers
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  });

  if (records.length === 0) {
    console.warn('⚠️  CSV file is empty or contains only headers — nothing to translate.');
    // Still write the (potentially empty) output so the locale file exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, rawCsv, 'utf-8');
    return;
  }

  // 3. Determine which columns to translate
  const allHeaders = Object.keys(records[0]);
  const translatableHeaders = resolveTranslatableHeaders(allHeaders, options.columnsToTranslate);

  console.log(`🔤 Translatable columns: [${translatableHeaders.join(', ')}]`);

  // 4. Translate row-by-row, field-by-field
  const totalRows = records.length;
  for (let i = 0; i < totalRows; i++) {
    const row = records[i];
    console.log(`\n📝 Row ${i + 1}/${totalRows} (id: ${row['ID'] ?? row['id'] ?? i})`);

    for (const header of translatableHeaders) {
      const value = row[header];
      if (!value || !containsAnyLetterOrNumberRegex.test(value)) continue;

      row[header] = await translateText(value, sourceLang, targetLang, ollamaUrl, llmModel);
    }
  }

  // 5. Stringify back to CSV, preserving header order and quoting all fields
  const outputCsv = csvStringify(records, {
    header: true,
    columns: allHeaders, // preserve original header order
    quoted: true,        // quote all fields to match original formatting
  });

  // 6. Write the translated CSV
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, outputCsv, 'utf-8');

  const fileEnd = performance.now();
  const fileDuration = ((fileEnd - fileStart) / 1000).toFixed(2);
  console.log(`\n✅ CSV successfully saved to: ${outputPath} (Total time: ${fileDuration}s)`);
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Given all headers, returns the subset that should be translated.
 *
 * If `explicit` is provided (non-empty array) those headers are used
 * directly.  Otherwise every header *not* in {@link DEFAULT_SKIP_COLUMNS}
 * is selected.
 */
function resolveTranslatableHeaders(allHeaders: string[], explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) {
    // Validate that the caller-supplied names actually exist in the file
    const headerSet = new Set(allHeaders);
    const valid = explicit.filter(h => {
      if (!headerSet.has(h)) {
        console.warn(`⚠️  Requested column "${h}" not found in CSV headers — skipping.`);
        return false;
      }
      return true;
    });
    return valid;
  }

  // Auto-detect: include every column whose normalised name is NOT in the skip-list
  return allHeaders.filter(h => !DEFAULT_SKIP_COLUMNS.has(h.trim().toLowerCase()));
}
